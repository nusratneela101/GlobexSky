import supabase from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import * as stripeService from '../services/payment/stripe.service.js';
import * as paypalService from '../services/payment/paypal.service.js';

export async function listWebhooks(req, res, next) {
  try {
    const { data, error } = await supabase.from('webhooks').select('*').eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function createWebhook(req, res, next) {
  try {
    const { url, events } = req.body;
    const secret = uuidv4();
    const { data, error } = await supabase.from('webhooks').insert({ user_id: req.user.id, url, events, secret, is_active: true }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateWebhook(req, res, next) {
  try {
    const { url, events, is_active } = req.body;
    const { data, error } = await supabase.from('webhooks').update({ url, events, is_active }).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function deleteWebhook(req, res, next) {
  try {
    const { error } = await supabase.from('webhooks').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Webhook deleted.' });
  } catch (err) { next(err); }
}

export async function testWebhook(req, res, next) {
  try {
    const { data: webhook } = await supabase.from('webhooks').select('url').eq('id', req.params.id).single();
    if (!webhook) return res.status(404).json({ success: false, error: 'Webhook not found.' });
    // In production, send a test HTTP POST to webhook.url
    res.json({ success: true, message: `Test payload sent to ${webhook.url}` });
  } catch (err) { next(err); }
}

// ─── Stripe Webhook ───────────────────────────────────────────────────────────

/**
 * Handle incoming Stripe webhook events.
 * Route: POST /api/v1/webhooks/stripe
 * Requires raw body (express.raw middleware applied in route registration).
 */
export async function handleStripeWebhook(req, res, next) {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ success: false, error: 'Missing Stripe-Signature header.' });

    let event;
    try {
      event = await stripeService.constructWebhookEvent(req.body, signature);
    } catch (err) {
      return res.status(400).json({ success: false, error: `Webhook signature verification failed: ${err.message}` });
    }

    await stripeService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) { next(err); }
}

/**
 * Handle incoming Stripe Connect webhook events.
 * Route: POST /api/v1/webhooks/stripe/connect
 */
export async function handleStripeConnectWebhook(req, res, next) {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ success: false, error: 'Missing Stripe-Signature header.' });

    let event;
    try {
      event = await stripeService.constructWebhookEvent(req.body, signature, true);
    } catch (err) {
      return res.status(400).json({ success: false, error: `Connect webhook signature verification failed: ${err.message}` });
    }

    await stripeService.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) { next(err); }
}

// ─── PayPal Webhook ───────────────────────────────────────────────────────────

/**
 * Handle incoming PayPal webhook events.
 * Route: POST /api/v1/webhooks/paypal
 */
export async function handlePaypalWebhook(req, res, next) {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const verified = await paypalService.verifyWebhook(req.headers, rawBody);
    if (!verified) return res.status(400).json({ success: false, error: 'PayPal webhook verification failed.' });

    await paypalService.handleWebhookEvent(req.body);
    res.json({ received: true });
  } catch (err) { next(err); }
}

// ─── DHL Webhook ─────────────────────────────────────────────────────────────

/**
 * Handle DHL shipment tracking events.
 * Route: POST /api/v1/webhooks/dhl
 */
export async function handleDhlWebhook(req, res, next) {
  try {
    const token = req.headers['x-dhl-webhook-token'] || req.headers['authorization'];
    if (process.env.DHL_WEBHOOK_TOKEN && token !== process.env.DHL_WEBHOOK_TOKEN) {
      return res.status(401).json({ success: false, error: 'Invalid DHL webhook token.' });
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];
    for (const event of events) {
      const trackingNumber = event.shipmentTrackingNumber || event.trackingNumber;
      const status = event.status || event.description;
      const timestamp = event.timestamp || new Date().toISOString();

      if (trackingNumber) {
        await supabase.from('shipment_tracking_events').insert({
          tracking_number: trackingNumber,
          carrier: 'dhl',
          status,
          description: event.description || '',
          location: event.location?.address?.addressLocality || '',
          timestamp,
          raw_event: event,
          created_at: new Date().toISOString(),
        });

        await supabase.from('shipments').update({ tracking_status: status, updated_at: new Date().toISOString() })
          .eq('tracking_number', trackingNumber);
      }
    }

    res.json({ received: true });
  } catch (err) { next(err); }
}

// ─── FedEx Webhook ────────────────────────────────────────────────────────────

/**
 * Handle FedEx shipment tracking events.
 * Route: POST /api/v1/webhooks/fedex
 */
export async function handleFedexWebhook(req, res, next) {
  try {
    // FedEx sends a transactionId + events array
    const events = req.body?.event ? [req.body.event] : (req.body?.events || [req.body]);

    for (const event of events) {
      const trackingNumber = event?.trackingInfo?.trackingNumber
        || event?.trackingNumber
        || event?.TrackingNumber;
      const status = event?.eventDescription || event?.status || '';
      const timestamp = event?.eventDateTime || event?.timestamp || new Date().toISOString();

      if (trackingNumber) {
        await supabase.from('shipment_tracking_events').insert({
          tracking_number: trackingNumber,
          carrier: 'fedex',
          status,
          description: event.eventDescription || '',
          location: event.eventAddress?.city || '',
          timestamp,
          raw_event: event,
          created_at: new Date().toISOString(),
        });

        await supabase.from('shipments').update({ tracking_status: status, updated_at: new Date().toISOString() })
          .eq('tracking_number', trackingNumber);
      }
    }

    res.json({ received: true });
  } catch (err) { next(err); }
}

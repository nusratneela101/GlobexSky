import supabase from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import { generateTrackingNumber } from '../utils/helpers.js';
import { sendOrderConfirmationEmail } from '../services/email.service.js';

/** POST /api/v1/checkout/validate — Validate cart items before checkout */
export async function validateCart(req, res, next) {
  try {
    const userId = req.user.id;

    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cart) return res.status(400).json({ success: false, error: 'Cart is empty.' });

    const { data: items } = await supabase
      .from('cart_items')
      .select('*, product:products(id,title,price,stock_quantity,is_active)')
      .eq('cart_id', cart.id)
      .eq('saved_for_later', false);

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty.' });
    }

    const issues = [];
    for (const item of items) {
      if (!item.product?.is_active) {
        issues.push({ item_id: item.id, message: `"${item.product?.title}" is no longer available.` });
      } else if (item.product.stock_quantity != null && item.product.stock_quantity < item.quantity) {
        issues.push({
          item_id: item.id,
          message: `Insufficient stock for "${item.product.title}". Available: ${item.product.stock_quantity}.`,
        });
      }
    }

    if (issues.length > 0) {
      return res.status(422).json({ success: false, error: 'Some items have issues.', issues });
    }

    const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    res.json({ success: true, data: { item_count: items.length, subtotal: +subtotal.toFixed(2) } });
  } catch (err) { next(err); }
}

/** POST /api/v1/checkout/shipping-rates — Get shipping rates for destination */
export async function getShippingRates(req, res, next) {
  try {
    const { country, state, postal_code, subtotal = 0 } = req.body;

    // Shipping rate calculation (simplified; real implementation would call carrier APIs)
    const rates = [
      {
        id: 'economy',
        name: 'Economy Shipping',
        carrier: 'Globex Freight',
        price: subtotal >= 500 ? 0 : 9.99,
        estimated_days: '10–15 business days',
        description: 'Standard international freight',
      },
      {
        id: 'standard',
        name: 'Standard Shipping',
        carrier: 'DHL',
        price: subtotal >= 500 ? 0 : 19.99,
        estimated_days: '5–7 business days',
        description: 'Reliable international shipping',
      },
      {
        id: 'express',
        name: 'Express Shipping',
        carrier: 'FedEx',
        price: 39.99,
        estimated_days: '2–3 business days',
        description: 'Fast international express delivery',
      },
    ];

    res.json({ success: true, data: rates });
  } catch (err) { next(err); }
}

/** POST /api/v1/checkout/place-order — Create order, process payment, clear cart */
export async function placeOrder(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      shipping_address_id,
      billing_address_id,
      shipping_method,
      shipping_cost,
      payment_method,
      coupon_code,
      notes,
    } = req.body;

    // Fetch cart
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cart) return res.status(400).json({ success: false, error: 'Cart is empty.' });

    const { data: items } = await supabase
      .from('cart_items')
      .select('*, product:products(id,title,price,supplier_id)')
      .eq('cart_id', cart.id)
      .eq('saved_for_later', false);

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty.' });
    }

    const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const shippingFee = Number(shipping_cost) || 19.99;
    const taxRate = 0.08;
    const taxAmount = +(subtotal * taxRate).toFixed(2);

    // Apply coupon discount if provided
    let discountAmount = 0;
    if (coupon_code) {
      const now = new Date().toISOString();
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', coupon_code.toUpperCase().trim())
        .eq('is_active', true)
        .single();

      if (coupon && (!coupon.valid_to || coupon.valid_to >= now)) {
        if (coupon.discount_type === 'percentage') {
          discountAmount = (subtotal * coupon.discount_value) / 100;
          if (coupon.max_discount) discountAmount = Math.min(discountAmount, coupon.max_discount);
        } else {
          discountAmount = Math.min(coupon.discount_value, subtotal);
        }
        discountAmount = +discountAmount.toFixed(2);
        // Increment coupon usage
        await supabase
          .from('coupons')
          .update({ used_count: (coupon.used_count || 0) + 1 })
          .eq('id', coupon.id);
      }
    }

    const total = +(subtotal + shippingFee + taxAmount - discountAmount).toFixed(2);

    // Generate unique, non-predictable order number using UUID
    const orderNumber = `GS-${uuidv4().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const trackingNumber = generateTrackingNumber();

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        buyer_id: userId,
        order_number: orderNumber,
        status: 'pending',
        subtotal: +subtotal.toFixed(2),
        shipping_fee: shippingFee,
        tax: taxAmount,
        discount: discountAmount,
        total,
        shipping_address_id,
        billing_address_id: billing_address_id || shipping_address_id,
        payment_method,
        payment_status: 'pending',
        shipping_method: shipping_method || 'standard',
        tracking_number: trackingNumber,
        coupon_code: coupon_code || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (orderErr) return res.status(400).json({ success: false, error: orderErr.message });

    // Insert order items
    const orderItems = items.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      supplier_id: i.supplier_id || i.product?.supplier_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: +(i.unit_price * i.quantity).toFixed(2),
      status: 'pending',
    }));
    await supabase.from('order_items').insert(orderItems);

    // Add initial timeline entry
    await supabase.from('order_timeline').insert({
      order_id: order.id,
      status: 'pending',
      description: 'Order placed successfully.',
      created_by: userId,
    });

    // Clear active cart items (keep saved-for-later)
    await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cart.id)
      .eq('saved_for_later', false);

    await sendOrderConfirmationEmail(req.user.email, order).catch((emailErr) => {
      console.error('Order confirmation email failed:', emailErr.message);
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
}

/** GET /api/v1/checkout/confirmation/:orderId — Get order confirmation details */
export async function getOrderConfirmation(req, res, next) {
  try {
    const { orderId } = req.params;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*, product:products(id,title,images)),
        shipping_address:addresses!shipping_address_id(*),
        billing_address:addresses!billing_address_id(*)
      `)
      .eq('id', orderId)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Order not found.' });

    // Ensure only the buyer or admin can view
    if (data.buyer_id !== req.user.id && req.user.profile?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

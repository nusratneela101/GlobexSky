/**
 * Template Service
 * Handles template rendering, email/SMS sending, and version management.
 */

import nodemailer from 'nodemailer';
import { renderString } from './templateEngine.js';
import { PLATFORM_NAME, PLATFORM_EMAIL } from '../config/constants.js';
import Template from '../models/Template.js';

// ─── SMTP transporter (nodemailer) ────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ─── Sample data used for live preview rendering ──────────────────────────────
export const SAMPLE_DATA = {
  customer_name: 'Jane Smith',
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane.smith@example.com',
  order_id: 'ORD-8A3F9',
  order_date: '2024-03-15',
  amount: '$245.00',
  currency: 'USD',
  product_name: 'Premium Wireless Headphones',
  tracking_number: 'TRK-1234567890',
  shipping_address: '123 Main St, New York, NY 10001',
  estimated_delivery: '2024-03-20',
  reset_url: 'https://globexsky.com/reset?token=abc123',
  verification_url: 'https://globexsky.com/verify?token=abc123',
  unsubscribe_url: 'https://globexsky.com/unsubscribe?token=abc123',
  platform_name: PLATFORM_NAME,
  support_url: 'https://globexsky.com/support',
  year: new Date().getFullYear(),
};

// ─── Template rendering ───────────────────────────────────────────────────────

/**
 * Render a template body (and subject) with provided variables.
 * @param {object} template - template record with body (and optional subject)
 * @param {object} [variables] - variable values; defaults to SAMPLE_DATA
 * @returns {{ subject: string, body: string }}
 */
export function renderTemplate(template, variables = {}) {
  const data = { ...SAMPLE_DATA, ...variables };
  return {
    subject: template.subject ? renderString(template.subject, data) : '',
    body: renderString(template.body, data),
  };
}

/**
 * Extract variable placeholders from a template body (and subject).
 * Returns unique variable names found in {{variable}} syntax.
 * The leading '#' and '/' characters are excluded to avoid matching
 * Handlebars block helpers such as {{#if}}, {{/if}}, {{#each}}, {{/each}}.
 * @param {string} text
 * @returns {string[]}
 */
export function extractVariables(text) {
  const matches = text.match(/\{\{([^}#/][^}]*)\}\}/g) || [];
  const names = matches.map((m) => m.replace(/^\{\{|\}\}$/g, '').trim());
  return [...new Set(names)];
}

// ─── CRUD helpers ─────────────────────────────────────────────────────────────

/**
 * Create a new template and save initial version.
 * @param {object} data
 * @param {string} actorId
 * @returns {Promise<object>}
 */
export async function createTemplate(data, actorId) {
  const variables = extractVariables(`${data.subject || ''} ${data.body || ''}`);
  const template = await Template.create({
    name: data.name,
    type: data.type,
    category: data.category,
    subject: data.subject || null,
    body: data.body,
    variables,
    is_active: data.is_active ?? true,
    created_by: actorId,
  });
  await Template.saveVersion(template, actorId, 'Initial version');
  return template;
}

/**
 * Update an existing template; snapshot the previous version first.
 * @param {string} id
 * @param {object} data
 * @param {string} actorId
 * @param {string} [changeNote]
 * @returns {Promise<object>}
 */
export async function updateTemplate(id, data, actorId, changeNote = '') {
  const current = await Template.findById(id);
  if (!current) throw new Error(`Template ${id} not found`);

  // Snapshot current state
  await Template.saveVersion(current, actorId, changeNote || 'Updated');

  const variables = extractVariables(`${data.subject ?? current.subject ?? ''} ${data.body ?? current.body ?? ''}`);

  return Template.update(id, {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.type !== undefined && { type: data.type }),
    ...(data.category !== undefined && { category: data.category }),
    ...(data.subject !== undefined && { subject: data.subject }),
    ...(data.body !== undefined && { body: data.body }),
    ...(data.is_active !== undefined && { is_active: data.is_active }),
    variables,
  });
}

// ─── Email sending ────────────────────────────────────────────────────────────

/**
 * Send a test email using the provided template and variables.
 * @param {object} template
 * @param {string} to - recipient email address
 * @param {object} [variables]
 * @returns {Promise<object>} nodemailer info
 */
export async function sendTestEmail(template, to, variables = {}) {
  const { subject, body } = renderTemplate(template, variables);
  return transporter.sendMail({
    from: `"${PLATFORM_NAME}" <${PLATFORM_EMAIL}>`,
    to,
    subject: subject || `[Test] ${template.name}`,
    html: body,
  });
}

// ─── SMS sending ──────────────────────────────────────────────────────────────

/**
 * Send a test SMS using the Twilio REST API.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER env vars.
 * @param {object} template
 * @param {string} to - recipient phone number (E.164 format)
 * @param {object} [variables]
 * @returns {Promise<object>}
 */
export async function sendTestSms(template, to, variables = {}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)');
  }

  const { body } = renderTemplate(template, variables);

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Twilio error: ${response.status}`);
  }

  return response.json();
}

// ─── SMS segment counter ──────────────────────────────────────────────────────

/**
 * Calculate the number of SMS segments for a given message.
 * Standard GSM-7 encoding: single message = 160 chars/segment;
 * once the message exceeds 160 chars it becomes a concatenated SMS
 * where each segment holds only 153 chars (the remaining 7 bytes are
 * used for the UDH concatenation header).
 * @param {string} text
 * @returns {{ charCount: number, segmentCount: number, charsPerSegment: number }}
 */
export function calculateSmsSegments(text) {
  const charCount = text.length;
  if (charCount === 0) return { charCount: 0, segmentCount: 1, charsPerSegment: 160 };
  const charsPerSegment = charCount <= 160 ? 160 : 153;
  const segmentCount = Math.ceil(charCount / charsPerSegment);
  return { charCount, segmentCount, charsPerSegment };
}

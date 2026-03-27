/**
 * SMS Template Controller
 * CRUD operations for SMS templates with versioning, cloning, preview, and segment calculation.
 */

import SmsTemplate from '../models/SmsTemplate.js';
import Template from '../models/Template.js';

// ─── List SMS templates ───────────────────────────────────────────────────────

/** GET /api/v1/sms-templates */
export async function listSmsTemplates(req, res, next) {
  try {
    const { search, category, isActive, page = 1, limit = 20 } = req.query;

    const result = await SmsTemplate.search({
      search,
      type: 'sms',
      category,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Get single SMS template ──────────────────────────────────────────────────

/** GET /api/v1/sms-templates/:id */
export async function getSmsTemplate(req, res, next) {
  try {
    const template = await SmsTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'SMS template not found' });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
}

// ─── Create SMS template ──────────────────────────────────────────────────────

/** POST /api/v1/sms-templates */
export async function createSmsTemplate(req, res, next) {
  try {
    const { name, body, category, variables, is_active } = req.body;

    if (!name || !body) {
      return res.status(400).json({ success: false, error: 'Name and body are required.' });
    }

    const template = await SmsTemplate.create({
      name,
      body,
      category: category || null,
      variables: variables || [],
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user.id,
    });

    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
}

// ─── Update SMS template ──────────────────────────────────────────────────────

/** PUT /api/v1/sms-templates/:id */
export async function updateSmsTemplate(req, res, next) {
  try {
    const existing = await SmsTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'SMS template not found' });

    // Save current version before updating
    await Template.saveVersion(req.params.id, existing);

    const allowed = ['name', 'body', 'category', 'variables', 'is_active'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const template = await SmsTemplate.update(req.params.id, updates);
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
}

// ─── Delete SMS template ──────────────────────────────────────────────────────

/** DELETE /api/v1/sms-templates/:id */
export async function deleteSmsTemplate(req, res, next) {
  try {
    const existing = await SmsTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'SMS template not found' });

    await SmsTemplate.delete(req.params.id);
    res.json({ success: true, message: 'SMS template deleted.' });
  } catch (err) { next(err); }
}

// ─── Clone SMS template ───────────────────────────────────────────────────────

/** POST /api/v1/sms-templates/:id/clone */
export async function cloneSmsTemplate(req, res, next) {
  try {
    const existing = await SmsTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'SMS template not found' });

    const cloned = await Template.clone(req.params.id);
    res.status(201).json({ success: true, data: cloned });
  } catch (err) { next(err); }
}

// ─── Preview SMS template ─────────────────────────────────────────────────────

/** POST /api/v1/sms-templates/:id/preview */
export async function previewSmsTemplate(req, res, next) {
  try {
    const template = await SmsTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'SMS template not found' });

    const values = req.body.values || {};
    let body = template.body || '';

    for (const [key, value] of Object.entries(values)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`{{\\s*${escaped}\\s*}}`, 'g');
      body = body.replace(pattern, value);
    }

    res.json({ success: true, data: { body } });
  } catch (err) { next(err); }
}

// ─── Calculate SMS segments ───────────────────────────────────────────────────

/** POST /api/v1/sms-templates/calculate-segments */
export async function calculateSegments(req, res, next) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required.' });
    }

    const result = SmsTemplate.calculateSegments(text);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

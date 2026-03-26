/**
 * Template Controller
 * CRUD operations, preview, test-send, version history, clone.
 */

import Template from '../models/Template.js';
import * as service from '../services/templateService.js';

// ─── List templates ───────────────────────────────────────────────────────────

/** GET /api/v1/templates */
export async function listTemplates(req, res, next) {
  try {
    const { search, type, category, is_active, page = 1, limit = 20 } = req.query;
    const isActive = is_active !== undefined ? is_active === 'true' : undefined;
    const result = await Template.search({
      search,
      type,
      category,
      isActive,
      page: Number(page),
      limit: Number(limit),
    });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Get single template ──────────────────────────────────────────────────────

/** GET /api/v1/templates/:id */
export async function getTemplate(req, res, next) {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
}

// ─── Create template ──────────────────────────────────────────────────────────

/** POST /api/v1/templates */
export async function createTemplate(req, res, next) {
  try {
    const template = await service.createTemplate(req.body, req.user?.id);
    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
}

// ─── Update template ──────────────────────────────────────────────────────────

/** PUT /api/v1/templates/:id */
export async function updateTemplate(req, res, next) {
  try {
    const { change_note, ...data } = req.body;
    const template = await service.updateTemplate(req.params.id, data, req.user?.id, change_note);
    res.json({ success: true, data: template });
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ success: false, error: err.message });
    next(err);
  }
}

// ─── Delete template ──────────────────────────────────────────────────────────

/** DELETE /api/v1/templates/:id */
export async function deleteTemplate(req, res, next) {
  try {
    await Template.delete(req.params.id);
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) { next(err); }
}

// ─── Toggle active state ──────────────────────────────────────────────────────

/** PATCH /api/v1/templates/:id/toggle */
export async function toggleTemplate(req, res, next) {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    const updated = await Template.update(req.params.id, { is_active: !template.is_active });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

// ─── Render preview ───────────────────────────────────────────────────────────

/** POST /api/v1/templates/:id/preview */
export async function renderPreview(req, res, next) {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    const rendered = service.renderTemplate(template, req.body?.variables ?? {});
    res.json({ success: true, data: rendered });
  } catch (err) { next(err); }
}

/** POST /api/v1/templates/preview-raw */
export async function renderPreviewRaw(req, res, next) {
  try {
    const { body, subject, variables } = req.body;
    const rendered = service.renderTemplate({ body, subject }, variables ?? {});
    res.json({ success: true, data: rendered });
  } catch (err) { next(err); }
}

// ─── Test send ────────────────────────────────────────────────────────────────

/** POST /api/v1/templates/:id/test-send */
export async function testSend(req, res, next) {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

    const { to, variables = {} } = req.body;
    if (!to) return res.status(400).json({ success: false, error: '"to" (email or phone number) is required' });

    if (template.type === 'sms') {
      await service.sendTestSms(template, to, variables);
    } else {
      await service.sendTestEmail(template, to, variables);
    }

    res.json({ success: true, message: `Test ${template.type === 'sms' ? 'SMS' : 'email'} sent to ${to}` });
  } catch (err) {
    if (err.message.includes('not configured')) {
      return res.status(503).json({ success: false, error: err.message });
    }
    next(err);
  }
}

// ─── Clone template ───────────────────────────────────────────────────────────

/** POST /api/v1/templates/:id/clone */
export async function cloneTemplate(req, res, next) {
  try {
    const cloned = await Template.clone(req.params.id, req.user?.id);
    res.status(201).json({ success: true, data: cloned });
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ success: false, error: err.message });
    next(err);
  }
}

// ─── Version history ──────────────────────────────────────────────────────────

/** GET /api/v1/templates/:id/versions */
export async function getVersionHistory(req, res, next) {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    const versions = await Template.getVersions(req.params.id);
    res.json({ success: true, data: versions });
  } catch (err) { next(err); }
}

/** POST /api/v1/templates/:id/versions/:version/restore */
export async function restoreVersion(req, res, next) {
  try {
    const template = await Template.restoreVersion(
      req.params.id,
      Number(req.params.version),
      req.user?.id,
    );
    res.json({ success: true, data: template });
  } catch (err) {
    if (err.message.includes('not found')) return res.status(404).json({ success: false, error: err.message });
    next(err);
  }
}

// ─── SMS segment calculator ───────────────────────────────────────────────────

/** POST /api/v1/templates/sms-segments */
export async function smsSegments(req, res, next) {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: '"text" is required' });
    const result = service.calculateSmsSegments(text);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

/**
 * Email Template Controller
 * CRUD operations for email templates with versioning, cloning, and preview.
 */

import EmailTemplate from '../models/EmailTemplate.js';
import Template from '../models/Template.js';

// ─── List email templates ─────────────────────────────────────────────────────

/** GET /api/v1/email-templates */
export async function listEmailTemplates(req, res, next) {
  try {
    const { search, category, isActive, page = 1, limit = 20 } = req.query;

    const result = await EmailTemplate.search({
      search,
      type: 'email',
      category,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Get single email template ────────────────────────────────────────────────

/** GET /api/v1/email-templates/:id */
export async function getEmailTemplate(req, res, next) {
  try {
    const template = await EmailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Email template not found' });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
}

// ─── Create email template ────────────────────────────────────────────────────

/** POST /api/v1/email-templates */
export async function createEmailTemplate(req, res, next) {
  try {
    const { name, subject, body, category, variables, is_active } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ success: false, error: 'Name, subject, and body are required.' });
    }

    const template = await EmailTemplate.create({
      name,
      subject,
      body,
      category: category || null,
      variables: variables || [],
      is_active: is_active !== undefined ? is_active : true,
      created_by: req.user.id,
    });

    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
}

// ─── Update email template ────────────────────────────────────────────────────

/** PUT /api/v1/email-templates/:id */
export async function updateEmailTemplate(req, res, next) {
  try {
    const existing = await EmailTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Email template not found' });

    // Save current version before updating
    await Template.saveVersion(req.params.id, existing);

    const allowed = ['name', 'subject', 'body', 'category', 'variables', 'is_active'];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    const template = await EmailTemplate.update(req.params.id, updates);
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
}

// ─── Delete email template ────────────────────────────────────────────────────

/** DELETE /api/v1/email-templates/:id */
export async function deleteEmailTemplate(req, res, next) {
  try {
    const existing = await EmailTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Email template not found' });

    await EmailTemplate.delete(req.params.id);
    res.json({ success: true, message: 'Email template deleted.' });
  } catch (err) { next(err); }
}

// ─── Clone email template ─────────────────────────────────────────────────────

/** POST /api/v1/email-templates/:id/clone */
export async function cloneEmailTemplate(req, res, next) {
  try {
    const existing = await EmailTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Email template not found' });

    const cloned = await Template.clone(req.params.id);
    res.status(201).json({ success: true, data: cloned });
  } catch (err) { next(err); }
}

// ─── Preview email template ───────────────────────────────────────────────────

/** POST /api/v1/email-templates/:id/preview */
export async function previewEmailTemplate(req, res, next) {
  try {
    const template = await EmailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Email template not found' });

    const values = req.body.values || {};
    let subject = template.subject || '';
    let body = template.body || '';

    for (const [key, value] of Object.entries(values)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`{{\\s*${escaped}\\s*}}`, 'g');
      subject = subject.replace(pattern, value);
      body = body.replace(pattern, value);
    }

    res.json({ success: true, data: { subject, body } });
  } catch (err) { next(err); }
}

// ─── Get email template versions ──────────────────────────────────────────────

/** GET /api/v1/email-templates/:id/versions */
export async function getEmailTemplateVersions(req, res, next) {
  try {
    const existing = await EmailTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Email template not found' });

    const versions = await Template.getVersions(req.params.id);
    res.json({ success: true, data: versions });
  } catch (err) { next(err); }
}

// ─── Restore email template version ──────────────────────────────────────────

/** POST /api/v1/email-templates/:id/versions/:version/restore */
export async function restoreEmailTemplateVersion(req, res, next) {
  try {
    const existing = await EmailTemplate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Email template not found' });

    const template = await Template.restoreVersion(req.params.id, req.params.version);
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
}

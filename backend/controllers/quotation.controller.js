/**
 * Quotation Controller
 * CRUD operations for quotations, linked to RFQs.
 */

import Quotation from '../models/Quotation.js';
import supabase from '../config/supabase.js';

// ─── List quotations ──────────────────────────────────────────────────────────

/** GET /api/v1/quotations */
export async function listQuotations(req, res, next) {
  try {
    const { rfq_id, supplier_id, status, page = 1, limit = 20 } = req.query;

    const filters = {};
    if (status) filters.status = status;

    let result;
    if (rfq_id) {
      result = await Quotation.findByRFQ(rfq_id, { page: Number(page), limit: Number(limit), filters });
    } else if (supplier_id) {
      result = await Quotation.findBySupplier(supplier_id, { page: Number(page), limit: Number(limit), filters });
    } else {
      result = await Quotation.findAll({ page: Number(page), limit: Number(limit), filters });
    }

    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ─── Get single quotation ─────────────────────────────────────────────────────

/** GET /api/v1/quotations/:id */
export async function getQuotation(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select('*, rfq:rfqs(*), supplier:suppliers(id, company_name, contact_name)')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Quotation not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── Create quotation ─────────────────────────────────────────────────────────

/** POST /api/v1/quotations */
export async function createQuotation(req, res, next) {
  try {
    const {
      rfq_id, unit_price, total_price, currency = 'USD',
      min_order_qty, lead_time_days, validity_days, notes, attachments,
    } = req.body;

    const quotation = await Quotation.create({
      rfq_id,
      supplier_id: req.user.id,
      unit_price,
      total_price,
      currency,
      min_order_qty: min_order_qty || 1,
      lead_time_days: lead_time_days || 0,
      validity_days: validity_days || 30,
      notes: notes || null,
      attachments: attachments || [],
      status: 'pending',
    });

    res.status(201).json({ success: true, data: quotation });
  } catch (err) { next(err); }
}

// ─── Update quotation ─────────────────────────────────────────────────────────

/** PUT /api/v1/quotations/:id */
export async function updateQuotation(req, res, next) {
  try {
    const existing = await Quotation.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Quotation not found' });

    // Only the supplier who created it can update (and only while pending)
    if (existing.supplier_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this quotation.' });
    }
    if (existing.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Only pending quotations can be updated.' });
    }

    const { unit_price, total_price, currency, min_order_qty, lead_time_days, validity_days, notes, attachments } = req.body;
    const updates = {};
    if (unit_price !== undefined) updates.unit_price = unit_price;
    if (total_price !== undefined) updates.total_price = total_price;
    if (currency !== undefined) updates.currency = currency;
    if (min_order_qty !== undefined) updates.min_order_qty = min_order_qty;
    if (lead_time_days !== undefined) updates.lead_time_days = lead_time_days;
    if (validity_days !== undefined) updates.validity_days = validity_days;
    if (notes !== undefined) updates.notes = notes;
    if (attachments !== undefined) updates.attachments = attachments;

    const quotation = await Quotation.update(req.params.id, updates);
    res.json({ success: true, data: quotation });
  } catch (err) { next(err); }
}

// ─── Update quotation status ──────────────────────────────────────────────────

/** PATCH /api/v1/quotations/:id/status */
export async function updateQuotationStatus(req, res, next) {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'accepted', 'rejected', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const existing = await Quotation.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Quotation not found' });

    let updatedQuotation;
    if (status === 'accepted') {
      updatedQuotation = await Quotation.accept(req.params.id);
    } else {
      updatedQuotation = await Quotation.update(req.params.id, { status });
    }

    res.json({ success: true, data: updatedQuotation });
  } catch (err) { next(err); }
}

// ─── Delete quotation ─────────────────────────────────────────────────────────

/** DELETE /api/v1/quotations/:id */
export async function deleteQuotation(req, res, next) {
  try {
    const existing = await Quotation.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Quotation not found' });

    if (existing.supplier_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this quotation.' });
    }

    await Quotation.delete(req.params.id);
    res.json({ success: true, message: 'Quotation deleted.' });
  } catch (err) { next(err); }
}

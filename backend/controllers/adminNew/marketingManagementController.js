/**
 * Admin Marketing Management Controller
 * Manages leads, campaigns, upgrade requests, and bulk communications.
 */

import supabase from '../../config/supabase.js';
import { buildPagination } from '../../utils/pagination.js';

/** GET /api/admin/marketing/leads — potential verified pro supplier leads */
export async function getLeads(req, res, next) {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('marketing_leads')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** POST /api/admin/marketing/campaigns — create marketing campaign for suppliers */
export async function createCampaign(req, res, next) {
  try {
    const { name, description, target_audience, budget, start_date, end_date, channels, status = 'draft' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Campaign name is required.' });

    const { data, error } = await supabase
      .from('marketing_campaigns')
      .insert({
        name,
        description,
        target_audience,
        budget,
        start_date,
        end_date,
        channels,
        status,
        created_by: req.user?.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/marketing/campaigns — list campaigns with filters */
export async function getCampaigns(req, res, next) {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('marketing_campaigns')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** PUT /api/admin/marketing/campaigns/:id/status */
export async function updateCampaignStatus(req, res, next) {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'active', 'paused', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('marketing_campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/admin/marketing/upgrade-requests — suppliers wanting to upgrade */
export async function getSupplierUpgradeRequests(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { from, to } = buildPagination(page, limit);

    const { data, error, count } = await supabase
      .from('supplier_upgrade_requests')
      .select('*, supplier:suppliers(id, company_name, current_plan)', { count: 'exact' })
      .eq('status', 'pending')
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** POST /api/admin/marketing/approve-upgrade — approve supplier plan upgrade */
export async function approveUpgrade(req, res, next) {
  try {
    const { supplierId, plan } = req.body;
    if (!supplierId || !plan) {
      return res.status(400).json({ success: false, error: 'supplierId and plan are required.' });
    }

    const [upgradeRes, supplierRes] = await Promise.all([
      supabase
        .from('supplier_upgrade_requests')
        .update({ status: 'approved', approved_by: req.user?.id, approved_at: new Date().toISOString() })
        .eq('supplier_id', supplierId)
        .eq('status', 'pending')
        .select()
        .single(),
      supabase
        .from('suppliers')
        .update({ current_plan: plan, plan_updated_at: new Date().toISOString() })
        .eq('id', supplierId)
        .select('id, company_name, current_plan')
        .single(),
    ]);

    if (upgradeRes.error) return res.status(400).json({ success: false, error: upgradeRes.error.message });
    res.json({ success: true, data: { upgrade: upgradeRes.data, supplier: supplierRes.data } });
  } catch (err) { next(err); }
}

/** GET /api/admin/marketing/stats — conversion rates, ROI */
export async function getMarketingStats(req, res, next) {
  try {
    const [campaigns, leads, conversions] = await Promise.all([
      supabase.from('marketing_campaigns').select('id, status, budget'),
      supabase.from('marketing_leads').select('id, status'),
      supabase.from('marketing_leads').select('id').eq('status', 'converted'),
    ]);

    const totalLeads = (leads.data || []).length;
    const convertedLeads = (conversions.data || []).length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100 * 10) / 10 : 0;
    const totalBudget = (campaigns.data || []).reduce((s, c) => s + (parseFloat(c.budget) || 0), 0);
    const activeCampaigns = (campaigns.data || []).filter((c) => c.status === 'active').length;

    res.json({
      success: true,
      data: {
        total_campaigns: (campaigns.data || []).length,
        active_campaigns: activeCampaigns,
        total_leads: totalLeads,
        converted_leads: convertedLeads,
        conversion_rate_percent: conversionRate,
        total_budget: totalBudget,
      },
    });
  } catch (err) { next(err); }
}

/** POST /api/admin/marketing/bulk-email — send bulk email to recipients */
export async function sendBulkEmail(req, res, next) {
  try {
    const { template, recipients, subject, variables } = req.body;
    if (!template || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'template and recipients array are required.' });
    }

    const job = {
      template,
      subject,
      variables,
      recipient_count: recipients.length,
      status: 'queued',
      queued_by: req.user?.id,
      queued_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('bulk_email_jobs').insert(job).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    res.status(202).json({ success: true, data, message: `Bulk email job queued for ${recipients.length} recipients.` });
  } catch (err) { next(err); }
}

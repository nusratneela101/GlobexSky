import {
  createLCRecord,
  getLCById,
  advanceLCStatus,
  createEscrowRecord,
  releaseEscrowFunds,
  createInvoiceFactoringRecord,
  calculateFactoring,
  getTradeFinanceAnalyticsData,
} from '../services/tradeFinance.service.js';

/** POST /api/v1/trade-finance/lc — Create a new Letter of Credit */
export async function createLC(req, res, next) {
  try {
    const { beneficiary_id, amount, currency, expiry_date, terms, goods_description } = req.body;
    const applicant_id = req.user.id;

    const lc = await createLCRecord({ applicant_id, beneficiary_id, amount, currency, expiry_date, terms, goods_description });
    res.status(201).json({ success: true, data: lc });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-finance/lc/:id — Get LC details by ID */
export async function getLCDetails(req, res, next) {
  try {
    const { id } = req.params;
    const lc = await getLCById(id);
    res.json({ success: true, data: lc });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/trade-finance/lc/:id/status — Update LC status (admin) */
export async function updateLCStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await advanceLCStatus(id, status);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-finance/escrow — Create escrow payment */
export async function createEscrow(req, res, next) {
  try {
    const { seller_id, order_id, amount, currency, conditions } = req.body;
    const buyer_id = req.user.id;

    const escrow = await createEscrowRecord({ buyer_id, seller_id, order_id, amount, currency, conditions });
    res.status(201).json({ success: true, data: escrow });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/trade-finance/escrow/:id/release — Release escrow funds (admin) */
export async function releaseEscrow(req, res, next) {
  try {
    const { id } = req.params;
    const released = await releaseEscrowFunds(id);
    res.json({ success: true, data: released });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-finance/invoice-factoring — Submit invoice for factoring */
export async function createInvoiceFactoring(req, res, next) {
  try {
    const { invoice_number, invoice_amount, debtor_name, due_date, advance_rate, discount_fee_rate } = req.body;
    const supplier_id = req.user.id;

    const record = await createInvoiceFactoringRecord({
      supplier_id,
      invoice_number,
      invoice_amount,
      debtor_name,
      due_date,
      advance_rate,
      discount_fee_rate,
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-finance/analytics — Dashboard analytics (admin) */
export async function getTradeFinanceAnalytics(req, res, next) {
  try {
    const { start, end } = req.query;
    const analytics = await getTradeFinanceAnalyticsData({ start, end });
    res.json({ success: true, data: analytics });
  } catch (err) { next(err); }
}

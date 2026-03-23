import {
  createLCRecord,
  getLCById,
  listLCRecords,
  advanceLCStatus,
  createLCAmendmentRecord,
  createEscrowRecord,
  listEscrowRecords,
  releaseEscrowFunds,
  refundEscrow as refundEscrowFunds,
  fileEscrowDisputeRecord,
  createInvoiceFactoringRecord,
  listInvoiceFactoringRecords,
  calculateFactoring,
  createPOFinancingRecord,
  getPOFinancingById,
  recordPORepaymentTx,
  createForwardContractRecord,
  listForwardContractRecords,
  createRateAlertRecord,
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

/** GET /api/v1/trade-finance/lc — List LCs for authenticated user */
export async function listLCs(req, res, next) {
  try {
    const lcs = await listLCRecords(req.user.id);
    res.json({ success: true, data: lcs });
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

/** POST /api/v1/trade-finance/lc/:id/amendment — Submit an amendment request */
export async function createLCAmendment(req, res, next) {
  try {
    const { id } = req.params;
    const { field, new_value, reason } = req.body;
    const requested_by = req.user.id;

    const amendment = await createLCAmendmentRecord({ lc_id: id, requested_by, field, new_value, reason });
    res.status(201).json({ success: true, data: amendment });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-finance/escrow — Create escrow payment */
export async function createEscrow(req, res, next) {
  try {
    const { seller_id, order_id, amount, currency, conditions, milestones } = req.body;
    const buyer_id = req.user.id;

    const escrow = await createEscrowRecord({ buyer_id, seller_id, order_id, amount, currency, conditions, milestones });
    res.status(201).json({ success: true, data: escrow });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-finance/escrow — List escrow payments for authenticated user */
export async function listEscrow(req, res, next) {
  try {
    const escrows = await listEscrowRecords(req.user.id);
    res.json({ success: true, data: escrows });
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

/** PATCH /api/v1/trade-finance/escrow/:id/refund — Refund escrow to buyer (admin) */
export async function refundEscrow(req, res, next) {
  try {
    const { id } = req.params;
    const refunded = await refundEscrowFunds(id);
    res.json({ success: true, data: refunded });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-finance/escrow/:id/dispute — File a dispute */
export async function fileEscrowDispute(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, description } = req.body;
    const filed_by = req.user.id;

    const dispute = await fileEscrowDisputeRecord({ escrow_id: id, filed_by, reason, description });
    res.status(201).json({ success: true, data: dispute });
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

/** GET /api/v1/trade-finance/invoice-factoring — List factoring records for supplier */
export async function listInvoiceFactoring(req, res, next) {
  try {
    const records = await listInvoiceFactoringRecords(req.user.id);
    res.json({ success: true, data: records });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-finance/po-financing — Apply for PO financing */
export async function createPOFinancing(req, res, next) {
  try {
    const { po_number, po_amount, buyer_name, delivery_date, advance_pct, interest_rate, term_days, notes } = req.body;
    const supplier_id = req.user.id;

    const record = await createPOFinancingRecord({ supplier_id, po_number, po_amount, buyer_name, delivery_date, advance_pct, interest_rate, term_days, notes });
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-finance/po-financing/:id — Get PO financing details */
export async function getPOFinancingDetails(req, res, next) {
  try {
    const { id } = req.params;
    const record = await getPOFinancingById(id);
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/trade-finance/po-financing/:id/repayment — Record a repayment */
export async function recordPORepayment(req, res, next) {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const record = await recordPORepaymentTx({ financing_id: id, amount });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-finance/currency/forward-contract — Lock exchange rate */
export async function createForwardContract(req, res, next) {
  try {
    const { from_currency, to_currency, amount, locked_rate, settlement_date } = req.body;
    const user_id = req.user.id;

    const contract = await createForwardContractRecord({ user_id, from_currency, to_currency, amount, locked_rate, settlement_date });
    res.status(201).json({ success: true, data: contract });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-finance/currency/forward-contract — List forward contracts */
export async function listForwardContracts(req, res, next) {
  try {
    const contracts = await listForwardContractRecords(req.user.id);
    res.json({ success: true, data: contracts });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-finance/currency/rate-alert — Set up a rate alert */
export async function createRateAlert(req, res, next) {
  try {
    const { from_currency, to_currency, target_rate, direction } = req.body;
    const user_id = req.user.id;

    const alert = await createRateAlertRecord({ user_id, from_currency, to_currency, target_rate, direction });
    res.status(201).json({ success: true, data: alert });
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

import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';

export async function listTransactions(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { from, to } = buildPagination(page, limit);
    const { data, error, count } = await supabase.from('transactions').select('*', { count: 'exact' })
      .eq('user_id', req.user.id).order('created_at', { ascending: false }).range(from, to);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

export async function getTransaction(req, res, next) {
  try {
    const { data, error } = await supabase.from('transactions').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Transaction not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function processPayment(req, res, next) {
  try {
    const { order_id, payment_method } = req.body;
    // TODO: integrate real payment gateway (Stripe, etc.)
    const { data: order } = await supabase.from('orders').select('total').eq('id', order_id).single();
    if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });

    const { data: txn, error } = await supabase.from('transactions').insert({
      user_id: req.user.id,
      order_id,
      type: 'payment',
      amount: order.total,
      currency: 'USD',
      status: 'completed',
      payment_method,
      payment_gateway: 'manual',
    }).select().single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    await supabase.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('id', order_id);
    res.json({ success: true, data: txn });
  } catch (err) { next(err); }
}

export async function requestRefund(req, res, next) {
  try {
    const { transaction_id, reason } = req.body;
    const { data: txn } = await supabase.from('transactions').select('*').eq('id', transaction_id).single();
    if (!txn) return res.status(404).json({ success: false, error: 'Transaction not found.' });

    const { data, error } = await supabase.from('transactions').insert({
      user_id: req.user.id,
      order_id: txn.order_id,
      type: 'refund',
      amount: txn.amount,
      currency: txn.currency,
      status: 'pending',
      payment_method: txn.payment_method,
      payment_gateway: txn.payment_gateway,
    }).select().single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'Refund request submitted.' });
  } catch (err) { next(err); }
}

export async function getPaymentMethods(req, res) {
  res.json({ success: true, data: [
    { id: 'card', name: 'Credit / Debit Card', icon: 'fas fa-credit-card' },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: 'fas fa-university' },
    { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal' },
  ] });
}

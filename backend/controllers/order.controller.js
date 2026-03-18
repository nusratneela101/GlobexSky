import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';
import { generateTrackingNumber } from '../utils/helpers.js';
import { sendOrderConfirmationEmail } from '../services/email.service.js';

/** GET /api/v1/orders */
export async function listOrders(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const { from, to } = buildPagination(page, limit);
    const role = req.user.profile?.role;

    let query = supabase
      .from('orders')
      .select('*, items:order_items(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (role === 'supplier') {
      query = query.eq('supplier_id', req.user.profile.id);
    } else {
      query = query.eq('buyer_id', req.user.id);
    }
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/v1/orders/:id */
export async function getOrder(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*, product:products(*)), address:addresses(*)')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Order not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/orders */
export async function createOrder(req, res, next) {
  try {
    const { items, shipping_address_id, payment_method, notes } = req.body;
    const buyerId = req.user.id;

    // Compute totals
    let subtotal = 0;
    const enrichedItems = [];
    for (const item of items) {
      const { data: product } = await supabase.from('products').select('price,supplier_id,title').eq('id', item.product_id).single();
      if (!product) return res.status(400).json({ success: false, error: `Product ${item.product_id} not found.` });
      const total = product.price * item.quantity;
      subtotal += total;
      enrichedItems.push({ product_id: item.product_id, variant_id: item.variant_id || null, quantity: item.quantity, unit_price: product.price, total });
    }

    const shippingFee = 15.00; // TODO: use real calculator
    const commission = +(subtotal * 0.05).toFixed(2);
    const orderTotal = subtotal + shippingFee;
    const trackingNumber = generateTrackingNumber();

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        buyer_id: buyerId,
        supplier_id: enrichedItems[0] ? (await supabase.from('products').select('supplier_id').eq('id', enrichedItems[0].product_id).single()).data?.supplier_id : null,
        status: 'pending',
        subtotal,
        shipping_fee: shippingFee,
        commission,
        total: orderTotal,
        payment_method,
        payment_status: 'pending',
        shipping_address_id,
        tracking_number: trackingNumber,
        notes,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    // Insert order items
    await supabase.from('order_items').insert(enrichedItems.map((i) => ({ ...i, order_id: order.id })));

    await sendOrderConfirmationEmail(req.user.email, order).catch(() => {});

    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/orders/:id/status */
export async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/orders/:id/cancel */
export async function cancelOrder(req, res, next) {
  try {
    const { data: order } = await supabase.from('orders').select('status').eq('id', req.params.id).single();
    if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });
    if (['shipped', 'delivered'].includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Cannot cancel an order that has been shipped or delivered.' });
    }
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/orders/:id/tracking */
export async function getOrderTracking(req, res, next) {
  try {
    const { data, error } = await supabase.from('orders').select('tracking_number,status,updated_at').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Order not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

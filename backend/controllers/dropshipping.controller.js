import supabase from '../config/supabase.js';
import { calculateMarkup } from '../services/pricing.service.js';

export async function getDashboard(req, res, next) {
  try {
    const userId = req.user?.id;

    // Count imported products
    const { count: importedProducts } = await supabase
      .from('dropshipping_imported_products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Count and aggregate orders (fetch only needed fields for aggregation)
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, total_amount, profit, status')
      .eq('order_type', 'dropship');

    const totalOrders = allOrders?.length || 0;
    const totalRevenue = (allOrders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalProfit = (allOrders || []).reduce((sum, o) => sum + (o.profit || 0), 0);

    // Connected suppliers
    const { count: connectedSuppliers } = await supabase
      .from('dropshipping_suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    // Fetch 5 most recent orders from DB directly
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, total_amount, profit, status, created_at')
      .eq('order_type', 'dropship')
      .order('created_at', { ascending: false })
      .limit(5);

    res.json({
      success: true,
      data: {
        importedProducts: importedProducts || 0,
        totalOrders,
        totalRevenue,
        totalProfit,
        connectedSuppliers: connectedSuppliers || 0,
        recentOrders: recentOrders || [],
      },
    });
  } catch (err) { next(err); }
}

export async function listDropshippingProducts(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(50);
    if (error) return res.status(400).json({ success: false, error: error.message });
    // Compute markup for each product
    const enriched = await Promise.all((data || []).map(async (p) => {
      const markup = await calculateMarkup(p.price, p.category_id);
      return { ...p, dropship_price: markup.selling_price, profit: markup.profit };
    }));
    res.json({ success: true, data: enriched });
  } catch (err) { next(err); }
}

export async function importProduct(req, res, next) {
  try {
    const { product_id, markup_percentage } = req.body;
    const userId = req.user.id;

    // Check product exists
    const { data: product } = await supabase.from('products').select('*').eq('id', product_id).single();
    if (!product) return res.status(404).json({ success: false, error: 'Product not found.' });

    // Check if already imported
    const { data: existing } = await supabase
      .from('dropshipping_imported_products')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', product_id)
      .single();
    if (existing) return res.status(409).json({ success: false, error: 'Product already imported.' });

    // Calculate markup
    let markup;
    try {
      markup = await calculateMarkup(product.price, product.category_id);
    } catch (_) {
      markup = { selling_price: product.price * 1.2, markup_percent: 20 };
    }
    const sellingPrice = markup_percentage
      ? product.price * (1 + markup_percentage / 100)
      : markup.selling_price;

    // Save to dropshipping_imported_products
    const { data: imported, error } = await supabase
      .from('dropshipping_imported_products')
      .insert({
        user_id: userId,
        product_id: product_id,
        original_price: product.price,
        selling_price: sellingPrice,
        markup_percent: markup_percentage || markup.markup_percent,
        product_name: product.name,
        product_image: product.image || (product.images?.[0] ?? null),
        category_id: product.category_id,
        supplier_id: product.supplier_id,
        status: 'active',
        imported_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: imported, message: 'Product imported to your store.' });
  } catch (err) { next(err); }
}

export async function listImportedProducts(req, res, next) {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('dropshipping_imported_products')
      .select('*')
      .eq('user_id', userId)
      .order('imported_at', { ascending: false });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

export async function removeProduct(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { error } = await supabase
      .from('dropshipping_imported_products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Product removed from your store.' });
  } catch (err) { next(err); }
}

export async function updatePricing(req, res, next) {
  try {
    const { id } = req.params;
    const { selling_price, markup_percent } = req.body;
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('dropshipping_imported_products')
      .update({ selling_price, markup_percent, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getDropshipOrders(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('order_type', 'dropship')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [], total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
}

export async function routeOrderToSupplier(req, res, next) {
  try {
    const { order_id } = req.params;
    const { supplier_id } = req.body;
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();
    if (fetchErr || !order) return res.status(404).json({ success: false, error: 'Order not found.' });
    const { data, error } = await supabase
      .from('orders')
      .update({ supplier_id, status: 'processing', routed_at: new Date().toISOString() })
      .eq('id', order_id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, message: 'Order routed to supplier.' });
  } catch (err) { next(err); }
}

export async function getAnalytics(req, res, next) {
  try {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id,total_amount,profit,created_at,status')
      .eq('order_type', 'dropship')
      .gte('created_at', since);
    if (error) return res.status(400).json({ success: false, error: error.message });
    const totalRevenue = (orders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalProfit = (orders || []).reduce((sum, o) => sum + (o.profit || 0), 0);
    const totalOrders = (orders || []).length;
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0.00';
    res.json({
      success: true,
      data: {
        period,
        total_revenue: totalRevenue,
        total_profit: totalProfit,
        total_orders: totalOrders,
        profit_margin: profitMargin,
        orders: orders || [],
      },
    });
  } catch (err) { next(err); }
}

export async function getConnectedSuppliers(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('dropshipping_suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

export async function updateSettings(req, res, next) {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('dropshipping_settings')
      .upsert({ user_id: userId, ...req.body, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getMarkupSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('dropshipping_markup').select('*').eq('is_active', true);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateMarkupSettings(req, res, next) {
  try {
    const { data, error } = await supabase.from('dropshipping_markup').upsert(req.body, { onConflict: 'id' }).select().single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getInventorySync(req, res, next) {
  try {
    const { data, error } = await supabase.from('products').select('id,title,stock,updated_at').eq('status', 'active');
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function syncInventory(req, res, next) {
  try {
    const userId = req.user.id;

    // Get all imported products for this user
    const { data: imported } = await supabase
      .from('dropshipping_imported_products')
      .select('id, product_id')
      .eq('user_id', userId);

    if (!imported?.length) return res.json({ success: true, data: { synced: 0, updated: 0 } });

    // Check each product's current status/price in source
    const productIds = imported.map(p => p.product_id);
    const { data: sourceProducts } = await supabase
      .from('products')
      .select('id, price, status, stock_quantity')
      .in('id', productIds);

    let updated = 0;
    for (const source of (sourceProducts || [])) {
      const imp = imported.find(i => i.product_id === source.id);
      if (imp) {
        await supabase
          .from('dropshipping_imported_products')
          .update({
            original_price: source.price,
            source_status: source.status,
            source_stock: source.stock_quantity,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', imp.id);
        updated++;
      }
    }

    res.json({ success: true, data: { synced: imported.length, updated } });
  } catch (err) { next(err); }
}

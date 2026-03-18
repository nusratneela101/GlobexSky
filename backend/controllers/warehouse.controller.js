import supabase from '../config/supabase.js';
import { buildPagination } from '../utils/pagination.js';
import {
  checkCapacity,
  recalculateStock,
  transferInventory as doTransfer,
} from '../services/warehouse.service.js';

/* ──────────────────────────────────────────────
   WAREHOUSE CRUD
   ────────────────────────────────────────────── */

/** POST /api/v1/warehouses */
export async function createWarehouse(req, res, next) {
  try {
    const { name, location, country, capacity, manager_id, notes } = req.body;
    const { data, error } = await supabase
      .from('warehouses')
      .insert({ name, location, country, capacity, manager_id: manager_id || null, notes: notes || null, current_stock: 0 })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/warehouses */
export async function getWarehouses(req, res, next) {
  try {
    const { page = 1, limit = 20, country, search } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('warehouses')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (country) query = query.eq('country', country);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** GET /api/v1/warehouses/:id */
export async function getWarehouseById(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Warehouse not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/warehouses/:id */
export async function updateWarehouse(req, res, next) {
  try {
    const allowed = ['name', 'location', 'country', 'capacity', 'manager_id', 'notes', 'is_active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('warehouses')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/warehouses/:id */
export async function deleteWarehouse(req, res, next) {
  try {
    const { error } = await supabase
      .from('warehouses')
      .delete()
      .eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Warehouse deleted.' });
  } catch (err) { next(err); }
}

/* ──────────────────────────────────────────────
   INVENTORY
   ────────────────────────────────────────────── */

/** GET /api/v1/warehouses/:id/inventory */
export async function getWarehouseInventory(req, res, next) {
  try {
    const { page = 1, limit = 20, search, low_stock } = req.query;
    const { from, to } = buildPagination(page, limit);

    let query = supabase
      .from('inventory_items')
      .select('*, product:products(id,title,sku,price,category_id)', { count: 'exact' })
      .eq('warehouse_id', req.params.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) query = query.ilike('sku', `%${search}%`);
    if (low_stock === 'true') query = query.lte('quantity', supabase.raw('reorder_level'));

    const { data, error, count } = await query;
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
}

/** POST /api/v1/warehouses/:id/inventory */
export async function addInventoryItem(req, res, next) {
  try {
    const { product_id, quantity, sku, reorder_level = 10, unit_cost } = req.body;
    const warehouseId = req.params.id;

    const cap = await checkCapacity(warehouseId, quantity);
    if (!cap.available) return res.status(400).json({ success: false, error: cap.error });

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({ warehouse_id: warehouseId, product_id, quantity, sku: sku || null, reorder_level, unit_cost: unit_cost || null })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await recalculateStock(warehouseId);

    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/warehouses/:id/inventory/:itemId */
export async function updateInventoryItem(req, res, next) {
  try {
    const { quantity, reorder_level, sku, unit_cost } = req.body;
    const warehouseId = req.params.id;

    const updates = { updated_at: new Date().toISOString() };
    if (quantity !== undefined) updates.quantity = quantity;
    if (reorder_level !== undefined) updates.reorder_level = reorder_level;
    if (sku !== undefined) updates.sku = sku;
    if (unit_cost !== undefined) updates.unit_cost = unit_cost;

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', req.params.itemId)
      .eq('warehouse_id', warehouseId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await recalculateStock(warehouseId);

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/warehouses/transfer */
export async function transferInventory(req, res, next) {
  try {
    const { source_warehouse_id, destination_warehouse_id, product_id, quantity } = req.body;

    const result = await doTransfer({
      sourceWarehouseId: source_warehouse_id,
      destinationWarehouseId: destination_warehouse_id,
      productId: product_id,
      quantity,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message.includes('Insufficient') || err.message.includes('not found')) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
}

import supabase from '../config/supabase.js';

/**
 * Check whether a warehouse has sufficient remaining capacity.
 */
export async function checkCapacity(warehouseId, additionalUnits = 0) {
  const { data, error } = await supabase
    .from('warehouses')
    .select('capacity, current_stock')
    .eq('id', warehouseId)
    .single();

  if (error || !data) return { available: false, error: 'Warehouse not found.' };

  const remaining = data.capacity - (data.current_stock || 0);
  if (additionalUnits > remaining) {
    return { available: false, remaining, error: `Insufficient capacity. Available: ${remaining} units.` };
  }
  return { available: true, remaining };
}

/**
 * Update the aggregate current_stock on a warehouse row.
 */
export async function recalculateStock(warehouseId) {
  const { data: items, error } = await supabase
    .from('inventory_items')
    .select('quantity')
    .eq('warehouse_id', warehouseId);

  if (error) throw new Error(error.message);

  const total = (items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);

  await supabase
    .from('warehouses')
    .update({ current_stock: total, updated_at: new Date().toISOString() })
    .eq('id', warehouseId);

  return total;
}

/**
 * Transfer inventory between two warehouses.
 * Returns an object with the updated source and destination inventory items.
 */
export async function transferInventory({ sourceWarehouseId, destinationWarehouseId, productId, quantity }) {
  // Fetch source item
  const { data: sourceItem, error: srcErr } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('warehouse_id', sourceWarehouseId)
    .eq('product_id', productId)
    .maybeSingle();

  if (srcErr) throw new Error(srcErr.message);
  if (!sourceItem) throw new Error('Product not found in source warehouse.');
  if (sourceItem.quantity < quantity) throw new Error(`Insufficient stock. Available: ${sourceItem.quantity} units.`);

  // Check destination capacity
  const capacity = await checkCapacity(destinationWarehouseId, quantity);
  if (!capacity.available) throw new Error(capacity.error);

  // Deduct from source
  const newSourceQty = sourceItem.quantity - quantity;
  const { error: srcUpdateErr } = await supabase
    .from('inventory_items')
    .update({ quantity: newSourceQty, updated_at: new Date().toISOString() })
    .eq('id', sourceItem.id);
  if (srcUpdateErr) throw new Error(srcUpdateErr.message);

  // Upsert into destination
  const { data: destItem, error: destFetchErr } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('warehouse_id', destinationWarehouseId)
    .eq('product_id', productId)
    .maybeSingle();

  if (destFetchErr) throw new Error(destFetchErr.message);

  let updatedDest;
  if (destItem) {
    const { data, error: destUpdateErr } = await supabase
      .from('inventory_items')
      .update({ quantity: destItem.quantity + quantity, updated_at: new Date().toISOString() })
      .eq('id', destItem.id)
      .select()
      .single();
    if (destUpdateErr) throw new Error(destUpdateErr.message);
    updatedDest = data;
  } else {
    const { data, error: destInsertErr } = await supabase
      .from('inventory_items')
      .insert({
        warehouse_id: destinationWarehouseId,
        product_id: productId,
        quantity,
        reorder_level: sourceItem.reorder_level || 0,
        sku: sourceItem.sku || null,
      })
      .select()
      .single();
    if (destInsertErr) throw new Error(destInsertErr.message);
    updatedDest = data;
  }

  // Recalculate stock totals
  await Promise.all([
    recalculateStock(sourceWarehouseId),
    recalculateStock(destinationWarehouseId),
  ]);

  // Record transfer log
  await supabase.from('inventory_transfers').insert({
    source_warehouse_id: sourceWarehouseId,
    destination_warehouse_id: destinationWarehouseId,
    product_id: productId,
    quantity,
    transferred_at: new Date().toISOString(),
  }).catch(() => {});

  return {
    source: { ...sourceItem, quantity: newSourceQty },
    destination: updatedDest,
  };
}

/**
 * Return all inventory items below their reorder_level for a given warehouse (or all warehouses).
 */
export async function getLowStockAlerts(warehouseId = null) {
  let query = supabase
    .from('inventory_items')
    .select('*, product:products(title, sku), warehouse:warehouses(name)')
    .filter('quantity', 'lte', supabase.raw('reorder_level'));

  if (warehouseId) query = query.eq('warehouse_id', warehouseId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

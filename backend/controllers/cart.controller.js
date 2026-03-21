import supabase from '../config/supabase.js';

/** GET /api/v1/cart — Get the authenticated user's active cart */
export async function getCart(req, res, next) {
  try {
    const userId = req.user.id;

    // Find or create cart
    let { data: cart, error } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (error || !cart) {
      const { data: newCart, error: createErr } = await supabase
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();
      if (createErr) return res.status(400).json({ success: false, error: createErr.message });
      cart = newCart;
    }

    const { data: items, error: itemsErr } = await supabase
      .from('cart_items')
      .select('*, product:products(id,title,images,price,moq,supplier_id)')
      .eq('cart_id', cart.id)
      .eq('saved_for_later', false)
      .order('created_at', { ascending: true });

    if (itemsErr) return res.status(400).json({ success: false, error: itemsErr.message });

    res.json({ success: true, data: { cart_id: cart.id, items: items || [] } });
  } catch (err) { next(err); }
}

/** POST /api/v1/cart/add — Add item to cart */
export async function addToCart(req, res, next) {
  try {
    const userId = req.user.id;
    const { product_id, quantity, supplier_id } = req.body;

    // Fetch product for price and MOQ
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id,price,moq,supplier_id')
      .eq('id', product_id)
      .single();
    if (productErr || !product) {
      return res.status(404).json({ success: false, error: 'Product not found.' });
    }

    const moq = product.moq || 1;
    const qty = Math.max(parseInt(quantity, 10) || moq, moq);

    // Find or create cart
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cart) {
      const { data: newCart, error: createErr } = await supabase
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();
      if (createErr) return res.status(400).json({ success: false, error: createErr.message });
      cart = newCart;
    }

    // Check if item already exists
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id,quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', product_id)
      .eq('saved_for_later', false)
      .single();

    let data, error;
    if (existing) {
      ({ data, error } = await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + qty })
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          product_id,
          supplier_id: supplier_id || product.supplier_id,
          quantity: qty,
          unit_price: product.price,
          saved_for_later: false,
        })
        .select()
        .single());
    }

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/cart/update/:itemId — Update cart item quantity */
export async function updateCartItem(req, res, next) {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, error: 'Quantity must be a positive integer.' });
    }

    // Verify item belongs to user's cart
    const { data: item } = await supabase
      .from('cart_items')
      .select('id, cart_id, product:products(moq)')
      .eq('id', itemId)
      .single();

    if (!item) return res.status(404).json({ success: false, error: 'Cart item not found.' });

    const { data: cart } = await supabase
      .from('carts')
      .select('user_id')
      .eq('id', item.cart_id)
      .single();

    if (!cart || cart.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }

    const moq = item.product?.moq || 1;
    const safeQty = Math.max(qty, moq);

    const { data, error } = await supabase
      .from('cart_items')
      .update({ quantity: safeQty })
      .eq('id', itemId)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/cart/remove/:itemId — Remove item from cart */
export async function removeCartItem(req, res, next) {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const { data: item } = await supabase
      .from('cart_items')
      .select('id, cart_id')
      .eq('id', itemId)
      .single();

    if (!item) return res.status(404).json({ success: false, error: 'Cart item not found.' });

    const { data: cart } = await supabase
      .from('carts')
      .select('user_id')
      .eq('id', item.cart_id)
      .single();

    if (!cart || cart.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }

    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Item removed from cart.' });
  } catch (err) { next(err); }
}

/** POST /api/v1/cart/save-for-later/:itemId — Move item to saved list */
export async function saveForLater(req, res, next) {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const { data: item } = await supabase
      .from('cart_items')
      .select('id, cart_id')
      .eq('id', itemId)
      .single();

    if (!item) return res.status(404).json({ success: false, error: 'Cart item not found.' });

    const { data: cart } = await supabase
      .from('carts')
      .select('user_id')
      .eq('id', item.cart_id)
      .single();

    if (!cart || cart.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden.' });
    }

    const { data, error } = await supabase
      .from('cart_items')
      .update({ saved_for_later: true })
      .eq('id', itemId)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** POST /api/v1/cart/apply-coupon — Validate and apply a coupon code */
export async function applyCoupon(req, res, next) {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Coupon code is required.' });

    const now = new Date().toISOString();
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !coupon) {
      return res.status(404).json({ success: false, error: 'Invalid or expired coupon code.' });
    }

    if (coupon.valid_from && coupon.valid_from > now) {
      return res.status(400).json({ success: false, error: 'Coupon is not yet active.' });
    }
    if (coupon.valid_to && coupon.valid_to < now) {
      return res.status(400).json({ success: false, error: 'Coupon has expired.' });
    }
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ success: false, error: 'Coupon usage limit reached.' });
    }
    if (coupon.min_order && subtotal < coupon.min_order) {
      return res.status(400).json({
        success: false,
        error: `Minimum order of $${coupon.min_order.toFixed(2)} required for this coupon.`,
      });
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (subtotal * coupon.discount_value) / 100;
      if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
    } else {
      discount = Math.min(coupon.discount_value, subtotal);
    }

    res.json({
      success: true,
      data: {
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: +discount.toFixed(2),
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/v1/cart/saved — Get saved-for-later items */
export async function getSavedItems(req, res, next) {
  try {
    const userId = req.user.id;

    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cart) return res.json({ success: true, data: [] });

    const { data: items, error } = await supabase
      .from('cart_items')
      .select('*, product:products(id,title,images,price,moq)')
      .eq('cart_id', cart.id)
      .eq('saved_for_later', true)
      .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: items || [] });
  } catch (err) { next(err); }
}

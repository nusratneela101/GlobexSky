import supabase from '../config/supabase.js';

/** GET /api/v1/wishlist — List wishlist items for authenticated user */
export async function listWishlist(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select('*, product:products(id,title,images,price,moq,supplier_id)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** POST /api/v1/wishlist — Add a product to wishlist */
export async function addToWishlist(req, res, next) {
  try {
    const userId = req.user.id;
    const { product_id } = req.body;

    // Check if product exists
    const { data: product } = await supabase
      .from('products')
      .select('id,price')
      .eq('id', product_id)
      .single();

    if (!product) return res.status(404).json({ success: false, error: 'Product not found.' });

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', product_id)
      .single();

    if (existing) {
      return res.status(409).json({ success: false, error: 'Product already in wishlist.' });
    }

    const { data, error } = await supabase
      .from('wishlists')
      .insert({ user_id: userId, product_id })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/wishlist/:productId — Remove product from wishlist */
export async function removeFromWishlist(req, res, next) {
  try {
    const { data: existing } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('product_id', req.params.productId)
      .single();

    if (!existing) return res.status(404).json({ success: false, error: 'Wishlist item not found.' });

    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', req.user.id)
      .eq('product_id', req.params.productId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Item removed from wishlist.' });
  } catch (err) { next(err); }
}

/** POST /api/v1/wishlist/:productId/move-to-cart — Move wishlist item to cart */
export async function moveToCart(req, res, next) {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { quantity } = req.body;

    const { data: wishItem } = await supabase
      .from('wishlists')
      .select('product_id, product:products(id,price,moq,supplier_id)')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (!wishItem) return res.status(404).json({ success: false, error: 'Wishlist item not found.' });

    const product = wishItem.product;
    const moq = product?.moq || 1;
    const qty = Math.max(parseInt(quantity, 10) || moq, moq);

    // Find or create cart
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cart) {
      const { data: newCart } = await supabase
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();
      cart = newCart;
    }

    // Add to cart
    const { data: existingCartItem } = await supabase
      .from('cart_items')
      .select('id,quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', productId)
      .eq('saved_for_later', false)
      .single();

    if (existingCartItem) {
      await supabase
        .from('cart_items')
        .update({ quantity: existingCartItem.quantity + qty })
        .eq('id', existingCartItem.id);
    } else {
      await supabase.from('cart_items').insert({
        cart_id: cart.id,
        product_id: productId,
        supplier_id: product?.supplier_id,
        quantity: qty,
        unit_price: product?.price || 0,
        saved_for_later: false,
      });
    }

    // Remove from wishlist
    await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    res.json({ success: true, message: 'Item moved to cart.' });
  } catch (err) { next(err); }
}

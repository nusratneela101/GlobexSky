import BaseModel from './BaseModel.js';

/**
 * Cart model
 *
 * Table: carts
 * Fields: id, user_id, session_id, status, created_at, updated_at
 *
 * Related table: cart_items
 * Fields: id, cart_id, product_id, quantity, price, variant, created_at
 */
export default class Cart extends BaseModel {
  static get tableName() {
    return 'carts';
  }

  /**
   * Find all carts belonging to a user.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByUser(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find the active cart for a user.
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  static async findActive(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Find a cart with its items joined.
   * @param {string} cartId
   * @returns {Promise<object|null>}
   */
  static async getWithItems(cartId) {
    const result = await this.db
      .from(this.tableName)
      .select('*, cart_items(*)')
      .eq('id', cartId)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Add an item to a cart, or increment quantity if it already exists.
   * @param {string} cartId
   * @param {object} item - { product_id, quantity, price, variant }
   * @returns {Promise<object>}
   */
  static async addItem(cartId, item) {
    const existing = await this._handle(
      await this.db
        .from('cart_items')
        .select('*')
        .eq('cart_id', cartId)
        .eq('product_id', item.product_id)
        .maybeSingle()
    );

    if (existing) {
      const result = await this.db
        .from('cart_items')
        .update({ quantity: existing.quantity + (item.quantity ?? 1) })
        .eq('id', existing.id)
        .select()
        .single();
      return this._handle(result);
    }

    const result = await this.db
      .from('cart_items')
      .insert({ cart_id: cartId, ...item })
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Remove an item from a cart.
   * @param {string} cartItemId
   * @returns {Promise<null>}
   */
  static async removeItem(cartItemId) {
    const result = await this.db
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);
    return this._handle(result);
  }

  /**
   * Update the quantity of a cart item.
   * @param {string} cartItemId
   * @param {number} quantity
   * @returns {Promise<object>}
   */
  static async updateItemQuantity(cartItemId, quantity) {
    const result = await this.db
      .from('cart_items')
      .update({ quantity })
      .eq('id', cartItemId)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Clear all items from a cart.
   * @param {string} cartId
   * @returns {Promise<null>}
   */
  static async clearItems(cartId) {
    const result = await this.db
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId);
    return this._handle(result);
  }
}

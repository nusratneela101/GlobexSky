import BaseModel from './BaseModel.js';

/**
 * Wishlist model
 *
 * Table: wishlists
 * Fields: id, user_id, name, is_default, is_public, share_token, items,
 *         created_at, updated_at
 */
export default class Wishlist extends BaseModel {
  static get tableName() {
    return 'wishlists';
  }

  /**
   * Find all wishlists belonging to a user.
   * @param {string} userId
   * @returns {Promise<object[]>}
   */
  static async findByUser(userId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });
    return this._handle(result);
  }

  /**
   * Find a wishlist by its public share token.
   * @param {string} shareToken
   * @returns {Promise<object|null>}
   */
  static async findByShareToken(shareToken) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('share_token', shareToken)
      .eq('is_public', true)
      .maybeSingle();
    return this._handle(result);
  }

  /**
   * Add an item to a wishlist.
   * @param {string} id
   * @param {object} item
   * @returns {Promise<object>}
   */
  static async addItem(id, item) {
    const wishlist = await this.findById(id);
    if (!wishlist) throw new Error(`Wishlist ${id} not found`);

    const items = Array.isArray(wishlist.items) ? wishlist.items : [];
    const alreadyExists = items.some((i) => i.product_id === item.product_id);
    if (alreadyExists) return wishlist;

    items.push({ ...item, added_at: new Date().toISOString() });

    const result = await this.db
      .from(this.tableName)
      .update({ items, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  /**
   * Remove an item from a wishlist by product_id.
   * @param {string} id
   * @param {string} productId
   * @returns {Promise<object>}
   */
  static async removeItem(id, productId) {
    const wishlist = await this.findById(id);
    if (!wishlist) throw new Error(`Wishlist ${id} not found`);

    const items = (Array.isArray(wishlist.items) ? wishlist.items : []).filter(
      (i) => i.product_id !== productId
    );

    const result = await this.db
      .from(this.tableName)
      .update({ items, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }
}

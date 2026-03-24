import BaseModel from './BaseModel.js';

/**
 * TradeShow model
 *
 * Table: trade_shows
 * Fields: id, organizer_id, title, description, start_date, end_date,
 *         type, booth_price, max_booths, booths_sold, status,
 *         banner_image, created_at, updated_at
 */
export default class TradeShow extends BaseModel {
  static get tableName() {
    return 'trade_shows';
  }

  /**
   * Find all upcoming trade shows (status = 'upcoming').
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findUpcoming(options = {}) {
    return this.findAll({
      ...options,
      filters: { ...options.filters, status: 'upcoming' },
      orderBy: 'start_date',
      ascending: true,
    });
  }

  /**
   * Find all currently live trade shows (status = 'live').
   * @param {object} [options] - pagination options
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
   */
  static async findLive(options = {}) {
    return this.findAll({
      ...options,
      filters: { ...options.filters, status: 'live' },
      orderBy: 'start_date',
      ascending: true,
    });
  }

  /**
   * Register a booth for a trade show (increment booths_sold).
   * @param {string} id
   * @param {object} [boothData] - additional booth registration details
   * @returns {Promise<object>} updated trade show
   */
  static async registerBooth(id, boothData = {}) {
    const show = await this.findById(id);
    if (!show) throw new Error(`TradeShow ${id} not found`);
    if (show.booths_sold >= show.max_booths) {
      throw new Error('No booths available for this trade show');
    }

    const result = await this.db
      .from(this.tableName)
      .update({
        booths_sold: (show.booths_sold || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }
}

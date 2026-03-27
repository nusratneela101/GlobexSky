import BaseModel from './BaseModel.js';

/**
 * FreightBooking model
 *
 * Table: freight_bookings
 * Fields: id, booking_reference, shipper_id, consignee_id, freight_type,
 *         container_id, origin, destination, cargo_description, weight_kg,
 *         volume_cbm, incoterms, estimated_cost, actual_cost, status,
 *         pickup_date, delivery_date, tracking_events, metadata,
 *         created_at, updated_at
 */
export default class FreightBooking extends BaseModel {
  static get tableName() {
    return 'freight_bookings';
  }

  static async findByShipper(shipperId, page = 1, limit = 20) {
    return this.findAll({ page, limit, filters: { shipper_id: shipperId }, orderBy: 'created_at' });
  }

  static async addTrackingEvent(id, event) {
    const existing = await this.findById(id);
    const events = existing?.tracking_events || [];
    events.push({ ...event, timestamp: new Date().toISOString() });
    const result = await this.db
      .from(this.tableName)
      .update({ tracking_events: events, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  static async updateStatus(id, status) {
    const result = await this.db
      .from(this.tableName)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }
}

import BaseModel from './BaseModel.js';

/**
 * Container model
 *
 * Table: containers
 * Fields: id, container_number, type, size, status, origin_port, destination_port,
 *         carrier, vessel_name, voyage_number, eta, etd, current_location,
 *         booking_reference, supplier_id, buyer_id, metadata, created_at, updated_at
 */
export default class Container extends BaseModel {
  static get tableName() {
    return 'containers';
  }

  static async findByContainerNumber(containerNumber) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('container_number', containerNumber.toUpperCase())
      .maybeSingle();
    return this._handle(result);
  }

  static async findByBookingReference(ref) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('booking_reference', ref)
      .order('created_at', { ascending: false });
    return this._handle(result);
  }

  static async updateStatus(id, status, currentLocation = null) {
    const update = { status, updated_at: new Date().toISOString() };
    if (currentLocation) update.current_location = currentLocation;
    const result = await this.db
      .from(this.tableName)
      .update(update)
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }
}

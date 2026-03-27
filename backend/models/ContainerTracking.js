import BaseModel from './BaseModel.js';

/**
 * ContainerTracking model
 *
 * Table: container_tracking
 * Fields: id, shipment_id, location, status, timestamp, description,
 *         lat, lng, created_at
 */
export default class ContainerTracking extends BaseModel {
  static get tableName() {
    return 'container_tracking';
  }

  static async findByShipmentId(shipmentId) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('timestamp', { ascending: true });
    return this._handle(result);
  }

  static async addEvent(shipmentId, event) {
    const result = await this.db
      .from(this.tableName)
      .insert({
        shipment_id: shipmentId,
        location: event.location,
        status: event.status,
        timestamp: event.timestamp || new Date().toISOString(),
        description: event.description,
        lat: event.lat ?? null,
        lng: event.lng ?? null,
      })
      .select()
      .single();
    return this._handle(result);
  }
}

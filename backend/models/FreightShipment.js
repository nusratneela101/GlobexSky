import BaseModel from './BaseModel.js';

/**
 * FreightShipment model
 *
 * Table: freight_shipments
 * Fields: id, order_id, container_number, bill_of_lading, carrier_name,
 *         origin_port, destination_port, departure_date, estimated_arrival,
 *         actual_arrival, status, tracking_updates, freight_type,
 *         weight, volume, customs_status, documents, created_at, updated_at
 */
export default class FreightShipment extends BaseModel {
  static get tableName() {
    return 'freight_shipments';
  }

  static async findByContainerNumber(containerNumber) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('container_number', containerNumber.toUpperCase())
      .maybeSingle();
    return this._handle(result);
  }

  static async findByBillOfLading(bol) {
    const result = await this.db
      .from(this.tableName)
      .select('*')
      .eq('bill_of_lading', bol)
      .maybeSingle();
    return this._handle(result);
  }

  static async addTrackingUpdate(id, update) {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Shipment not found');
    const updates = existing.tracking_updates || [];
    updates.push({ ...update, timestamp: new Date().toISOString() });
    const result = await this.db
      .from(this.tableName)
      .update({ tracking_updates: updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  static async addDocument(id, doc) {
    const existing = await this.findById(id);
    if (!existing) throw new Error('Shipment not found');
    const documents = existing.documents || [];
    documents.push({ ...doc, uploaded_at: new Date().toISOString() });
    const result = await this.db
      .from(this.tableName)
      .update({ documents, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return this._handle(result);
  }

  static async getDashboardSummary() {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('status, freight_type, created_at');
    if (error) throw error;

    const rows = data || [];
    const byStatus = rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    const byType = rows.reduce((acc, r) => {
      acc[r.freight_type] = (acc[r.freight_type] || 0) + 1;
      return acc;
    }, {});

    return {
      total: rows.length,
      by_status: byStatus,
      by_freight_type: byType,
    };
  }
}

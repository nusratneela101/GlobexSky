import BaseModel from './BaseModel.js';

/**
 * BarcodeProduct model
 *
 * Table: barcode_products
 * Fields: id, barcode, barcode_type, product_id, name, description,
 *         metadata, created_at, updated_at
 */
export default class BarcodeProduct extends BaseModel {
  static get tableName() {
    return 'barcode_products';
  }

  static async findByBarcode(barcode) {
    const result = await this.db
      .from(this.tableName)
      .select('*, products(*)')
      .eq('barcode', barcode)
      .maybeSingle();
    return this._handle(result);
  }

  static async findManyByCodes(codes) {
    const result = await this.db
      .from(this.tableName)
      .select('*, products(*)')
      .in('barcode', codes);
    return this._handle(result);
  }
}

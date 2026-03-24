import mongoose from 'mongoose';

const modifiersSchema = new mongoose.Schema(
  {
    rushDelivery: { type: Number, default: 0 },
    fragile: { type: Number, default: 0 },
    peakSeason: { type: Number, default: 0 },
  },
  { _id: false }
);

const bulkDiscountSchema = new mongoose.Schema(
  {
    minQuantity: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const pricingSettingSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      enum: ['carry', 'parcel', 'dropshipping'],
      required: true,
    },
    category: { type: String, trim: true },
    rates: { type: Map, of: Number },
    modifiers: { type: modifiersSchema, default: () => ({}) },
    bulkDiscounts: { type: [bulkDiscountSchema], default: [] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true }
);

pricingSettingSchema.index({ module: 1 });
pricingSettingSchema.index({ status: 1 });

const PricingSetting = mongoose.model('PricingSetting', pricingSettingSchema);
export default PricingSetting;

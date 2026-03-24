import mongoose from 'mongoose';

const categoryRateSchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    rate: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const orderValueTierSchema = new mongoose.Schema(
  {
    minValue: { type: Number, required: true, min: 0 },
    maxValue: { type: Number },
    rate: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const commissionSettingSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['product_sourcing', 'carry', 'parcel', 'api'],
      required: true,
      unique: true,
    },
    defaultRate: { type: Number, required: true, min: 0, max: 100 },
    categoryRates: { type: [categoryRateSchema], default: [] },
    orderValueTiers: { type: [orderValueTierSchema], default: [] },
    minimumCommission: { type: Number, default: 0, min: 0 },
    maximumCap: { type: Number },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

commissionSettingSchema.index({ type: 1 });
commissionSettingSchema.index({ status: 1 });

const CommissionSetting = mongoose.model('CommissionSetting', commissionSettingSchema);
export default CommissionSetting;

import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema(
  {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
  },
  { _id: false }
);

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['flash_sale', 'seasonal', 'clearance', 'bundle', 'voucher'],
      required: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed_amount', 'free_shipping'],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    quantityLimit: { type: Number },
    banner: { type: String },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'expired', 'cancelled'],
      default: 'draft',
    },
    analytics: { type: analyticsSchema, default: () => ({}) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    minimumOrderValue: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

campaignSchema.index({ status: 1 });
campaignSchema.index({ startDate: 1, endDate: 1 });
campaignSchema.index({ type: 1 });

const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;

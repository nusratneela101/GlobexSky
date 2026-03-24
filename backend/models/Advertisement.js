import mongoose from 'mongoose';

const adPricingSchema = new mongoose.Schema(
  {
    cost: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 1 },
    bidAmount: { type: Number, min: 0 },
    currency: { type: String, default: 'USD' },
  },
  { _id: false }
);

const adContentSchema = new mongoose.Schema(
  {
    image: { type: String },
    link: { type: String },
    text: { type: String },
    title: { type: String },
    description: { type: String },
  },
  { _id: false }
);

const advertisementSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['featured', 'banner', 'sponsored', 'email'],
      required: true,
    },
    position: { type: String, enum: ['homepage', 'category', 'search', 'sidebar', 'footer'] },
    pricing: { type: adPricingSchema, required: true },
    content: { type: adContentSchema },
    status: {
      type: String,
      enum: ['pending', 'active', 'paused', 'expired', 'rejected'],
      default: 'pending',
    },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    targetCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    targetCountries: [{ type: String }],
  },
  { timestamps: true }
);

advertisementSchema.index({ supplierId: 1 });
advertisementSchema.index({ status: 1 });
advertisementSchema.index({ startDate: 1, endDate: 1 });
advertisementSchema.index({ type: 1 });

const Advertisement = mongoose.model('Advertisement', advertisementSchema);
export default Advertisement;

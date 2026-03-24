import mongoose from 'mongoose';

const boothSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    boothType: {
      type: String,
      enum: ['standard', 'premium', 'platinum', 'virtual_3d'],
      default: 'standard',
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    status: {
      type: String,
      enum: ['pending', 'approved', 'active', 'rejected'],
      default: 'pending',
    },
    boothNumber: { type: String },
    description: { type: String },
  },
  { _id: true }
);

const registrationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['visitor', 'exhibitor', 'speaker'], default: 'visitor' },
    registeredAt: { type: Date, default: Date.now },
    ticketType: { type: String, enum: ['free', 'paid'], default: 'free' },
    amountPaid: { type: Number, default: 0 },
  },
  { _id: false }
);

const tradeshowPricingSchema = new mongoose.Schema(
  {
    standard: { type: Number, default: 0 },
    premium: { type: Number, default: 0 },
    platinum: { type: Number, default: 0 },
    visitor: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  { _id: false }
);

const tradeShowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['virtual', 'physical', 'hybrid'],
      required: true,
    },
    description: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    location: { type: String },
    booths: { type: [boothSchema], default: [] },
    registrations: { type: [registrationSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
      default: 'draft',
    },
    pricing: { type: tradeshowPricingSchema, default: () => ({}) },
    banner: { type: String },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    maxExhibitors: { type: Number },
    maxVisitors: { type: Number },
  },
  { timestamps: true }
);

tradeShowSchema.index({ status: 1 });
tradeShowSchema.index({ startDate: 1, endDate: 1 });
tradeShowSchema.index({ type: 1 });

const TradeShow = mongoose.model('TradeShow', tradeShowSchema);
export default TradeShow;

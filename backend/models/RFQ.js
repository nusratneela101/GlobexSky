import mongoose from 'mongoose';

const quotationSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    price: { type: Number, required: true, min: 0 },
    moq: { type: Number, required: true, min: 1 },
    leadTime: { type: String },
    notes: { type: String },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'countered'],
      default: 'pending',
    },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const rfqSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    quantity: { type: Number, required: true, min: 1 },
    budget: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: { type: String, default: 'USD' },
    },
    attachments: [{ type: String }],
    quotations: { type: [quotationSchema], default: [] },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'closed', 'cancelled', 'awarded'],
      default: 'open',
    },
    deadline: { type: Date },
    targetCountries: [{ type: String }],
    targetSupplierLevel: [{ type: String, enum: ['free', 'basic', 'gold', 'platinum', 'diamond'] }],
  },
  { timestamps: true }
);

rfqSchema.index({ buyerId: 1 });
rfqSchema.index({ status: 1 });
rfqSchema.index({ category: 1 });
rfqSchema.index({ deadline: 1 });

const RFQ = mongoose.model('RFQ', rfqSchema);
export default RFQ;

import mongoose from 'mongoose';

const dropshipProductSchema = new mongoose.Schema(
  {
    originalProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    source: {
      type: String,
      enum: ['alibaba', '1688', 'aliexpress', 'other'],
      required: true,
    },
    sourceUrl: { type: String, required: true },
    sourcePrice: { type: Number, required: true, min: 0 },
    markup: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    syncStatus: {
      type: String,
      enum: ['synced', 'out_of_sync', 'error', 'pending'],
      default: 'pending',
    },
    lastSynced: { type: Date },
    inventory: { type: Number, default: 0, min: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    images: [{ type: String }],
    description: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    weight: { type: Number, min: 0 },
    shippingTime: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

dropshipProductSchema.index({ supplier: 1 });
dropshipProductSchema.index({ source: 1 });
dropshipProductSchema.index({ syncStatus: 1 });
dropshipProductSchema.index({ isActive: 1 });

const DropshipProduct = mongoose.model('DropshipProduct', dropshipProductSchema);
export default DropshipProduct;

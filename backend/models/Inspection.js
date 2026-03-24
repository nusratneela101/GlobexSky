import mongoose from 'mongoose';

const findingSchema = new mongoose.Schema(
  {
    category: { type: String },
    severity: { type: String, enum: ['critical', 'major', 'minor', 'observation'] },
    description: { type: String, required: true },
    location: { type: String },
    recommendation: { type: String },
  },
  { _id: true }
);

const inspectionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['pre_production', 'during_production', 'pre_shipment', 'full_audit'],
      required: true,
    },
    inspector: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scheduledDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'failed'],
      default: 'pending',
    },
    findings: { type: [findingSchema], default: [] },
    photos: [{ type: String }],
    videos: [{ type: String }],
    report: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    price: { type: Number, required: true, min: 0 },
    rushFee: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

inspectionSchema.index({ orderId: 1 });
inspectionSchema.index({ buyerId: 1 });
inspectionSchema.index({ supplierId: 1 });
inspectionSchema.index({ status: 1 });
inspectionSchema.index({ scheduledDate: 1 });

const Inspection = mongoose.model('Inspection', inspectionSchema);
export default Inspection;

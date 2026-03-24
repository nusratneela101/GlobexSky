import mongoose from 'mongoose';

const reviewResponseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: {
      type: String,
      enum: ['product', 'supplier', 'carrier'],
      required: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 200 },
    content: { type: String, required: true, minlength: 10 },
    images: [{ type: String }],
    helpful: { type: Number, default: 0 },
    reported: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'hidden'],
      default: 'pending',
    },
    response: { type: reviewResponseSchema },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reviewSchema.index({ userId: 1 });
reviewSchema.index({ targetType: 1, targetId: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ rating: -1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;

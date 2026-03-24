import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, trim: true, default: 'My Wishlist', maxlength: 100 },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    isDefault: { type: Boolean, default: false },
    shared: { type: Boolean, default: false },
    shareToken: { type: String },
  },
  { timestamps: true }
);

wishlistSchema.index({ userId: 1 });
wishlistSchema.index({ userId: 1, isDefault: 1 });

const Wishlist = mongoose.model('Wishlist', wishlistSchema);
export default Wishlist;

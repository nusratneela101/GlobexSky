import mongoose from 'mongoose';

const pointHistorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['earn', 'redeem', 'expire', 'bonus', 'adjustment'],
      required: true,
    },
    points: { type: Number, required: true },
    description: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    referenceType: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const loyaltyAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    points: { type: Number, default: 0, min: 0 },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold'],
      default: 'bronze',
    },
    history: { type: [pointHistorySchema], default: [] },
    totalEarned: { type: Number, default: 0 },
    totalRedeemed: { type: Number, default: 0 },
    expiryDate: { type: Date },
  },
  { timestamps: true }
);

loyaltyAccountSchema.index({ userId: 1 });
loyaltyAccountSchema.index({ tier: 1 });
loyaltyAccountSchema.index({ points: -1 });

loyaltyAccountSchema.pre('save', function (next) {
  const points = this.points;
  if (points >= 10000) {
    this.tier = 'gold';
  } else if (points >= 3000) {
    this.tier = 'silver';
  } else {
    this.tier = 'bronze';
  }
  next();
});

const LoyaltyAccount = mongoose.model('LoyaltyAccount', loyaltyAccountSchema);
export default LoyaltyAccount;

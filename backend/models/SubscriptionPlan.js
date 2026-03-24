import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['supplier_pro', 'api'],
      required: true,
    },
    monthlyFee: { type: Number, required: true, min: 0 },
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    features: [{ type: String }],
    aiMarketingBudget: { type: Number, default: 0, min: 0 },
    setupFee: { type: Number, default: 0, min: 0 },
    trialDays: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    tier: {
      type: String,
      enum: ['free', 'basic', 'gold', 'platinum', 'diamond', 'professional', 'enterprise'],
    },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ type: 1 });
subscriptionPlanSchema.index({ status: 1 });

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export default SubscriptionPlan;

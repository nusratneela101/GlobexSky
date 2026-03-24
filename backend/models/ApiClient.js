import mongoose from 'mongoose';
import crypto from 'crypto';

const webhookSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    events: [{ type: String }],
    secret: { type: String },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const apiClientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    apiKey: { type: String, unique: true },
    secretKey: { type: String, select: false },
    plan: {
      type: String,
      enum: ['free', 'basic', 'professional', 'enterprise'],
      default: 'free',
    },
    requestsUsed: { type: Number, default: 0, min: 0 },
    requestsLimit: { type: Number, default: 1000, min: 0 },
    webhooks: { type: [webhookSchema], default: [] },
    status: {
      type: String,
      enum: ['active', 'suspended', 'revoked'],
      default: 'active',
    },
    permissions: [
      {
        type: String,
        enum: ['products:read', 'products:write', 'orders:read', 'orders:write', 'users:read', 'users:write'],
      },
    ],
    lastUsedAt: { type: Date },
    ipWhitelist: [{ type: String }],
  },
  { timestamps: true }
);

apiClientSchema.index({ userId: 1 });
apiClientSchema.index({ apiKey: 1 });
apiClientSchema.index({ status: 1 });

apiClientSchema.pre('save', function (next) {
  if (!this.apiKey) {
    this.apiKey = 'gsk_' + crypto.randomBytes(24).toString('hex');
  }
  if (!this.secretKey) {
    this.secretKey = 'gsks_' + crypto.randomBytes(32).toString('hex');
  }
  next();
});

const ApiClient = mongoose.model('ApiClient', apiClientSchema);
export default ApiClient;

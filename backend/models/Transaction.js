import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    type: {
      type: String,
      enum: ['payment', 'refund', 'payout', 'commission'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD', uppercase: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    paymentGateway: {
      type: String,
      enum: ['stripe', 'paypal', 'bkash', 'nagad', 'bank_transfer', 'cod', 'other'],
    },
    gatewayTransactionId: { type: String },
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    description: { type: String },
  },
  { timestamps: true }
);

transactionSchema.index({ orderId: 1 });
transactionSchema.index({ userId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ gatewayTransactionId: 1 });
transactionSchema.index({ createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;

import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'order_placed',
        'order_shipped',
        'order_delivered',
        'order_cancelled',
        'payment_received',
        'payment_failed',
        'message_received',
        'review_received',
        'verification_approved',
        'verification_rejected',
        'promotion',
        'system',
        'rfq_received',
        'rfq_quoted',
        'other',
      ],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Map, of: mongoose.Schema.Types.Mixed },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    channel: {
      type: String,
      enum: ['email', 'sms', 'push', 'inapp'],
      default: 'inapp',
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ channel: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;

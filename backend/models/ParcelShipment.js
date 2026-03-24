import mongoose from 'mongoose';
import crypto from 'crypto';

const receiverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    address: { type: String, required: true },
    city: { type: String },
    postalCode: { type: String },
    country: { type: String, required: true },
  },
  { _id: false }
);

const packageSchema = new mongoose.Schema(
  {
    weight: { type: Number, required: true, min: 0 },
    dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number },
      unit: { type: String, default: 'cm' },
    },
    declaredValue: { type: Number, default: 0, min: 0 },
    type: {
      type: String,
      enum: ['parcel', 'document', 'fragile', 'liquid'],
      default: 'parcel',
    },
    contents: { type: String },
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    baseCost: { type: Number, default: 0, min: 0 },
    baseFee: { type: Number, default: 0, min: 0 },
    extras: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
  },
  { _id: false }
);

const trackingEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    location: { type: String },
    description: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const parcelShipmentSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: receiverSchema, required: true },
    package: { type: packageSchema, required: true },
    destination: { type: String, required: true },
    shippingOption: {
      type: String,
      enum: ['standard', 'express', 'economy'],
      default: 'standard',
    },
    additionalServices: [
      {
        type: String,
        enum: ['insurance', 'signature_required', 'fragile_handling', 'express_customs'],
      },
    ],
    pricing: { type: pricingSchema, default: () => ({}) },
    referenceNumber: { type: String, unique: true },
    status: {
      type: String,
      enum: [
        'created',
        'received',
        'processing',
        'shipped',
        'in_transit',
        'customs',
        'out_for_delivery',
        'delivered',
        'returned',
        'cancelled',
      ],
      default: 'created',
    },
    trackingEvents: { type: [trackingEventSchema], default: [] },
    carrierName: { type: String },
    carrierTrackingNumber: { type: String },
  },
  { timestamps: true }
);

parcelShipmentSchema.index({ sender: 1 });
parcelShipmentSchema.index({ referenceNumber: 1 });
parcelShipmentSchema.index({ status: 1 });
parcelShipmentSchema.index({ carrierTrackingNumber: 1 });

parcelShipmentSchema.pre('save', function (next) {
  if (!this.referenceNumber) {
    this.referenceNumber = 'PSH-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }
  next();
});

const ParcelShipment = mongoose.model('ParcelShipment', parcelShipmentSchema);
export default ParcelShipment;

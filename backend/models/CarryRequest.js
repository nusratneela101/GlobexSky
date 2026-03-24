import mongoose from 'mongoose';

const flightDetailsSchema = new mongoose.Schema(
  {
    flightNumber: { type: String },
    airline: { type: String },
    departureAirport: { type: String },
    arrivalAirport: { type: String },
    departureDate: { type: Date },
    arrivalDate: { type: Date },
    boardingPassUrl: { type: String },
  },
  { _id: false }
);

const deliveryProofSchema = new mongoose.Schema(
  {
    photos: [{ type: String }],
    signature: { type: String },
    recipientName: { type: String },
    deliveredAt: { type: Date },
    notes: { type: String },
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    fromCountry: { type: String },
    toCountry: { type: String },
  },
  { _id: false }
);

const carryRequestSchema = new mongoose.Schema(
  {
    carrier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    flightDetails: { type: flightDetailsSchema },
    weightCapacity: { type: Number, required: true, min: 0 },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    route: { type: routeSchema, required: true },
    status: {
      type: String,
      enum: ['open', 'matched', 'in_transit', 'delivered', 'cancelled', 'expired'],
      default: 'open',
    },
    earnings: { type: Number, default: 0, min: 0 },
    bonuses: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    deliveryProof: { type: deliveryProofSchema },
    rating: { type: Number, min: 1, max: 5 },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pricePerKg: { type: Number, min: 0 },
    availableDate: { type: Date },
  },
  { timestamps: true }
);

carryRequestSchema.index({ carrier: 1 });
carryRequestSchema.index({ status: 1 });
carryRequestSchema.index({ 'route.from': 1, 'route.to': 1 });
carryRequestSchema.index({ createdAt: -1 });

const CarryRequest = mongoose.model('CarryRequest', carryRequestSchema);
export default CarryRequest;

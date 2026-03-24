import mongoose from 'mongoose';

const certificationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    issuedBy: { type: String },
    issuedDate: { type: Date },
    expiryDate: { type: Date },
    documentUrl: { type: String },
  },
  { _id: false }
);

const factorySchema = new mongoose.Schema(
  {
    address: { type: String },
    size: { type: String },
    photos: [{ type: String }],
  },
  { _id: false }
);

const proSubscriptionSchema = new mongoose.Schema(
  {
    plan: { type: String, enum: ['free', 'basic', 'gold', 'platinum', 'diamond'], default: 'free' },
    startDate: { type: Date },
    endDate: { type: Date },
    features: [{ type: String }],
  },
  { _id: false }
);

const supplierProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: { type: String, required: true, trim: true },
    businessType: {
      type: String,
      enum: ['manufacturer', 'trading', 'manufacturer_trading', 'wholesaler', 'agent'],
    },
    yearEstablished: { type: Number },
    employees: { type: String },
    productionCapacity: { type: String },
    certifications: { type: [certificationSchema], default: [] },
    factory: { type: factorySchema },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
    verificationDocuments: [{ type: String }],
    supplierLevel: {
      type: String,
      enum: ['free', 'basic', 'gold', 'platinum', 'diamond'],
      default: 'free',
    },
    proSubscription: { type: proSubscriptionSchema, default: () => ({}) },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    responseRate: { type: Number, default: 0, min: 0, max: 100 },
    onTimeDelivery: { type: Number, default: 0, min: 0, max: 100 },
    description: { type: String },
    country: { type: String },
    city: { type: String },
    website: { type: String },
  },
  { timestamps: true }
);

supplierProfileSchema.index({ userId: 1 });
supplierProfileSchema.index({ verificationStatus: 1 });
supplierProfileSchema.index({ supplierLevel: 1 });

const SupplierProfile = mongoose.model('SupplierProfile', supplierProfileSchema);
export default SupplierProfile;

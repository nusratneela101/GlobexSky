import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const loginHistorySchema = new mongoose.Schema(
  {
    ip: { type: String },
    userAgent: { type: String },
    location: { type: String },
    success: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const twoFactorSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    method: { type: String, enum: ['totp', 'sms', 'email'], default: 'totp' },
    secret: { type: String },
    backupCodes: [{ type: String }],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ['buyer', 'supplier', 'carrier', 'admin'],
      default: 'buyer',
    },
    phone: { type: String, trim: true },
    avatar: { type: String },
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'UTC' },
    twoFactor: { type: twoFactorSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
    },
    isVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    phoneVerifiedAt: { type: Date },
    loginHistory: { type: [loginHistorySchema], default: [] },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.twoFactor?.secret;
  delete obj.twoFactor?.backupCodes;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;

import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

const specificationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
    unit: { type: String },
  },
  { _id: false }
);

const tieredPricingSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true, min: 1 },
    maxQty: { type: Number },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const dimensionsSchema = new mongoose.Schema(
  {
    length: { type: Number },
    width: { type: Number },
    height: { type: Number },
    unit: { type: String, default: 'cm' },
  },
  { _id: false }
);

const ratingSchema = new mongoose.Schema(
  {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 },
  },
  { _id: false }
);

const customizationSchema = new mongoose.Schema(
  {
    available: { type: Boolean, default: false },
    options: [{ type: String }],
    minOrderForCustom: { type: Number, default: 1 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 255 },
    slug: { type: String, unique: true, trim: true, lowercase: true },
    description: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    images: [{ type: String }],
    videos: [{ type: String }],
    specifications: { type: [specificationSchema], default: [] },
    price: { type: Number, required: true, min: 0 },
    tieredPricing: { type: [tieredPricingSchema], default: [] },
    moq: { type: Number, default: 1, min: 1 },
    stock: { type: Number, default: 0, min: 0 },
    weight: { type: Number, min: 0 },
    dimensions: { type: dimensionsSchema },
    status: {
      type: String,
      enum: ['draft', 'pending', 'active', 'inactive', 'banned'],
      default: 'draft',
    },
    featured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    ratings: { type: ratingSchema, default: () => ({}) },
    reviewCount: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    certifications: [{ type: String, trim: true }],
    customization: { type: customizationSchema, default: () => ({}) },
  },
  { timestamps: true }
);

productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ supplier: 1 });
productSchema.index({ status: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ trending: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.average': -1 });

productSchema.pre('save', function (next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = slugify(this.title) + '-' + Date.now();
  }
  next();
});

const Product = mongoose.model('Product', productSchema);
export default Product;

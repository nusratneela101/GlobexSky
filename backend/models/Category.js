import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

const attributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    values: [{ type: String }],
    unit: { type: String },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true, lowercase: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    image: { type: String },
    icon: { type: String },
    attributes: { type: [attributeSchema], default: [] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    order: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 5, min: 0, max: 100 },
  },
  { timestamps: true }
);

categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ status: 1 });

categorySchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = slugify(this.name);
  }
  next();
});

const Category = mongoose.model('Category', categorySchema);
export default Category;

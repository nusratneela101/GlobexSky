import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid('buyer', 'supplier', 'carrier').default('buyer'),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const productSchema = Joi.object({
  title: Joi.string().min(3).max(255).required(),
  description: Joi.string().optional(),
  price: Joi.number().positive().required(),
  moq: Joi.number().integer().min(1).default(1),
  stock: Joi.number().integer().min(0).default(0),
  category_id: Joi.string().uuid().required(),
  specifications: Joi.object().optional(),
});

export const addressSchema = Joi.object({
  label: Joi.string().max(50).optional(),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().optional(),
  country: Joi.string().required(),
  postal_code: Joi.string().optional(),
  is_default: Joi.boolean().default(false),
});

export const orderSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    product_id: Joi.string().uuid().required(),
    variant_id: Joi.string().uuid().optional(),
    quantity: Joi.number().integer().min(1).required(),
  })).min(1).required(),
  shipping_address_id: Joi.string().uuid().required(),
  payment_method: Joi.string().required(),
  notes: Joi.string().optional(),
});

/**
 * Validate data against a Joi schema.
 * Throws on validation failure.
 */
export function validateSchema(schema, data) {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    const err = new Error(error.details.map((d) => d.message).join('; '));
    err.statusCode = 422;
    throw err;
  }
  return value;
}

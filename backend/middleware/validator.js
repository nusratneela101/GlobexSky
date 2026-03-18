import { validationResult } from 'express-validator';

/**
 * Run after express-validator chains. If validation errors exist,
 * respond with 422 and the first error message per field.
 */
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = {};
  for (const err of errors.array()) {
    if (!formatted[err.path]) formatted[err.path] = err.msg;
  }

  return res.status(422).json({ success: false, error: 'Validation failed.', fields: formatted });
}

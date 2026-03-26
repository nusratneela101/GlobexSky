import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { lookupBarcode, lookupBarcodePost } from '../controllers/barcode.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/barcode/{code}:
 *   get:
 *     tags: [Barcode]
 *     summary: Look up product by barcode
 *     description: Returns products whose SKU or barcode field matches the given value. Supports EAN-13, UPC-A, Code 128, and QR Code values.
 *     security: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: Barcode or QR code value
 *     responses:
 *       200:
 *         description: Products matching the barcode
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       400:
 *         description: Invalid or missing barcode value
 */
router.get(
  '/:code',
  [param('code').trim().notEmpty().withMessage('Barcode value is required')],
  validate,
  lookupBarcode,
);

/**
 * @swagger
 * /api/v1/barcode/lookup:
 *   post:
 *     tags: [Barcode]
 *     summary: Look up product by barcode (POST)
 *     description: Returns products whose SKU or barcode field matches the given value.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [barcode]
 *             properties:
 *               barcode:
 *                 type: string
 *                 description: Barcode or QR code value
 *     responses:
 *       200:
 *         description: Products matching the barcode
 *       400:
 *         description: Validation error
 */
router.post(
  '/lookup',
  [body('barcode').trim().notEmpty().withMessage('barcode is required')],
  validate,
  lookupBarcodePost,
);

export default router;

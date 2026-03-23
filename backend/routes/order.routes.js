import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/order.controller.js';

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders for the authenticated user
 *     description: Returns paginated orders. Buyers see their own orders; suppliers see their received orders.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Orders list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     tags: [Orders]
 *     summary: Create a new order
 *     description: Places a new order from the buyer's cart.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shipping_address_id, payment_method]
 *             properties:
 *               shipping_address_id: { type: string, format: uuid }
 *               payment_method:
 *                 type: string
 *                 enum: [stripe, paypal, bkash, nagad, cod]
 *               coupon_code: { type: string }
 *     responses:
 *       201:
 *         description: Order placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation error or empty cart
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get order by ID
 *     description: Returns full order details including items, shipping, and payment info.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Order not found
 */


const router = Router();

router.use(authenticate);

router.get('/', ctrl.listOrders);
router.get('/:id', [param('id').isUUID()], validate, ctrl.getOrder);
router.post('/',
  [body('items').isArray({ min: 1 }), body('shipping_address_id').isUUID()],
  validate,
  ctrl.createOrder,
);
router.patch('/:id/status',
  [param('id').isUUID(), body('status').notEmpty()],
  validate,
  ctrl.updateOrderStatus,
);
router.post('/:id/cancel', [param('id').isUUID()], validate, ctrl.cancelOrder);
router.get('/:id/tracking', [param('id').isUUID()], validate, ctrl.getOrderTracking);
router.put('/:id/tracking',
  [param('id').isUUID(), body('tracking_number').notEmpty()],
  validate,
  ctrl.updateOrderTracking,
);
router.post('/:id/refund',
  [param('id').isUUID(), body('reason').notEmpty()],
  validate,
  ctrl.requestRefund,
);
router.get('/:id/invoice', [param('id').isUUID()], validate, ctrl.getInvoice);

export default router;


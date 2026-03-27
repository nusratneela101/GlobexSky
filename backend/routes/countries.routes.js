import { Router } from 'express';
import { COUNTRIES } from '../utils/countries.js';

const router = Router();

/**
 * @swagger
 * /api/countries:
 *   get:
 *     tags: [Countries]
 *     summary: Get list of all countries
 *     description: Returns all ISO 3166-1 countries with their alpha-2 codes and English names.
 *     security: []
 *     responses:
 *       200:
 *         description: List of countries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code: { type: string, example: 'US' }
 *                       name: { type: string, example: 'United States' }
 */
router.get('/', (_req, res) => {
  res.json({ success: true, data: COUNTRIES });
});

export default router;

import { processBarcodeSearch } from '../services/advancedSearch.service.js';

/**
 * GET /api/v1/barcode/:code
 * Look up products matching the given barcode / QR value.
 */
export async function lookupBarcode(req, res, next) {
  try {
    const { code } = req.params;
    const result = await processBarcodeSearch(code);
    res.json({ success: true, data: result.data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/barcode/lookup
 * Look up products matching the given barcode / QR value (body payload).
 */
export async function lookupBarcodePost(req, res, next) {
  try {
    const { barcode } = req.body;
    const result = await processBarcodeSearch(barcode);
    res.json({ success: true, data: result.data });
  } catch (err) {
    next(err);
  }
}

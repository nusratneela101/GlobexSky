import {
  createOneTouchOrderRecord,
  fetchCustomizationOptions,
  submitCustomRequestRecord,
  fetchSourcingQuotes,
  compareSourcingOptionsData,
} from '../services/sourcingSolutions.service.js';

/** POST /api/v1/sourcing-solutions/one-touch — Create one-touch sourcing order */
export async function createOneTouchOrder(req, res, next) {
  try {
    const { product_id, quantity, delivery_address, notes } = req.body;
    const buyer_id = req.user.id;

    const order = await createOneTouchOrderRecord({ buyer_id, product_id, quantity, delivery_address, notes });
    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
}

/** GET /api/v1/sourcing-solutions/customization/:productId — Get customization options (public) */
export async function getCustomizationOptions(req, res, next) {
  try {
    const { productId } = req.params;
    const options = await fetchCustomizationOptions(productId);
    res.json({ success: true, data: options });
  } catch (err) { next(err); }
}

/** POST /api/v1/sourcing-solutions/custom-request — Submit custom sourcing request */
export async function submitCustomRequest(req, res, next) {
  try {
    const { product_name, description, quantity, target_price, delivery_deadline, specifications } = req.body;
    const buyer_id = req.user.id;

    const request = await submitCustomRequestRecord({
      buyer_id,
      product_name,
      description,
      quantity,
      target_price,
      delivery_deadline,
      specifications,
    });
    res.status(201).json({ success: true, data: request });
  } catch (err) { next(err); }
}

/** GET /api/v1/sourcing-solutions/quotes/:requestId — Get quotes for a request */
export async function getSourcingQuotes(req, res, next) {
  try {
    const { requestId } = req.params;
    const quotes = await fetchSourcingQuotes(requestId);
    res.json({ success: true, data: quotes });
  } catch (err) { next(err); }
}

/** POST /api/v1/sourcing-solutions/compare — Compare sourcing options */
export async function compareSourcingOptions(req, res, next) {
  try {
    const { options } = req.body;
    const compared = compareSourcingOptionsData(options);
    res.json({ success: true, data: compared });
  } catch (err) { next(err); }
}

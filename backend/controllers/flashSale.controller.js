import {
  createFlashSaleRecord,
  getActiveFlashSalesData,
  getUpcomingFlashSalesData,
  updateFlashSaleRecord,
  cancelFlashSaleRecord,
  getFlashSaleAnalyticsData,
  addProductsToFlashSale,
} from '../services/flashSale.service.js';

export async function createFlashSale(req, res, next) {
  try {
    const { name, description, banner_image, starts_at, ends_at, max_orders } = req.body;
    const data = await createFlashSaleRecord({
      name,
      description,
      bannerImage: banner_image,
      startsAt: starts_at,
      endsAt: ends_at,
      maxOrders: max_orders,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getActiveFlashSales(req, res, next) {
  try {
    const data = await getActiveFlashSalesData();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getUpcomingFlashSales(req, res, next) {
  try {
    const data = await getUpcomingFlashSalesData();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function updateFlashSale(req, res, next) {
  try {
    const data = await updateFlashSaleRecord(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function cancelFlashSale(req, res, next) {
  try {
    const data = await cancelFlashSaleRecord(req.params.id);
    res.json({ success: true, data, message: 'Flash sale cancelled.' });
  } catch (err) { next(err); }
}

export async function getFlashSaleAnalytics(req, res, next) {
  try {
    const data = await getFlashSaleAnalyticsData(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function addProductsToSale(req, res, next) {
  try {
    const { products } = req.body;
    const data = await addProductsToFlashSale(req.params.id, products);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

import {
  createTradeShowRecord,
  listTradeShows,
  registerBoothRecord,
  getBoothById,
  scheduleDemoRecord,
  manageMeetingRecord,
} from '../services/tradeShow.service.js';

/** POST /api/v1/trade-shows — Create a new trade show (admin) */
export async function createTradeShow(req, res, next) {
  try {
    const { title, description, start_date, end_date, location_type, tags } = req.body;
    const show = await createTradeShowRecord({ title, description, start_date, end_date, location_type, tags });
    res.status(201).json({ success: true, data: show });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-shows — List all trade shows (public) */
export async function getTradeShows(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await listTradeShows({ status, page, limit });
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-shows/:id/booths — Register a booth (authenticated) */
export async function registerBooth(req, res, next) {
  try {
    const trade_show_id = req.params.id;
    const { booth_size, brand_description, product_categories, contact_email } = req.body;
    const company_id = req.user.id;

    const booth = await registerBoothRecord({ trade_show_id, company_id, booth_size, brand_description, product_categories, contact_email });
    res.status(201).json({ success: true, data: booth });
  } catch (err) { next(err); }
}

/** GET /api/v1/trade-shows/:id/booths/:boothId — Get booth details (public) */
export async function getBoothDetails(req, res, next) {
  try {
    const { id, boothId } = req.params;
    const booth = await getBoothById(id, boothId);
    res.json({ success: true, data: booth });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-shows/:id/demos — Schedule a product demo (authenticated) */
export async function scheduleDemo(req, res, next) {
  try {
    const trade_show_id = req.params.id;
    const { booth_id, title, description, scheduled_at, duration_minutes } = req.body;
    const presenter_id = req.user.id;

    const demo = await scheduleDemoRecord({ trade_show_id, booth_id, presenter_id, title, description, scheduled_at, duration_minutes });
    res.status(201).json({ success: true, data: demo });
  } catch (err) { next(err); }
}

/** POST /api/v1/trade-shows/:id/meetings — Create/update a meeting (authenticated) */
export async function manageMeetings(req, res, next) {
  try {
    const trade_show_id = req.params.id;
    const { attendee_id, scheduled_at, duration_minutes, notes, meeting_id } = req.body;
    const organizer_id = req.user.id;

    const meeting = await manageMeetingRecord({ trade_show_id, organizer_id, attendee_id, scheduled_at, duration_minutes, notes, meeting_id });
    res.status(meeting_id ? 200 : 201).json({ success: true, data: meeting });
  } catch (err) { next(err); }
}

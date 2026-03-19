import * as service from '../services/seo.service.js';

/** GET /api/v1/seo/sitemap.xml */
export async function generateSitemap(req, res, next) {
  try {
    const xml = await service.generateSitemap();
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) { next(err); }
}

/** GET /api/v1/seo/robots.txt */
export async function getRobotsTxt(req, res, next) {
  try {
    const txt = service.getRobotsTxt();
    res.setHeader('Content-Type', 'text/plain');
    res.send(txt);
  } catch (err) { next(err); }
}

/** GET /api/v1/seo/meta/:pageSlug */
export async function getMetaTags(req, res, next) {
  try {
    const meta = service.getMetaTags(req.params.pageSlug);
    res.json({ success: true, data: meta });
  } catch (err) { next(err); }
}

/** PATCH /api/v1/seo/meta/:pageSlug  (admin) */
export async function updateMetaTags(req, res, next) {
  try {
    const updated = service.updateMetaTags(req.params.pageSlug, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

/** GET /api/v1/seo/audit  (admin) */
export async function getSeoAudit(req, res, next) {
  try {
    const result = await service.runSeoAudit();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

/** GET /api/v1/seo/analytics  (admin) */
export async function getSeoAnalytics(req, res, next) {
  try {
    const result = await service.getSeoAnalytics();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

import supabase from '../config/supabase.js';

const BASE_URL = process.env.SITE_URL || 'https://globexsky.com';

// ─── In-memory meta tag store (use DB in production) ─────────────────────────
const metaStore = {
  home: {
    title: 'GlobexSky – Global Trade Gateway',
    description: 'Connect with suppliers and buyers worldwide on GlobexSky.',
    keywords: 'B2B, global trade, import, export, suppliers',
    ogImage: `${BASE_URL}/assets/images/og-home.jpg`,
  },
};

// ─── Generate XML sitemap ─────────────────────────────────────────────────────
export async function generateSitemap() {
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/pages/about.html', priority: '0.6', changefreq: 'monthly' },
    { loc: '/pages/contact.html', priority: '0.6', changefreq: 'monthly' },
    { loc: '/pages/help.html', priority: '0.5', changefreq: 'monthly' },
    { loc: '/pages/terms.html', priority: '0.3', changefreq: 'yearly' },
    { loc: '/pages/privacy.html', priority: '0.3', changefreq: 'yearly' },
  ];

  // Fetch active products for dynamic URLs
  const { data: products } = await supabase
    .from('products')
    .select('id, updated_at')
    .eq('status', 'active')
    .limit(1000);

  const productUrls = (products || []).map((p) => ({
    loc: `/pages/product-detail.html?id=${p.id}`,
    priority: '0.8',
    changefreq: 'weekly',
    lastmod: p.updated_at ? p.updated_at.split('T')[0] : undefined,
  }));

  const allUrls = [...staticPages, ...productUrls];
  const today = new Date().toISOString().split('T')[0];

  const urlEntries = allUrls.map((u) => `
  <url>
    <loc>${BASE_URL}${u.loc}</loc>
    <lastmod>${u.lastmod || today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

// ─── Robots.txt ───────────────────────────────────────────────────────────────
export function getRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /pages/admin/
Disallow: /api/
Disallow: /backend/

Sitemap: ${BASE_URL}/api/v1/seo/sitemap.xml
`;
}

// ─── Meta tags ────────────────────────────────────────────────────────────────
export function getMetaTags(pageSlug) {
  const defaults = {
    title: 'GlobexSky – Global Trade Gateway',
    description: 'Your global trade gateway connecting buyers and suppliers worldwide.',
    keywords: 'B2B trade, global marketplace, import export',
    ogImage: `${BASE_URL}/assets/images/og-default.jpg`,
  };
  return metaStore[pageSlug] ?? defaults;
}

export function updateMetaTags(pageSlug, updates) {
  metaStore[pageSlug] = { ...(metaStore[pageSlug] || {}), ...updates };
  return metaStore[pageSlug];
}

// ─── SEO audit ────────────────────────────────────────────────────────────────
export async function runSeoAudit() {
  const { data: products } = await supabase
    .from('products')
    .select('id, title, description, status')
    .eq('status', 'active')
    .limit(100);

  const total = products?.length ?? 0;
  const missingDesc = (products || []).filter((p) => !p.description || p.description.length < 50).length;
  const missingTitle = (products || []).filter((p) => !p.title || p.title.length < 5).length;

  const score = Math.max(0, 100 - missingDesc * 2 - missingTitle * 3);

  return {
    score,
    totalPages: total + Object.keys(staticPageSlugs).length,
    issues: {
      missingMetaDescriptions: missingDesc,
      missingTitles: missingTitle,
      duplicateTitles: 0,
    },
    recommendations: [
      missingDesc > 0 ? `Add descriptions to ${missingDesc} products (min 50 characters).` : null,
      missingTitle > 0 ? `Fix titles on ${missingTitle} products (min 5 characters).` : null,
      'Add Open Graph images to key landing pages.',
      'Enable structured data (JSON-LD) on product pages.',
    ].filter(Boolean),
  };
}

const staticPageSlugs = { home: 1, about: 1, contact: 1, help: 1, terms: 1, privacy: 1 };

// ─── SEO analytics (stub) ─────────────────────────────────────────────────────
export async function getSeoAnalytics() {
  return {
    organicTraffic: { thisMonth: 12480, lastMonth: 9320, growth: '+33.9%' },
    topKeywords: [
      { keyword: 'B2B marketplace Bangladesh', impressions: 4200, clicks: 310 },
      { keyword: 'global trade platform', impressions: 3100, clicks: 220 },
      { keyword: 'buy wholesale online', impressions: 2800, clicks: 195 },
    ],
    avgPosition: 14.2,
    indexedPages: 1840,
  };
}

/**
 * GlobexSky — config.js
 * Environment/API URL configuration. Detects dev vs. production automatically.
 */

const Config = (() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  return {
    API_BASE_URL: isLocalhost
      ? 'http://localhost:5000/api/v1'
      : 'https://globexsky-backend.up.railway.app/api/v1',

    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-supabase-anon-key',

    CLOUDINARY_CLOUD_NAME: 'your-cloud-name',

    DEFAULT_CURRENCY: 'USD',
    DEFAULT_LANGUAGE: 'en',
  };
})();

window.GlobexConfig = Config;

/**
 * js/supabase.js — Supabase client initialization.
 *
 * Load via CDN before this file:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *
 * Exposes: window.supabaseClient
 */

(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://czpqbdkarwdvrnhtvysd.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cHFiZGthcndkdnJuaHR2eXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjM0NDAsImV4cCI6MjA5MDI5OTQ0MH0.r09xPh0HEOWTIRroZKoyd_Y0eBlD8El-weZk_7o7x0E';

  // Wait until the Supabase library is available
  function _createClient() {
    if (global.supabase && global.supabase.createClient) {
      var client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      global.supabaseClient = client;
      // Also expose config for other modules
      global.SUPABASE_URL = SUPABASE_URL;
      global.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
      return client;
    }
    return null;
  }

  // Try immediately, then retry after DOM load
  if (!_createClient()) {
    document.addEventListener('DOMContentLoaded', _createClient);
  }

}(typeof window !== 'undefined' ? window : this));

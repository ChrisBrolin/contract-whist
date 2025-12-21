/**
 * Supabase Client (Browser)
 * Uses the global supabase object from CDN
 */

// These will be set from environment or config
// For local dev, you can set these directly or use a config endpoint
const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

let supabaseClient = null;

function initSupabase(url, anonKey) {
  if (!url || !anonKey) {
    console.warn('Supabase credentials not provided');
    return null;
  }

  supabaseClient = window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: false
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  });

  return supabaseClient;
}

function getSupabase() {
  return supabaseClient;
}

// Export for use in other modules
window.SupabaseClient = {
  init: initSupabase,
  get: getSupabase
};

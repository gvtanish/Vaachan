// Supabase client initialization wrapper supporting Vercel Environment Variables
(function() {
  let supabasePromise = null;

  window.getSupabaseClient = function() {
    if (window.supabaseClient) {
      return Promise.resolve(window.supabaseClient);
    }
    
    if (supabasePromise) {
      return supabasePromise;
    }

    supabasePromise = new Promise(async (resolve) => {
      let url = localStorage.getItem('VAACHAN_SUPABASE_URL') || '';
      let key = localStorage.getItem('VAACHAN_SUPABASE_KEY') || '';

      // If keys aren't in localStorage, attempt to fetch from Vercel Serverless environment variable
      if (!url || !key) {
        try {
          const response = await fetch('/api/config');
          if (response.ok) {
            const data = await response.json();
            if (data.supabaseUrl && data.supabaseKey) {
              url = data.supabaseUrl;
              key = data.supabaseKey;
              // Persist locally for offline support
              localStorage.setItem('VAACHAN_SUPABASE_URL', url);
              localStorage.setItem('VAACHAN_SUPABASE_KEY', key);
            }
          }
        } catch (e) {
          console.warn("Vercel Serverless environment variables config unavailable. Falling back to local storage.", e);
        }
      }

      if (url && key) {
        if (window.supabase) {
          window.supabaseClient = window.supabase.createClient(url, key);
          resolve(window.supabaseClient);
        } else {
          console.error("Supabase script library was not loaded.");
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    return supabasePromise;
  };

  window.configureSupabase = function(newUrl, newKey) {
    localStorage.setItem('VAACHAN_SUPABASE_URL', newUrl);
    localStorage.setItem('VAACHAN_SUPABASE_KEY', newKey);
    location.reload();
  };

  window.isSupabaseConfigured = function() {
    return !!(localStorage.getItem('VAACHAN_SUPABASE_URL') && localStorage.getItem('VAACHAN_SUPABASE_KEY'));
  };

  // Trigger early load
  window.getSupabaseClient();
})();

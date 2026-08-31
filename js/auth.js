// Auth logic using Supabase Auth
(function() {
  window.auth = {
    // Sign in using Employee ID (mapped to internal email) and password
    async signIn(employeeId, password) {
      const client = await window.getSupabaseClient();
      if (!client) {
        throw new Error("Supabase is not configured yet. Please configure database credentials first.");
      }

      let email = employeeId.trim();
      // If it doesn't look like an email, assume it's an employee ID or username and append internal domain
      if (!email.includes('@')) {
        email = `${email.toLowerCase()}@vaachan.internal`;
      }

      const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      // Fetch user profile to check role
      const profile = await this.getProfile(data.user.id);
      if (!profile) {
        // Sign out if no profile is found
        await this.signOut();
        throw new Error("User profile not found. Please contact the administrator.");
      }

      // Store profile details in sessionStorage for quick sync check
      sessionStorage.setItem('VAACHAN_USER_ROLE', profile.role);
      sessionStorage.setItem('VAACHAN_USER_NAME', profile.name);
      sessionStorage.setItem('VAACHAN_USER_EMPLOYEE_ID', profile.employee_id || '');

      return profile;
    },

    // Sign out
    async signOut() {
      const client = await window.getSupabaseClient();
      if (client) {
        await client.auth.signOut();
      }
      sessionStorage.clear();
      window.location.href = '/index.html';
    },

    // Fetch user profile from profiles table
    async getProfile(userId) {
      const client = await window.getSupabaseClient();
      if (!client) return null;
      
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }
      return data;
    },

    // Get current session
    async getSession() {
      const client = await window.getSupabaseClient();
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) return null;
      return data.session;
    },

    // Check auth status and role on page load
    async checkGuard(requiredRole) {
      const client = await window.getSupabaseClient();
      
      // If Supabase not configured, redirect to index.html to configure it
      if (!client) {
        if (!window.location.pathname.endsWith('index.html')) {
          window.location.href = '/index.html';
        }
        return;
      }

      const session = await this.getSession();
      if (!session) {
        if (!window.location.pathname.endsWith('index.html')) {
          window.location.href = '/index.html';
        }
        return;
      }

      let role = sessionStorage.getItem('VAACHAN_USER_ROLE');
      if (!role) {
        const profile = await this.getProfile(session.user.id);
        if (profile) {
          role = profile.role;
          sessionStorage.setItem('VAACHAN_USER_ROLE', role);
          sessionStorage.setItem('VAACHAN_USER_NAME', profile.name);
          sessionStorage.setItem('VAACHAN_USER_EMPLOYEE_ID', profile.employee_id || '');
        } else {
          await this.signOut();
          return;
        }
      }

      if (requiredRole && role !== requiredRole) {
        // Unauthorized role redirect
        if (role === 'admin') {
          window.location.href = '/admin/dashboard.html';
        } else if (role === 'teacher') {
          window.location.href = '/teacher/dashboard.html';
        } else {
          await this.signOut();
        }
      }
    }
  };
})();

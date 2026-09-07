// Shared Utilities and UI Helpers – Vaachan Responsive Engine
(function() {
  window.utils = {
    // Format Date helper
    formatDate(dateStr) {
      if (!dateStr) return "—";
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    },

    // Escape HTML strings
    escapeHtml(str) {
      if (!str) return "";
      return str.replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));
    },

    // Generates styling and text for NAEP fluency levels
    getNaepBadgeHtml(level) {
      const badges = {
        4: { label: 'Level 4: Fluent', class: 'badge-mint' },
        3: { label: 'Level 3: Primarily Fluent', class: 'badge-indigo' },
        2: { label: 'Level 2: Developing', class: 'badge-marigold' },
        1: { label: 'Level 1: Non-fluent', class: 'badge-coral' }
      };
      const info = badges[level] || { label: 'Unknown', class: 'badge-indigo' };
      return `<span class="badge ${info.class}">${info.label}</span>`;
    },

    // Generates ASR diff markup to render on Step 3 screen
    generateDiffHtml(alignResult) {
      if (!alignResult || !alignResult.path) return "No speech transcript available.";
      
      return alignResult.path.map(item => {
        const escapedRef = this.escapeHtml(item.refWord || '');
        const escapedHeard = this.escapeHtml(item.heardWord || '');

        if (item.type === 'correct') {
          return `<span>${escapedRef}</span>`;
        } else if (item.type === 'substitution') {
          return `<span class="diff-sub" title="Heard: '${escapedHeard}' instead of '${escapedRef}'" style="border-bottom: 2.5px solid var(--marigold); color: var(--ink); padding: 0 3px; font-weight:600; border-radius:3px; background:rgba(232,163,61,0.12);">${escapedRef}</span>`;
        } else if (item.type === 'omission') {
          return `<span class="diff-om" title="Word skipped" style="text-decoration: line-through; color: var(--coral); opacity: 0.85; padding: 0 3px; font-weight:600; background:rgba(214,88,79,0.08); border-radius:3px;">${escapedRef}</span>`;
        } else if (item.type === 'insertion') {
          return `<span class="diff-ins" title="Extra word spoken" style="font-style: italic; color: var(--mint); text-decoration: underline dotted; padding: 0 3px; font-weight:600; background:rgba(79,155,114,0.12); border-radius:3px;">${escapedHeard}</span>`;
        }
        return '';
      }).join(' ');
    },

    // Safe vibration / haptic feedback for mobile actions
    haptic(type = 'light') {
      try {
        if (window.Capacitor?.Plugins?.Haptics) {
          if (type === 'success') window.Capacitor.Plugins.Haptics.notification({ type: 'SUCCESS' });
          else if (type === 'warning') window.Capacitor.Plugins.Haptics.notification({ type: 'WARNING' });
          else if (type === 'error') window.Capacitor.Plugins.Haptics.notification({ type: 'ERROR' });
          else window.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' });
        } else if (navigator.vibrate) {
          if (type === 'light') navigator.vibrate(15);
          else if (type === 'success') navigator.vibrate([20, 50, 20]);
          else if (type === 'warning') navigator.vibrate([40, 40, 40]);
        }
      } catch (e) {
        // Silently ignore if not supported
      }
    },

    // Setup global navigation header/nav block for dashboards
    renderNav(activeTab, isAdmin) {
      const container = document.getElementById('nav-container');
      if (!container) return;

      const userRole = sessionStorage.getItem('VAACHAN_USER_ROLE');
      const userName = sessionStorage.getItem('VAACHAN_USER_NAME') || (isAdmin ? 'Admin' : 'Teacher');

      // Detect base path relative to current URL
      const inSubDir = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/teacher/');
      const basePath = inSubDir ? '..' : '.';
      const adminPath = inSubDir ? (window.location.pathname.includes('/admin/') ? '.' : '../admin') : './admin';
      const teacherPath = inSubDir ? (window.location.pathname.includes('/teacher/') ? '.' : '../teacher') : './teacher';

      let links = '';

      if (isAdmin) {
        links = `
          <a href="${adminPath}/dashboard.html" class="${activeTab === 'dashboard' ? 'active' : ''}">Overview</a>
          <a href="${adminPath}/students.html" class="${activeTab === 'students' ? 'active' : ''}">Students</a>
          <a href="${adminPath}/teachers.html" class="${activeTab === 'teachers' ? 'active' : ''}">Teachers</a>
          <a href="${adminPath}/passages.html" class="${activeTab === 'passages' ? 'active' : ''}">Passages</a>
          <a href="${adminPath}/reports.html" class="${activeTab === 'reports' ? 'active' : ''}">Reports</a>
        `;
      } else {
        links = `
          <a href="${teacherPath}/dashboard.html" class="${activeTab === 'dashboard' ? 'active' : ''}">Dashboard</a>
          <a href="${teacherPath}/students.html" class="${activeTab === 'students' ? 'active' : ''}">My Students</a>
          <a href="${teacherPath}/reports.html" class="${activeTab === 'reports' ? 'active' : ''}">Reports</a>
          <a href="${teacherPath}/test.html" class="btn-test-nav ${activeTab === 'test' ? 'active' : ''}">⚡ Run Test</a>
        `;
      }

      const assetPath = `${basePath}/assets`;

      container.innerHTML = `
        <div class="nav-wrap">
          <div class="nav-brand" onclick="window.location.href='${isAdmin ? adminPath + '/dashboard.html' : teacherPath + '/dashboard.html'}'">
            <img src="${assetPath}/kv_logo.png" alt="KV" class="nav-logo" onerror="this.style.display='none'">
            <img src="${assetPath}/pm_shri_logo.png" alt="PM SHRI" class="nav-logo" onerror="this.style.display='none'">
            <span class="nav-title">Vaachan</span>
          </div>
          
          <div class="nav-links desktop-links">${links}</div>

          <div class="nav-profile">
            <span class="user-greeting">Namaste, <b>${this.escapeHtml(userName)}</b></span>
            <button class="logout-btn" onclick="window.auth.signOut()" title="Sign Out">Logout</button>
          </div>
        </div>

        <!-- Mobile Horizontal Tab Pills -->
        <div class="mobile-tab-bar">
          ${links}
        </div>
      `;

      // Inject standard navbar CSS globally if not present
      if (!document.getElementById('nav-styles')) {
        const style = document.createElement('style');
        style.id = 'nav-styles';
        style.textContent = `
          #nav-container {
            background: #1B2A4A;
            color: #fff;
            padding: max(10px, env(safe-area-inset-top, 10px)) 20px 10px;
            box-shadow: 0 4px 18px rgba(20,32,59,0.16);
            margin-bottom: 20px;
            position: sticky;
            top: 0;
            z-index: 1000;
            width: 100%;
          }
          .nav-wrap {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .nav-brand {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
            flex-shrink: 0;
          }
          .nav-logo {
            height: 30px;
            width: auto;
            object-fit: contain;
            background: #fff;
            border-radius: 5px;
            padding: 2px;
          }
          .nav-title {
            font-family: 'Baloo 2', sans-serif;
            font-size: 1.4rem;
            font-weight: 800;
            letter-spacing: -0.01em;
            color: #FFFFFF;
          }
          .nav-links {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .nav-links a {
            color: #C0C8DB;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            padding: 7px 13px;
            border-radius: 8px;
            transition: all 0.15s ease;
            white-space: nowrap;
          }
          .nav-links a:hover {
            color: #fff;
            background: rgba(255,255,255,0.1);
          }
          .nav-links a.active {
            color: #fff;
            background: rgba(255,255,255,0.18);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22);
          }
          .nav-links a.btn-test-nav {
            background: linear-gradient(135deg, var(--marigold), var(--marigold-deep));
            color: #1B2A4A !important;
            font-weight: 800;
            box-shadow: 0 3px 10px rgba(232,163,61,0.35);
          }
          .nav-links a.btn-test-nav:hover {
            background: #f0b555;
          }
          .nav-profile {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
          }
          .user-greeting {
            font-size: 0.85rem;
            color: #E4DCC8;
            white-space: nowrap;
          }
          .logout-btn {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(228,220,200,0.35);
            color: #E4DCC8;
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            touch-action: manipulation;
          }
          .logout-btn:hover, .logout-btn:active {
            color: #fff;
            border-color: #fff;
            background: rgba(255,255,255,0.15);
          }

          .mobile-tab-bar {
            display: none;
          }

          @media (max-width: 768px) {
            #nav-container {
              padding: max(8px, env(safe-area-inset-top, 8px)) 14px 8px;
              margin-bottom: 14px;
            }
            .desktop-links { display: none !important; }
            .nav-brand span { font-size: 1.22rem; }
            .nav-logo { height: 24px; }
            .user-greeting { display: none; }
            
            /* Responsive horizontal scrollable pill bar on mobile */
            .mobile-tab-bar {
              display: flex;
              gap: 6px;
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
              padding: 8px 0 2px;
              margin: 4px -4px 0;
              scrollbar-width: none;
            }
            .mobile-tab-bar::-webkit-scrollbar { display: none; }
            .mobile-tab-bar a {
              color: #D2D9EB;
              text-decoration: none;
              font-size: 0.82rem;
              font-weight: 700;
              padding: 6px 14px;
              border-radius: 20px;
              background: rgba(255,255,255,0.08);
              white-space: nowrap;
              flex-shrink: 0;
              transition: all 0.12s ease;
              touch-action: manipulation;
            }
            .mobile-tab-bar a.active {
              color: #fff;
              background: rgba(255,255,255,0.24);
              box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            }
            .mobile-tab-bar a.btn-test-nav {
              background: var(--marigold);
              color: #1B2A4A !important;
              font-weight: 800;
            }
          }
        `;
        document.head.appendChild(style);
      }
    },

    // Toast notification (non-blocking replacement for alert)
    toast(message, type = 'info', duration = 3500) {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }

      this.haptic(type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'light');

      const icons = {
        success: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        error: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        warning: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
      };

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
        <span style="display:flex; align-items:center; flex-shrink:0;">${icons[type] || icons.info}</span>
        <span style="flex:1;">${this.escapeHtml(message)}</span>
      `;

      toast.style.cursor = 'pointer';
      toast.onclick = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => toast.remove(), 200);
      };

      container.appendChild(toast);

      setTimeout(() => {
        if (toast.isConnected) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px) scale(0.95)';
          toast.style.transition = 'all 0.25s ease';
          setTimeout(() => toast.remove(), 260);
        }
      }, duration);
    }
  };
})();

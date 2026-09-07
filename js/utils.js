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
      const userName = sessionStorage.getItem('VAACHAN_USER_NAME') || (isAdmin ? 'Administrator' : 'Teacher');

      // Detect base path relative to current URL
      const inSubDir = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/teacher/');
      const basePath = inSubDir ? '..' : '.';
      const adminPath = inSubDir ? (window.location.pathname.includes('/admin/') ? '.' : '../admin') : './admin';
      const teacherPath = inSubDir ? (window.location.pathname.includes('/teacher/') ? '.' : '../teacher') : './teacher';

      let links = '';
      let mobileDrawerLinks = '';

      if (isAdmin) {
        links = `
          <a href="${adminPath}/dashboard.html" class="${activeTab === 'dashboard' ? 'active' : ''}">Overview</a>
          <a href="${adminPath}/students.html" class="${activeTab === 'students' ? 'active' : ''}">Students</a>
          <a href="${adminPath}/teachers.html" class="${activeTab === 'teachers' ? 'active' : ''}">Teachers</a>
          <a href="${adminPath}/passages.html" class="${activeTab === 'passages' ? 'active' : ''}">Passages</a>
          <a href="${adminPath}/reports.html" class="${activeTab === 'reports' ? 'active' : ''}">Reports</a>
        `;
        mobileDrawerLinks = `
          <a href="${adminPath}/dashboard.html" class="drawer-link ${activeTab === 'dashboard' ? 'active' : ''}">📊 Overview</a>
          <a href="${adminPath}/students.html" class="drawer-link ${activeTab === 'students' ? 'active' : ''}">🎓 Students</a>
          <a href="${adminPath}/teachers.html" class="drawer-link ${activeTab === 'teachers' ? 'active' : ''}">👩‍🏫 Teacher Allotment</a>
          <a href="${adminPath}/passages.html" class="drawer-link ${activeTab === 'passages' ? 'active' : ''}">📖 Passages</a>
          <a href="${adminPath}/reports.html" class="drawer-link ${activeTab === 'reports' ? 'active' : ''}">📈 School Reports</a>
        `;
      } else {
        links = `
          <a href="${teacherPath}/dashboard.html" class="${activeTab === 'dashboard' ? 'active' : ''}">Dashboard</a>
          <a href="${teacherPath}/students.html" class="${activeTab === 'students' ? 'active' : ''}">My Students</a>
          <a href="${teacherPath}/reports.html" class="${activeTab === 'reports' ? 'active' : ''}">Reports</a>
          <a href="${teacherPath}/test.html" class="btn-test-nav ${activeTab === 'test' ? 'active' : ''}">⚡ Run Test</a>
        `;
        mobileDrawerLinks = `
          <a href="${teacherPath}/dashboard.html" class="drawer-link ${activeTab === 'dashboard' ? 'active' : ''}">🏠 Dashboard</a>
          <a href="${teacherPath}/students.html" class="drawer-link ${activeTab === 'students' ? 'active' : ''}">👥 My Students</a>
          <a href="${teacherPath}/reports.html" class="drawer-link ${activeTab === 'reports' ? 'active' : ''}">📊 Reports & Analytics</a>
          <a href="${teacherPath}/test.html" class="drawer-link drawer-cta ${activeTab === 'test' ? 'active' : ''}">⚡ Run Fluency Test</a>
        `;
      }

      const assetPath = `${basePath}/assets`;

      container.innerHTML = `
        <div class="nav-wrap">
          <div class="nav-left">
            <div class="nav-brand" onclick="window.location.href='${isAdmin ? adminPath + '/dashboard.html' : teacherPath + '/dashboard.html'}'">
              <img src="${assetPath}/kv_logo.png" alt="KV" class="nav-logo" onerror="this.style.display='none'">
              <img src="${assetPath}/pm_shri_logo.png" alt="PM SHRI" class="nav-logo" onerror="this.style.display='none'">
              <span class="nav-title">Vaachan</span>
            </div>
          </div>
          
          <div class="nav-links desktop-links">${links}</div>

          <div class="nav-right">
            <div class="nav-profile desktop-profile">
              <span class="user-greeting">Namaste, <b>${this.escapeHtml(userName)}</b></span>
              <button class="logout-btn" onclick="window.auth.signOut()" title="Sign Out">Logout</button>
            </div>
            
            <!-- Mobile Menu Hamburger Button -->
            <button class="nav-menu-toggle" id="nav-toggle-btn" aria-label="Toggle navigation menu" onclick="window.utils.toggleMobileNav()">
              <svg class="menu-icon-bars" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              <svg class="menu-icon-close hidden" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Mobile Horizontal Tab Pills -->
        <div class="mobile-tab-bar">
          ${links}
        </div>

        <!-- Mobile Slide-out Drawer -->
        <div class="mobile-drawer hidden" id="mobile-nav-drawer">
          <div class="drawer-header">
            <div class="drawer-user">
              <div class="drawer-avatar">${this.escapeHtml(userName.charAt(0).toUpperCase())}</div>
              <div>
                <div class="drawer-name">${this.escapeHtml(userName)}</div>
                <div class="drawer-role">${isAdmin ? 'School Administrator' : 'Class Teacher'}</div>
              </div>
            </div>
          </div>
          <div class="drawer-nav">
            ${mobileDrawerLinks}
          </div>
          <div class="drawer-footer">
            <button class="btn btn-ghost btn-full" onclick="window.auth.signOut()" style="color:#fff; border-color:rgba(255,255,255,0.25);">
              🚪 Log Out
            </button>
          </div>
        </div>
      `;

      // Inject standard navbar CSS globally if not present
      if (!document.getElementById('nav-styles')) {
        const style = document.createElement('style');
        style.id = 'nav-styles';
        style.textContent = `
          #nav-container {
            background: rgba(27, 42, 74, 0.96);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            color: #fff;
            padding: max(10px, env(safe-area-inset-top, 10px)) 20px 10px;
            box-shadow: 0 4px 20px rgba(20,32,59,0.18);
            margin-bottom: 22px;
            position: sticky;
            top: 0;
            z-index: 1000;
            width: 100%;
            transition: all 0.2s ease;
          }
          .nav-wrap {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .nav-left { display: flex; align-items: center; gap: 14px; }
          .nav-brand {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
          }
          .nav-logo {
            height: 32px;
            width: auto;
            object-fit: contain;
            background: #fff;
            border-radius: 6px;
            padding: 2px;
          }
          .nav-title {
            font-family: 'Baloo 2', sans-serif;
            font-size: 1.45rem;
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
            font-size: 0.92rem;
            padding: 8px 14px;
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
            background: rgba(255,255,255,0.16);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
          }
          .nav-links a.btn-test-nav {
            background: linear-gradient(135deg, var(--marigold), var(--marigold-deep));
            color: #1B2A4A !important;
            font-weight: 800;
            box-shadow: 0 3px 10px rgba(232,163,61,0.35);
          }
          .nav-links a.btn-test-nav:hover {
            background: #f0b555;
            transform: translateY(-1px);
          }
          .nav-profile {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .user-greeting {
            font-size: 0.85rem;
            color: #E4DCC8;
            white-space: nowrap;
          }
          .logout-btn {
            background: transparent;
            border: 1.5px solid rgba(228,220,200,0.4);
            color: #E4DCC8;
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .logout-btn:hover {
            color: #fff;
            border-color: #fff;
            background: rgba(255,255,255,0.1);
          }
          
          .nav-menu-toggle {
            display: none;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            color: #fff;
            padding: 8px;
            border-radius: 8px;
            cursor: pointer;
            touch-action: manipulation;
          }
          
          .mobile-tab-bar {
            display: none;
          }

          .mobile-drawer {
            display: none;
            background: #15213A;
            border-top: 1px solid rgba(255,255,255,0.1);
            padding: 16px 14px 20px;
            margin: 10px -20px -10px;
            animation: drawerSlide 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @keyframes drawerSlide {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .drawer-header {
            padding-bottom: 14px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            margin-bottom: 12px;
          }
          .drawer-user {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .drawer-avatar {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: var(--marigold);
            color: var(--indigo);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 1.1rem;
          }
          .drawer-name { font-weight: 700; font-size: 0.95rem; color: #fff; }
          .drawer-role { font-size: 0.76rem; color: #A4B1CD; }
          .drawer-nav { display: flex; flex-direction: column; gap: 6px; }
          .drawer-link {
            color: #D6DCED;
            text-decoration: none;
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 0.95rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            transition: all 0.15s ease;
          }
          .drawer-link:active, .drawer-link.active {
            background: rgba(255,255,255,0.12);
            color: #fff;
          }
          .drawer-cta {
            background: var(--marigold);
            color: var(--indigo) !important;
            font-weight: 800;
            margin-top: 4px;
          }
          .drawer-footer { margin-top: 14px; }

          @media (max-width: 768px) {
            #nav-container {
              padding: max(8px, env(safe-area-inset-top, 8px)) 12px 8px;
              margin-bottom: 14px;
            }
            .desktop-links, .desktop-profile { display: none !important; }
            .nav-menu-toggle { display: flex; align-items: center; justify-content: center; }
            .mobile-drawer:not(.hidden) { display: block; }
            .nav-brand span { font-size: 1.25rem; }
            .nav-logo { height: 26px; }
            
            /* Responsive horizontal scrollable pill bar on mobile */
            .mobile-tab-bar {
              display: flex;
              gap: 6px;
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
              padding: 6px 0 2px;
              margin: 4px -4px 0;
              scrollbar-width: none;
            }
            .mobile-tab-bar::-webkit-scrollbar { display: none; }
            .mobile-tab-bar a {
              color: #C0C8DB;
              text-decoration: none;
              font-size: 0.8rem;
              font-weight: 600;
              padding: 6px 12px;
              border-radius: 20px;
              background: rgba(255,255,255,0.06);
              white-space: nowrap;
              flex-shrink: 0;
              transition: all 0.12s ease;
            }
            .mobile-tab-bar a.active {
              color: #fff;
              background: rgba(255,255,255,0.2);
            }
            .mobile-tab-bar a.btn-test-nav {
              background: var(--marigold);
              color: var(--indigo) !important;
              font-weight: 700;
            }
          }
        `;
        document.head.appendChild(style);
      }
    },

    toggleMobileNav() {
      const drawer = document.getElementById('mobile-nav-drawer');
      const toggleBtn = document.getElementById('nav-toggle-btn');
      if (!drawer || !toggleBtn) return;

      const isClosed = drawer.classList.contains('hidden');
      const iconBars = toggleBtn.querySelector('.menu-icon-bars');
      const iconClose = toggleBtn.querySelector('.menu-icon-close');

      if (isClosed) {
        drawer.classList.remove('hidden');
        if (iconBars) iconBars.classList.add('hidden');
        if (iconClose) iconClose.classList.remove('hidden');
      } else {
        drawer.classList.add('hidden');
        if (iconBars) iconBars.classList.remove('hidden');
        if (iconClose) iconClose.classList.add('hidden');
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

      // Tap to dismiss
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

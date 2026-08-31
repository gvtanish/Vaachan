// Shared Utilities and UI Helpers
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
        4: { label: 'Level 4: Fluent', class: 'bg-mint' },
        3: { label: 'Level 3: Primarily Fluent', class: 'bg-indigo' },
        2: { label: 'Level 2: Developing', class: 'bg-marigold' },
        1: { label: 'Level 1: Non-fluent', class: 'bg-coral' }
      };
      const info = badges[level] || { label: 'Unknown', class: 'bg-soft' };
      return `<span class="naep-badge ${info.class}">${info.label}</span>`;
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
          return `<span class="diff-sub" title="Heard: '${escapedHeard}' instead of '${escapedRef}'" style="border-bottom: 2.5px solid var(--marigold); color: var(--ink); padding: 0 2px;">${escapedRef}</span>`;
        } else if (item.type === 'omission') {
          return `<span class="diff-om" title="Word skipped" style="text-decoration: line-through; color: var(--coral); opacity: 0.8; padding: 0 2px;">${escapedRef}</span>`;
        } else if (item.type === 'insertion') {
          return `<span class="diff-ins" title="Extra word spoken" style="font-style: italic; color: var(--mint); text-decoration: underline dotted; padding: 0 2px;">${escapedHeard}</span>`;
        }
        return '';
      }).join(' ');
    },

    // Setup global navigation header/nav block for dashboards
    renderNav(activeTab, isAdmin) {
      const container = document.getElementById('nav-container');
      if (!container) return;

      const userRole = sessionStorage.getItem('VAACHAN_USER_ROLE');
      const userName = sessionStorage.getItem('VAACHAN_USER_NAME') || 'User';

      let links = '';
      if (isAdmin) {
        links = `
          <a href="/admin/dashboard.html" class="${activeTab === 'dashboard' ? 'active' : ''}">Overview</a>
          <a href="/admin/students.html" class="${activeTab === 'students' ? 'active' : ''}">Students</a>
          <a href="/admin/teachers.html" class="${activeTab === 'teachers' ? 'active' : ''}">Teacher Allotment</a>
          <a href="/admin/passages.html" class="${activeTab === 'passages' ? 'active' : ''}">Passages</a>
          <a href="/admin/reports.html" class="${activeTab === 'reports' ? 'active' : ''}">School Reports</a>
        `;
      } else {
        links = `
          <a href="/teacher/dashboard.html" class="${activeTab === 'dashboard' ? 'active' : ''}">Dashboard</a>
          <a href="/teacher/students.html" class="${activeTab === 'students' ? 'active' : ''}">My Students</a>
          <a href="/teacher/reports.html" class="${activeTab === 'reports' ? 'active' : ''}">Reports & Analytics</a>
          <a href="/teacher/test.html" class="btn-test-nav ${activeTab === 'test' ? 'active' : ''}">Run Fluency Test</a>
        `;
      }

      const assetPath = (window.location.pathname.includes('/admin/') || window.location.pathname.includes('/teacher/')) ? '../assets' : './assets';

      container.innerHTML = `
        <div class="nav-wrap">
          <div class="nav-brand" onclick="window.location.href='${isAdmin ? '/admin/dashboard.html' : '/teacher/dashboard.html'}'">
            <img src="${assetPath}/kv_logo.png" alt="KV" style="height:32px; width:auto; object-fit:contain; background:#fff; border-radius:4px; padding:2px;">
            <img src="${assetPath}/pm_shri_logo.png" alt="PM SHRI" style="height:32px; width:auto; object-fit:contain; background:#fff; border-radius:4px; padding:2px;">
            <span>Vaachan</span>
          </div>
          <div class="nav-links">${links}</div>
          <div class="nav-profile">
            <span class="user-greeting">Namaste, <b>${this.escapeHtml(userName)}</b></span>
            <button class="logout-btn" onclick="window.auth.signOut()">Logout</button>
          </div>
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
            padding: 10px 20px;
            box-shadow: 0 4px 15px rgba(20,32,59,0.15);
            margin-bottom: 24px;
          }
          .nav-wrap {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 15px;
          }
          .nav-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
          }
          .nav-brand svg { width: 28px; height: 28px; }
          .nav-brand span {
            font-family: 'Baloo 2', sans-serif;
            font-size: 1.4rem;
            font-weight: 800;
            letter-spacing: -0.01em;
          }
          .nav-links {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .nav-links a {
            color: #C0C8DB;
            text-decoration: none;
            font-weight: 500;
            font-size: 0.92rem;
            padding: 8px 14px;
            border-radius: 8px;
            transition: all 0.2s ease;
          }
          .nav-links a:hover, .nav-links a.active {
            color: #fff;
            background: rgba(255,255,255,0.08);
          }
          .nav-links a.btn-test-nav {
            background: var(--marigold, #E8A33D);
            color: #1B2A4A !important;
            font-weight: 700;
          }
          .nav-links a.btn-test-nav:hover {
            background: #f0b555;
          }
          .nav-profile {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .user-greeting { font-size: 0.85rem; color: #E4DCC8; }
          .logout-btn {
            background: transparent;
            border: 1px solid rgba(228,220,200,0.4);
            color: #E4DCC8;
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .logout-btn:hover {
            color: #fff;
            border-color: #fff;
            background: rgba(255,255,255,0.05);
          }
          @media (max-width: 768px) {
            #nav-container {
              padding: 10px 12px;
              margin-bottom: 16px;
            }
            .nav-wrap {
              flex-direction: row;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 12px;
            }
            .nav-links {
              display: flex;
              flex-direction: row;
              overflow-x: auto;
              white-space: nowrap;
              flex: none;
              order: 3;
              width: 100%;
              min-width: 0;
              margin: 0;
              padding-bottom: 2px;
              scrollbar-width: none;
            }
            .nav-links::-webkit-scrollbar {
              display: none;
            }
            .nav-links a {
              padding: 6px 12px;
              font-size: 0.82rem;
            }
            .user-greeting {
              display: none;
            }
            .nav-profile {
              flex-shrink: 0;
            }
            .logout-btn {
              padding: 4px 8px;
              font-size: 0.75rem;
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

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = 'none';
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  };
})();

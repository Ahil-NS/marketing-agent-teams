/* ============================================
   MAT Dashboard - App Core
   Router, SSE, Utilities
   ============================================ */

(function () {
  'use strict';

  // --- Views Registry ---
  const views = {};

  function registerView(name, view) {
    views[name] = view;
  }

  // --- Router ---
  const router = {
    currentView: null,

    init() {
      window.addEventListener('hashchange', () => this.navigate());
      this.navigate();
    },

    navigate() {
      const hash = (location.hash || '#pipeline').slice(1);
      const viewName = hash.split('/')[0] || 'pipeline';
      this.render(viewName);
    },

    render(viewName) {
      const view = views[viewName];
      const app = document.getElementById('app');

      if (!view) {
        app.innerHTML = `<div class="loading-placeholder"><p>View not found: ${viewName}</p></div>`;
        return;
      }

      // Update nav active states
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.view === viewName);
      });

      // Teardown previous view
      if (this.currentView && views[this.currentView] && views[this.currentView].destroy) {
        views[this.currentView].destroy();
      }

      this.currentView = viewName;

      // Render and init
      app.innerHTML = view.render();
      if (view.init) {
        view.init();
      }
    }
  };

  // --- SSE Connection Manager ---
  const sse = {
    source: null,
    listeners: new Map(),
    reconnectDelay: 2000,
    maxReconnectDelay: 30000,
    currentDelay: 2000,

    connect() {
      if (this.source) {
        this.source.close();
      }

      const indicator = document.getElementById('sse-indicator');

      try {
        this.source = new EventSource('/api/events');

        this.source.onopen = () => {
          if (indicator) indicator.classList.add('connected');
          this.currentDelay = this.reconnectDelay;
        };

        this.source.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.dispatch(data.type || 'message', data);
          } catch {
            // Ignore malformed messages
          }
        };

        this.source.onerror = () => {
          if (indicator) indicator.classList.remove('connected');
          this.source.close();
          this.source = null;
          this.scheduleReconnect();
        };
      } catch {
        this.scheduleReconnect();
      }
    },

    scheduleReconnect() {
      setTimeout(() => this.connect(), this.currentDelay);
      this.currentDelay = Math.min(this.currentDelay * 1.5, this.maxReconnectDelay);
    },

    on(eventType, callback) {
      if (!this.listeners.has(eventType)) {
        this.listeners.set(eventType, new Set());
      }
      this.listeners.get(eventType).add(callback);
    },

    off(eventType, callback) {
      const set = this.listeners.get(eventType);
      if (set) set.delete(callback);
    },

    dispatch(eventType, data) {
      const set = this.listeners.get(eventType);
      if (set) {
        set.forEach(cb => {
          try { cb(data); } catch (err) { console.error('SSE listener error:', err); }
        });
      }
    },

    disconnect() {
      if (this.source) {
        this.source.close();
        this.source = null;
      }
      const indicator = document.getElementById('sse-indicator');
      if (indicator) indicator.classList.remove('connected');
    }
  };

  // --- Utility Functions ---

  async function fetchJSON(url, options = {}) {
    const defaults = {
      headers: { 'Content-Type': 'application/json' }
    };
    const merged = { ...defaults, ...options };
    if (merged.body && typeof merged.body === 'object') {
      merged.body = JSON.stringify(merged.body);
    }
    const response = await fetch(url, merged);
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
      err.status = response.status;
      try { err.data = await response.json(); } catch { /* ignore */ }
      throw err;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatCost(usd) {
    if (usd == null || isNaN(usd)) return '-';
    return '$' + Number(usd).toFixed(4);
  }

  function formatDuration(ms) {
    if (!ms || ms <= 0) return '-';
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}m ${remSecs}s`;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }

  function statusBadge(status) {
    const s = (status || 'pending').toLowerCase();
    return `<span class="badge badge-${s}">${s}</span>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Start SSE ---
  sse.connect();

  // --- Export Global API ---
  window.MAT = {
    router,
    sse,
    registerView,
    fetchJSON,
    formatDate,
    formatCost,
    formatDuration,
    showToast,
    statusBadge,
    escapeHtml
  };
})();

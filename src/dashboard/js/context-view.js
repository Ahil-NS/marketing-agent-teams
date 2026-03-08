/* ============================================
   MAT Dashboard - Context View
   Brand context viewer/editor
   ============================================ */

(function () {
  'use strict';

  let contextData = { exists: false, content: '', path: '' };
  let isEditing = false;

  function render() {
    return `
      <div class="section-header">
        <h1 class="section-title">Brand Context</h1>
        <div class="btn-group">
          <button class="btn" id="context-edit-btn">${isEditing ? 'Cancel' : 'Edit'}</button>
          ${isEditing ? '<button class="btn btn-primary" id="context-save-btn">Save</button>' : ''}
          <button class="btn" id="context-refresh-btn">Refresh</button>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          ${isEditing ? `
            <textarea class="form-textarea" id="context-editor"
              style="min-height: 400px; font-family: monospace; font-size: 13px; line-height: 1.5;">${MAT.escapeHtml(contextData.content)}</textarea>
          ` : contextData.content ? `
            <pre class="context-content" id="context-display" style="white-space: pre-wrap; font-size: 13px; line-height: 1.6;">${MAT.escapeHtml(contextData.content)}</pre>
          ` : `
            <div class="loading-placeholder" style="padding: 40px;">
              <p>No brand context configured yet.</p>
              <p style="color: var(--text-muted); font-size: 13px; margin-top: 8px;">
                Click <strong>Edit</strong> to add your brand context, or run <code>mat context --init</code> in the CLI.
              </p>
            </div>
          `}
        </div>
        <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; color: var(--text-muted);">
            ${contextData.exists ? 'Context file exists' : 'No context file'}
          </span>
          <span style="font-size: 12px; color: var(--text-muted);">
            ${contextData.path || ''}
          </span>
        </div>
      </div>
    `;
  }

  function rerender() {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = render();
    bindEvents();
  }

  async function loadContext() {
    try {
      const data = await MAT.fetchJSON('/api/context');
      contextData = {
        exists: data.exists || false,
        content: data.content || '',
        path: data.path || ''
      };
      rerender();
    } catch {
      contextData = { exists: false, content: '', path: '' };
      rerender();
    }
  }

  async function saveContext() {
    const editor = document.getElementById('context-editor');
    if (!editor) return;

    try {
      await MAT.fetchJSON('/api/context', {
        method: 'PUT',
        body: { content: editor.value }
      });
      contextData.content = editor.value;
      contextData.exists = true;
      isEditing = false;
      rerender();
      MAT.showToast('Brand context saved', 'success');
    } catch {
      MAT.showToast('Failed to save context', 'error');
    }
  }

  function bindEvents() {
    document.getElementById('context-edit-btn')?.addEventListener('click', () => {
      isEditing = !isEditing;
      rerender();
    });

    document.getElementById('context-save-btn')?.addEventListener('click', saveContext);
    document.getElementById('context-refresh-btn')?.addEventListener('click', loadContext);
  }

  function init() {
    bindEvents();
    loadContext();
  }

  function destroy() {
    isEditing = false;
  }

  MAT.registerView('context', { render, init, destroy });
})();

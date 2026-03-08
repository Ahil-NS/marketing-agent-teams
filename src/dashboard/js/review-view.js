/* ============================================
   MAT Dashboard - Review View
   ============================================ */

(function () {
  'use strict';

  let items = [];
  let filterPlatform = 'all';
  let filterStatus = 'all';
  let editingId = null;
  let sseHandler = null;

  function render() {
    return `
      <div class="section-header">
        <h1 class="section-title">Content Review</h1>
        <div class="btn-group">
          <button class="btn btn-success btn-sm" id="bulk-approve-btn" disabled>Bulk Approve</button>
          <button class="btn btn-primary btn-sm" id="resume-pipeline-btn" style="display: none;">Resume Pipeline</button>
          <button class="btn btn-sm" id="refresh-review-btn">Refresh</button>
        </div>
      </div>

      <div class="filter-bar">
        <select class="form-select" id="filter-platform" style="width: auto;">
          <option value="all">All Platforms</option>
          <option value="reddit">Reddit</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
        </select>
        <select class="form-select" id="filter-status" style="width: auto;">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <label class="form-checkbox" id="select-all-wrap">
          <input type="checkbox" id="select-all-checkbox">
          Select All Visible
        </label>
      </div>

      <div class="grid grid-2" id="review-cards">
        <div class="loading-placeholder"><p>Loading content...</p></div>
      </div>
    `;
  }

  function qualityClass(score) {
    if (score >= 80) return 'quality-high';
    if (score >= 50) return 'quality-medium';
    return 'quality-low';
  }

  function formatContent(content) {
    if (typeof content === 'string') return MAT.escapeHtml(content);
    if (!content || typeof content !== 'object') return '-';
    const parts = [];
    if (content.title) parts.push('<strong>' + MAT.escapeHtml(content.title) + '</strong>');
    if (content.body) parts.push('<div style="white-space: pre-wrap;">' + MAT.escapeHtml(content.body) + '</div>');
    if (content.hashtags && content.hashtags.length) {
      parts.push('<div style="margin-top: 8px; color: var(--accent);">' + content.hashtags.map(t => '#' + MAT.escapeHtml(t)).join(' ') + '</div>');
    }
    if (content.hooks && content.hooks.length) {
      parts.push('<div style="margin-top: 8px; font-style: italic; color: var(--text-secondary);">Hooks: ' + content.hooks.map(h => MAT.escapeHtml(h)).join(' | ') + '</div>');
    }
    if (content.cta) {
      parts.push('<div style="margin-top: 4px; color: var(--text-secondary);">CTA: ' + MAT.escapeHtml(content.cta) + '</div>');
    }
    return parts.length > 0 ? parts.join('') : MAT.escapeHtml(JSON.stringify(content));
  }

  function getEditableText(content) {
    if (typeof content === 'string') return content;
    if (!content || typeof content !== 'object') return '';
    return content.body || '';
  }

  function renderCard(item) {
    const isEditing = editingId === item.id;
    const displayScore = item.qualityScore != null
      ? (item.qualityScore <= 1 ? Math.round(item.qualityScore * 100) : Math.round(item.qualityScore))
      : '-';
    return `
      <div class="card review-card" data-id="${item.id}" data-platform="${item.platform}" data-status="${item.status}">
        <div class="card-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label class="form-checkbox" style="margin: 0;">
              <input type="checkbox" class="review-checkbox" data-id="${item.id}"
                ${item.status !== 'pending' ? 'disabled' : ''}>
            </label>
            <span class="platform-icon">${MAT.escapeHtml(item.platform)}</span>
            ${MAT.statusBadge(item.status)}
            <span style="font-size: 11px; color: var(--text-muted);">${MAT.escapeHtml(item.generatedBy || '')}</span>
          </div>
          <div class="quality-score ${qualityClass(displayScore)}">${displayScore}</div>
        </div>
        <div class="card-body">
          ${isEditing ? `
            <textarea class="form-textarea edit-content" data-id="${item.id}"
              style="min-height: 120px;">${MAT.escapeHtml(getEditableText(item.content))}</textarea>
          ` : `
            <div class="content-preview">${formatContent(item.content)}</div>
          `}
        </div>
        <div class="card-footer">
          ${item.status === 'pending' || item.status === 'edited' ? `
            <button class="btn btn-success btn-sm approve-btn" data-id="${item.id}">Approve</button>
            <button class="btn btn-danger btn-sm reject-btn" data-id="${item.id}">Reject</button>
            ${isEditing ? `
              <button class="btn btn-primary btn-sm save-edit-btn" data-id="${item.id}">Save</button>
              <button class="btn btn-sm cancel-edit-btn" data-id="${item.id}">Cancel</button>
            ` : `
              <button class="btn btn-sm edit-btn" data-id="${item.id}">Edit</button>
            `}
          ` : `
            <span style="font-size: 12px; color: var(--text-muted);">
              ${item.status === 'approved' ? 'Approved' : 'Rejected'}
              ${item.userFeedback && item.userFeedback.editedAt ? ' - ' + MAT.formatDate(item.userFeedback.editedAt) : ''}
            </span>
          `}
        </div>
      </div>
    `;
  }

  function renderCards() {
    const container = document.getElementById('review-cards');
    if (!container) return;

    const filtered = items.filter(item => {
      if (filterPlatform !== 'all' && item.platform !== filterPlatform) return false;
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="loading-placeholder"><p>No content to review</p></div>';
      return;
    }

    container.innerHTML = filtered.map(renderCard).join('');
    updateBulkButton();

    // Show resume button if all items for any run are approved
    const resumeBtn = document.getElementById('resume-pipeline-btn');
    if (resumeBtn) {
      const resumeRunId = getResumeRunId();
      if (resumeRunId) {
        resumeBtn.style.display = '';
        resumeBtn.dataset.runId = resumeRunId;
      } else {
        resumeBtn.style.display = 'none';
      }
    }
  }

  function updateBulkButton() {
    const checked = document.querySelectorAll('.review-checkbox:checked');
    const btn = document.getElementById('bulk-approve-btn');
    if (btn) btn.disabled = checked.length === 0;
  }

  async function loadItems() {
    try {
      items = await MAT.fetchJSON('/api/review');
      renderCards();
    } catch {
      const container = document.getElementById('review-cards');
      if (container) {
        container.innerHTML = '<div class="loading-placeholder"><p>Failed to load review items</p></div>';
      }
    }
  }

  async function approveItem(id) {
    try {
      const result = await MAT.fetchJSON(`/api/review/${id}/approve`, { method: 'POST' });
      const item = items.find(i => i.id === id);
      if (item) {
        item.status = 'approved';
        item.reviewedAt = new Date().toISOString();
      }
      renderCards();
      if (result.autoResumed) {
        MAT.showToast('All content approved — pipeline resuming to distribution!', 'success');
      } else {
        MAT.showToast('Content approved', 'success');
      }
    } catch {
      MAT.showToast('Failed to approve', 'error');
    }
  }

  async function rejectItem(id) {
    try {
      await MAT.fetchJSON(`/api/review/${id}/reject`, { method: 'POST' });
      const item = items.find(i => i.id === id);
      if (item) {
        item.status = 'rejected';
        item.reviewedAt = new Date().toISOString();
      }
      renderCards();
      MAT.showToast('Content rejected', 'success');
    } catch {
      MAT.showToast('Failed to reject', 'error');
    }
  }

  async function saveEdit(id) {
    const textarea = document.querySelector(`.edit-content[data-id="${id}"]`);
    if (!textarea) return;

    try {
      await MAT.fetchJSON(`/api/review/${id}/edit`, {
        method: 'POST',
        body: { edits: { content: textarea.value } }
      });
      const item = items.find(i => i.id === id);
      if (item) item.content = textarea.value;
      editingId = null;
      renderCards();
      MAT.showToast('Content updated', 'success');
    } catch {
      MAT.showToast('Failed to save edit', 'error');
    }
  }

  async function bulkApprove() {
    const checked = document.querySelectorAll('.review-checkbox:checked');
    const ids = Array.from(checked).map(cb => cb.dataset.id);

    for (const id of ids) {
      await approveItem(id);
    }
  }

  async function resumePipeline(runId) {
    try {
      const result = await MAT.fetchJSON(`/api/runs/${runId}/resume`, { method: 'POST' });
      if (result.status === 'resuming') {
        MAT.showToast('Pipeline resuming — distribution stage starting...', 'success');
      } else {
        MAT.showToast('Failed to resume pipeline', 'error');
      }
    } catch (err) {
      MAT.showToast('Failed to resume: ' + (err.message || 'unknown error'), 'error');
    }
  }

  function getResumeRunId() {
    // Find a run ID where all items are approved
    const runIds = [...new Set(items.map(i => i.runId))];
    for (const runId of runIds) {
      const runItems = items.filter(i => i.runId === runId);
      if (runItems.length > 0 && runItems.every(i => i.status === 'approved')) {
        return runId;
      }
    }
    return null;
  }

  function handleSSE(data) {
    if (data.type === 'review:new' && data.item) {
      items.unshift(data.item);
      renderCards();
    }
  }

  function init() {
    loadItems();

    const container = document.getElementById('review-cards');
    container?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;

      if (btn.classList.contains('approve-btn')) approveItem(id);
      else if (btn.classList.contains('reject-btn')) rejectItem(id);
      else if (btn.classList.contains('edit-btn')) { editingId = id; renderCards(); }
      else if (btn.classList.contains('save-edit-btn')) saveEdit(id);
      else if (btn.classList.contains('cancel-edit-btn')) { editingId = null; renderCards(); }
    });

    container?.addEventListener('change', (e) => {
      if (e.target.classList.contains('review-checkbox')) updateBulkButton();
    });

    document.getElementById('filter-platform')?.addEventListener('change', (e) => {
      filterPlatform = e.target.value;
      renderCards();
    });

    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      filterStatus = e.target.value;
      renderCards();
    });

    document.getElementById('select-all-checkbox')?.addEventListener('change', (e) => {
      document.querySelectorAll('.review-checkbox:not(:disabled)').forEach(cb => {
        cb.checked = e.target.checked;
      });
      updateBulkButton();
    });

    document.getElementById('bulk-approve-btn')?.addEventListener('click', bulkApprove);
    document.getElementById('resume-pipeline-btn')?.addEventListener('click', (e) => {
      const runId = e.target.dataset.runId;
      if (runId) resumePipeline(runId);
    });
    document.getElementById('refresh-review-btn')?.addEventListener('click', loadItems);

    sseHandler = handleSSE;
    MAT.sse.on('review:new', sseHandler);
  }

  function destroy() {
    editingId = null;
    if (sseHandler) {
      MAT.sse.off('review:new', sseHandler);
      sseHandler = null;
    }
  }

  MAT.registerView('review', { render, init, destroy });
})();

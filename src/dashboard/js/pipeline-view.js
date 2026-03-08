/* ============================================
   MAT Dashboard - Pipeline View
   ============================================ */

(function () {
  'use strict';

  const STAGES = [
    { key: 'research', name: 'Research' },
    { key: 'strategy', name: 'Strategy' },
    { key: 'creation', name: 'Creation' },
    { key: 'optimization', name: 'Optimization' },
    { key: 'quality', name: 'Quality' },
    { key: 'review', name: 'Review' },
    { key: 'distribution', name: 'Distribution' }
  ];

  // Known agents per stage (for showing "expected" agents while running)
  const STAGE_AGENTS = {
    research: ['trend-scout', 'audience-researcher', 'competitor-analyst', 'viral-pattern-decoder', 'platform-algorithm'],
    strategy: ['content-strategist', 'campaign-planner', 'channel-optimizer'],
    creation: ['reddit-creator', 'tiktok-creator', 'facebook-creator', 'instagram-creator', 'hook-writer', 'content-atomizer'],
    optimization: ['seo-optimizer', 'ab-test-designer', 'timing-optimizer', 'content-humanizer', 'hashtag-strategist'],
    quality: ['brand-guardian', 'fact-checker', 'platform-compliance', 'sensitivity-reviewer'],
    review: [],
    distribution: ['reddit-publisher', 'tiktok-publisher', 'facebook-publisher', 'instagram-publisher']
  };

  let currentRun = null;
  let runs = [];
  let sseHandler = null;
  let pollInterval = null;
  let selectedStage = null;

  function render() {
    return `
      <div class="section-header">
        <h1 class="section-title">Pipeline</h1>
        <div class="btn-group">
          <button class="btn btn-primary" id="new-run-btn">New Run</button>
          <button class="btn btn-danger btn-sm" id="clear-failed-btn">Clear Failed</button>
          <button class="btn btn-danger btn-sm" id="clear-all-btn">Clear All</button>
          <button class="btn" id="refresh-runs-btn">Refresh</button>
        </div>
      </div>

      <div class="pipeline-flow" id="pipeline-stages">
        ${STAGES.map(s => stageCard(s.key, s.name)).join('')}
      </div>

      <div id="stage-detail-panel" class="stage-detail-panel" style="display:none;"></div>

      <div class="section-header" style="margin-top: 32px;">
        <h2 class="section-title" style="font-size: 16px;">Recent Runs</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Started</th>
              <th>Status</th>
              <th>Platforms</th>
              <th>Cost</th>
              <th>Duration</th>
              <th style="width: 60px;"></th>
            </tr>
          </thead>
          <tbody id="runs-table-body">
            <tr><td colspan="7" style="text-align:center; color: var(--text-muted);">Loading...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="new-run-modal" class="modal-overlay" style="display:none;">
        <div class="modal">
          <h3 class="modal-title">Start New Pipeline Run</h3>
          <form id="new-run-form">
            <div class="form-group">
              <label class="form-label">Platforms</label>
              <div class="form-row">
                ${['reddit', 'tiktok', 'instagram', 'facebook'].map(p => `
                  <label class="form-checkbox">
                    <input type="checkbox" name="platforms" value="${p}" checked>
                    ${p.charAt(0).toUpperCase() + p.slice(1)}
                  </label>
                `).join('')}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Workflow Mode</label>
              <select class="form-select" name="mode">
                <option value="full">Full Pipeline</option>
                <option value="brief">From Brief (skip research)</option>
                <option value="idea">From Idea</option>
                <option value="optimize">Optimize Existing Content (ECT)</option>
              </select>
            </div>
            <div class="form-group mode-field mode-idea mode-full" style="display:none;">
              <label class="form-label">Topic / Idea</label>
              <input type="text" class="form-input" name="idea" placeholder="e.g., How AI tools help small businesses save time">
            </div>
            <div class="form-group mode-field mode-optimize" style="display:none;">
              <label class="form-label">Topic <span style="color:var(--danger)">*</span></label>
              <input type="text" class="form-input" name="topic" placeholder="e.g., How AI tools help small businesses">
            </div>
            <div class="form-group mode-field mode-optimize" style="display:none;">
              <label class="form-label">Niche</label>
              <input type="text" class="form-input" name="niche" placeholder="e.g., AI/SaaS, fitness, cooking">
            </div>
            <div class="form-group mode-field mode-optimize" style="display:none;">
              <label class="form-label">Target Audience</label>
              <input type="text" class="form-input" name="audience" placeholder="e.g., small business owners aged 25-45">
            </div>
            <div class="form-group mode-field mode-optimize" style="display:none;">
              <label class="form-label">Video Description</label>
              <textarea class="form-input" name="videoDescription" rows="3" placeholder="Describe the video content..."></textarea>
            </div>
            <div class="form-group mode-field mode-optimize" style="display:none;">
              <label class="form-label">Duration</label>
              <input type="text" class="form-input" name="duration" placeholder="e.g., 30s, 60s, 3m">
            </div>
            <div class="form-group">
              <label class="form-label">Posts per Platform</label>
              <input type="number" class="form-input" name="posts" value="1" min="1" max="10" style="width: 80px;">
            </div>
            <div class="form-group">
              <label class="form-checkbox">
                <input type="checkbox" name="dryRun" checked>
                Dry Run (no publishing)
              </label>
            </div>
            <div class="btn-group" style="justify-content: flex-end; margin-top: 20px;">
              <button type="button" class="btn" id="cancel-run-btn">Cancel</button>
              <button type="submit" class="btn btn-primary">Start Run</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function stageCard(key, name, data) {
    data = data || {};
    const status = data.status || 'pending';
    const agents = getAgentList(key, data);
    const agentCount = agents.length;
    const completedCount = agents.filter(a => a.status === 'success' || a.status === 'completed').length;
    const failedCount = agents.filter(a => a.status === 'failed').length;
    const runningCount = agents.filter(a => a.status === 'running').length;
    const duration = computeDuration(data);
    const hasError = data.error;
    const isSelected = selectedStage === key;

    // Progress bar for running stages
    const total = agents.length || 1;
    const progress = Math.round(((completedCount + failedCount) / total) * 100);

    return `
      <div class="stage-card stage-${status}${isSelected ? ' stage-selected' : ''}" data-stage="${key}" id="stage-${key}">
        <div class="stage-name">${name}</div>
        ${MAT.statusBadge(status)}
        ${status === 'running' ? `
          <div class="stage-progress">
            <div class="stage-progress-bar" style="width: ${progress}%"></div>
          </div>
          <div class="stage-progress-text">${completedCount + failedCount}/${agentCount} agents</div>
        ` : ''}
        <div class="stage-meta">
          ${key === 'review'
            ? '<span>Human review</span>'
            : agentCount > 0 ? `<span>${completedCount} done${failedCount > 0 ? `, ${failedCount} failed` : ''}${runningCount > 0 ? `, ${runningCount} running` : ''}</span>` : '<span>Agents: 0</span>'
          }
          <span>Duration: ${duration}</span>
        </div>
        ${hasError ? `<div class="stage-error" title="${MAT.escapeHtml(data.error.message || '')}">${MAT.escapeHtml(data.error.code || 'Error')}</div>` : ''}
        <div class="stage-agents" id="stage-agents-${key}"${agents.length > 0 && isSelected ? ' style="display:block"' : ''}>
          ${agents.map(a => agentRow(a)).join('')}
        </div>
        ${agentCount > 0 || key === 'review' ? `<div class="stage-toggle" data-stage="${key}">${key === 'review' ? 'View review items' : 'View details'}</div>` : ''}
      </div>
    `;
  }

  function agentRow(a) {
    const icon = a.status === 'success' || a.status === 'completed' ? '&#10003;'
      : a.status === 'failed' ? '&#10007;'
      : a.status === 'running' ? '&#9679;'
      : '&#9675;';
    const colorClass = a.status === 'success' || a.status === 'completed' ? 'agent-success'
      : a.status === 'failed' ? 'agent-failed'
      : a.status === 'running' ? 'agent-running'
      : 'agent-pending';

    return `
      <div class="stage-agent-item ${colorClass}" data-agent="${MAT.escapeHtml(a.name)}">
        <span class="agent-icon">${icon}</span>
        <span class="agent-name">${MAT.escapeHtml(a.name)}</span>
        ${a.duration ? `<span class="agent-duration">${MAT.formatDuration(a.duration)}</span>` : ''}
      </div>
    `;
  }

  function getAgentList(stageKey, data) {
    const results = data.agentResults || {};
    const resultEntries = Object.entries(results);

    if (resultEntries.length > 0) {
      // Use actual results
      return resultEntries.map(([name, r]) => ({
        name,
        status: r && r.status === 'success' ? 'success'
          : r && r.status === 'failed' ? 'failed'
          : r && r.error ? 'failed'
          : 'completed',
        duration: r && r.duration ? r.duration : null,
        result: r && r.result ? r.result : null,
        error: r && r.error ? r.error : null
      }));
    }

    // If stage is running but no results yet, show expected agents as "running"
    if (data.status === 'running') {
      const expected = STAGE_AGENTS[stageKey] || [];
      return expected.map(name => ({ name, status: 'running', duration: null, result: null, error: null }));
    }

    return [];
  }

  function computeDuration(data) {
    if (data.startedAt && data.completedAt) {
      return MAT.formatDuration(new Date(data.completedAt).getTime() - new Date(data.startedAt).getTime());
    }
    if (data.startedAt && data.status === 'running') {
      const elapsed = Date.now() - new Date(data.startedAt).getTime();
      return MAT.formatDuration(elapsed) + '...';
    }
    return '-';
  }

  function updateStageCards() {
    if (!currentRun || !currentRun.stages) return;
    for (const [key, data] of Object.entries(currentRun.stages)) {
      const stage = STAGES.find(s => s.key === key);
      if (!stage) continue;
      const el = document.getElementById(`stage-${key}`);
      if (!el) continue;
      el.outerHTML = stageCard(key, stage.name, data);
    }
  }

  async function renderStageDetail(stageKey) {
    const panel = document.getElementById('stage-detail-panel');
    if (!panel) return;

    if (!currentRun || !currentRun.stages || !currentRun.stages[stageKey]) {
      panel.style.display = 'none';
      return;
    }

    const data = currentRun.stages[stageKey];
    const stage = STAGES.find(s => s.key === stageKey);
    const agents = getAgentList(stageKey, data);

    // For review stage, fetch queued review items instead of showing agents
    let reviewContent = '';
    if (stageKey === 'review') {
      try {
        const items = await MAT.fetchJSON('/api/review');
        const pending = items.filter(i => i.status === 'pending');
        const approved = items.filter(i => i.status === 'approved');
        const rejected = items.filter(i => i.status === 'rejected');
        if (items.length > 0) {
          reviewContent = `
            <div class="detail-agents">
              <div style="padding: 12px; color: var(--text-secondary);">
                <strong>${items.length} item(s) in review queue</strong>
                — ${pending.length} pending, ${approved.length} approved, ${rejected.length} rejected
              </div>
              ${items.slice(0, 10).map(item => `
                <div class="detail-agent ${item.status === 'approved' ? 'detail-agent-success' : item.status === 'rejected' ? 'detail-agent-failed' : ''}">
                  <div class="detail-agent-header">
                    <span class="detail-agent-name">${MAT.escapeHtml(item.platform)} — ${MAT.escapeHtml(item.generatedBy)}</span>
                    ${MAT.statusBadge(item.status)}
                    <span class="detail-agent-duration">${item.qualityScore != null ? 'Quality: ' + Math.round(item.qualityScore * 100) + '%' : ''}</span>
                  </div>
                  <div class="detail-agent-output">
                    <pre>${MAT.escapeHtml(
                      (item.content.title ? item.content.title + '\n\n' : '') +
                      (item.content.body || '').slice(0, 300) +
                      ((item.content.body || '').length > 300 ? '...' : '') +
                      (item.content.hashtags && item.content.hashtags.length ? '\n\n' + item.content.hashtags.map(t => '#' + t).join(' ') : '')
                    )}</pre>
                  </div>
                </div>
              `).join('')}
              <div style="padding: 12px; text-align: center;">
                <a href="#review" class="btn btn-primary btn-sm">Go to Review</a>
              </div>
            </div>
          `;
        } else {
          reviewContent = '<div class="detail-agents"><div class="detail-empty">No content queued for review yet</div></div>';
        }
      } catch {
        reviewContent = '<div class="detail-agents"><div class="detail-empty">Failed to load review items</div></div>';
      }
    }

    panel.style.display = 'block';
    panel.innerHTML = `
      <div class="detail-header">
        <h3>${stage.name} Stage</h3>
        ${MAT.statusBadge(data.status || 'pending')}
        <span class="detail-duration">${computeDuration(data)}</span>
        <button class="btn btn-sm detail-close" id="close-detail">&times;</button>
      </div>
      ${data.error ? `
        <div class="detail-error">
          <strong>${MAT.escapeHtml(data.error.code || 'Error')}:</strong> ${MAT.escapeHtml(data.error.message || '')}
          ${data.error.resolution ? `<div class="detail-resolution">${MAT.escapeHtml(data.error.resolution)}</div>` : ''}
        </div>
      ` : ''}
      ${stageKey === 'review' ? reviewContent : `
        <div class="detail-agents">
          ${agents.length === 0 ? '<div class="detail-empty">No agents in this stage</div>' : ''}
          ${agents.map(a => `
            <div class="detail-agent ${a.status === 'failed' ? 'detail-agent-failed' : a.status === 'success' || a.status === 'completed' ? 'detail-agent-success' : ''}">
              <div class="detail-agent-header">
                <span class="detail-agent-name">${MAT.escapeHtml(a.name)}</span>
                ${MAT.statusBadge(a.status)}
                ${a.duration ? `<span class="detail-agent-duration">${MAT.formatDuration(a.duration)}</span>` : ''}
              </div>
              ${a.error ? `
                <div class="detail-agent-error">${MAT.escapeHtml(typeof a.error === 'string' ? a.error : a.error.message || JSON.stringify(a.error))}</div>
              ` : ''}
              ${a.result && a.result.outputs ? `
                <div class="detail-agent-output">
                  <pre>${MAT.escapeHtml(formatOutput(a.result.outputs))}</pre>
                </div>
              ` : ''}
              ${a.result && a.result.usage ? `
                <div class="detail-agent-usage">
                  Tokens: ${a.result.usage.inputTokens || 0} in / ${a.result.usage.outputTokens || 0} out
                  ${a.result.usage.cost ? ` | Cost: $${Number(a.result.usage.cost).toFixed(4)}` : ''}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `}
    `;

    // Bind close button
    document.getElementById('close-detail')?.addEventListener('click', () => {
      selectedStage = null;
      panel.style.display = 'none';
      updateStageCards();
    });
  }

  function formatOutput(outputs) {
    if (typeof outputs === 'string') {
      return outputs.length > 1000 ? outputs.slice(0, 1000) + '\n...(truncated)' : outputs;
    }
    const str = JSON.stringify(outputs, null, 2);
    return str.length > 1000 ? str.slice(0, 1000) + '\n...(truncated)' : str;
  }

  async function loadRuns() {
    try {
      runs = await MAT.fetchJSON('/api/runs');
      renderRunsTable();
      if (runs.length > 0 && !currentRun) {
        selectRun(runs[0].id);
      }
      // Auto-start polling if any run is active
      const hasActive = runs.some(r => r.status === 'running');
      if (hasActive && !pollInterval) startPolling();
    } catch {
      const tbody = document.getElementById('runs-table-body');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">Failed to load runs</td></tr>';
      }
    }
  }

  function renderRunsTable() {
    const tbody = document.getElementById('runs-table-body');
    if (!tbody) return;

    if (!runs || runs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">No runs yet. Click "New Run" to start a pipeline.</td></tr>';
      return;
    }

    tbody.innerHTML = runs.map(run => {
      const selected = currentRun && currentRun.id === run.id ? ' selected' : '';
      return `
        <tr class="expandable${selected}" data-run-id="${MAT.escapeHtml(run.id)}">
          <td><code>${MAT.escapeHtml((run.id || '').slice(0, 8))}</code></td>
          <td>${MAT.formatDate(run.startedAt)}</td>
          <td>${MAT.statusBadge(run.status)}</td>
          <td>${(run.platforms || []).map(p => `<span class="platform-icon">${MAT.escapeHtml(p)}</span>`).join(' ')}</td>
          <td>${MAT.formatCost(run.totalCost)}</td>
          <td>${MAT.formatDuration(run.duration)}</td>
          <td>
            <button class="btn btn-danger btn-xs delete-run-btn" data-id="${MAT.escapeHtml(run.id)}" title="Delete run">x</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function selectRun(runId) {
    try {
      currentRun = await MAT.fetchJSON(`/api/runs/${runId}`);
      updateStageCards();
      renderRunsTable();
      if (selectedStage) renderStageDetail(selectedStage);
    } catch {
      MAT.showToast('Failed to load run details', 'error');
    }
  }

  async function deleteRun(id) {
    try {
      await MAT.fetchJSON(`/api/runs/${id}`, { method: 'DELETE' });
      if (currentRun && currentRun.id === id) {
        currentRun = null;
        STAGES.forEach(s => {
          const el = document.getElementById(`stage-${s.key}`);
          if (el) el.outerHTML = stageCard(s.key, s.name);
        });
      }
      runs = runs.filter(r => r.id !== id);
      renderRunsTable();
      MAT.showToast('Run deleted', 'success');
    } catch {
      MAT.showToast('Failed to delete run', 'error');
    }
  }

  async function clearRuns(status) {
    try {
      const result = await MAT.fetchJSON('/api/runs', { method: 'DELETE', body: { status } });
      MAT.showToast(`Deleted ${result.count} run(s)`, 'success');
      currentRun = null;
      selectedStage = null;
      const panel = document.getElementById('stage-detail-panel');
      if (panel) panel.style.display = 'none';
      STAGES.forEach(s => {
        const el = document.getElementById(`stage-${s.key}`);
        if (el) el.outerHTML = stageCard(s.key, s.name);
      });
      await loadRuns();
    } catch {
      MAT.showToast('Failed to clear runs', 'error');
    }
  }

  let isSubmitting = false;

  async function startRun(formData) {
    // Prevent double-submit
    if (isSubmitting) return;

    const platforms = formData.getAll('platforms');
    const mode = formData.get('mode');
    const dryRun = formData.has('dryRun');
    const posts = parseInt(formData.get('posts') || '1', 10) || 1;

    if (platforms.length === 0) {
      MAT.showToast('Select at least one platform', 'error');
      return;
    }

    const body = { platforms, mode, dryRun, posts };

    // Collect mode-specific fields
    if (mode === 'idea' || mode === 'full') {
      const idea = formData.get('idea');
      if (idea) body.idea = idea;
    }

    if (mode === 'optimize') {
      const topic = formData.get('topic');
      if (!topic) {
        MAT.showToast('Topic is required for ECT workflow', 'error');
        return;
      }
      body.topic = topic;
      const niche = formData.get('niche');
      const audience = formData.get('audience');
      const videoDescription = formData.get('videoDescription');
      const duration = formData.get('duration');
      if (niche) body.niche = niche;
      if (audience) body.audience = audience;
      if (videoDescription) body.videoDescription = videoDescription;
      if (duration) body.duration = duration;
    }

    // Disable submit button and set flag
    isSubmitting = true;
    const submitBtn = document.querySelector('#new-run-form button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Starting...'; }

    try {
      await MAT.fetchJSON('/api/runs', { method: 'POST', body });
      MAT.showToast('Pipeline starting...', 'success');
      closeModal();
      startPolling();
      setTimeout(() => loadRuns(), 2000);
    } catch (err) {
      MAT.showToast('Failed to start: ' + (err.data?.error || err.message), 'error');
    } finally {
      isSubmitting = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Start Run'; }
    }
  }

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(async () => {
      await loadRuns();
      if (currentRun) {
        try {
          const updated = await MAT.fetchJSON(`/api/runs/${currentRun.id}`);
          if (updated && updated.stages) {
            currentRun = updated;
            updateStageCards();
            if (selectedStage) renderStageDetail(selectedStage);
          }
          if (['completed', 'failed', 'cancelled', 'paused'].includes(updated.status)) {
            stopPolling();
          }
        } catch { /* run may have been deleted */ }
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  function openModal() {
    document.getElementById('new-run-modal').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('new-run-modal').style.display = 'none';
  }

  function handleSSE(data) {
    if (currentRun) selectRun(currentRun.id);
    if (data.type === 'run:completed' || data.type === 'run:failed') {
      stopPolling();
      loadRuns();
    }
  }

  function init() {
    loadRuns();

    document.getElementById('new-run-btn')?.addEventListener('click', openModal);
    document.getElementById('cancel-run-btn')?.addEventListener('click', closeModal);
    document.getElementById('refresh-runs-btn')?.addEventListener('click', loadRuns);
    document.getElementById('clear-failed-btn')?.addEventListener('click', () => clearRuns('failed'));
    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
      if (confirm('Delete ALL pipeline runs? This cannot be undone.')) clearRuns('all');
    });

    document.getElementById('new-run-modal')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) closeModal();
    });

    document.getElementById('new-run-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      startRun(new FormData(e.target));
    });

    // Show/hide mode-specific fields when workflow mode changes
    const modeSelect = document.querySelector('#new-run-form select[name="mode"]');
    if (modeSelect) {
      const toggleModeFields = () => {
        const mode = modeSelect.value;
        document.querySelectorAll('.mode-field').forEach(el => { el.style.display = 'none'; });
        document.querySelectorAll(`.mode-${mode}`).forEach(el => { el.style.display = ''; });
        // Also show idea field for "full" mode
        if (mode === 'full') {
          document.querySelectorAll('.mode-idea').forEach(el => { el.style.display = ''; });
        }
      };
      modeSelect.addEventListener('change', toggleModeFields);
      toggleModeFields();
    }

    // Stage card clicks — show detail panel
    document.getElementById('pipeline-stages')?.addEventListener('click', (e) => {
      const card = e.target.closest('.stage-card');
      if (!card) return;
      const key = card.dataset.stage;
      if (selectedStage === key) {
        selectedStage = null;
        document.getElementById('stage-detail-panel').style.display = 'none';
        updateStageCards();
      } else {
        selectedStage = key;
        updateStageCards();
        renderStageDetail(key);
      }
    });

    // Run row clicks
    document.getElementById('runs-table-body')?.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-run-btn');
      if (deleteBtn) { e.stopPropagation(); deleteRun(deleteBtn.dataset.id); return; }
      const row = e.target.closest('tr[data-run-id]');
      if (row) selectRun(row.dataset.runId);
    });

    sseHandler = handleSSE;
    MAT.sse.on('stage:start', sseHandler);
    MAT.sse.on('stage:complete', sseHandler);
    MAT.sse.on('run:completed', sseHandler);
    MAT.sse.on('run:failed', sseHandler);
  }

  function destroy() {
    stopPolling();
    if (sseHandler) {
      MAT.sse.off('stage:start', sseHandler);
      MAT.sse.off('stage:complete', sseHandler);
      MAT.sse.off('run:completed', sseHandler);
      MAT.sse.off('run:failed', sseHandler);
      sseHandler = null;
    }
    currentRun = null;
    selectedStage = null;
  }

  MAT.registerView('pipeline', { render, init, destroy });
})();

/* ============================================
   MAT Dashboard - History View
   ============================================ */

(function () {
  'use strict';

  let campaigns = [];
  let sortColumn = 'startedAt';
  let sortDirection = 'desc';
  let expandedId = null;

  function render() {
    return `
      <div class="section-header">
        <h1 class="section-title">Campaign History</h1>
        <button class="btn" id="refresh-history-btn">Refresh</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th data-col="name">Name</th>
              <th data-col="startedAt" class="sorted-desc">Date</th>
              <th data-col="platforms">Platforms</th>
              <th data-col="status">Status</th>
              <th data-col="contentCount">Content</th>
              <th data-col="totalCost">Cost</th>
            </tr>
          </thead>
          <tbody id="history-table-body">
            <tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function sortCampaigns() {
    const dir = sortDirection === 'asc' ? 1 : -1;
    campaigns.sort((a, b) => {
      let va, vb;
      switch (sortColumn) {
        case 'startedAt':
          va = new Date(a.startedAt || 0).getTime();
          vb = new Date(b.startedAt || 0).getTime();
          break;
        case 'name':
          va = (a.name || '').toLowerCase();
          vb = (b.name || '').toLowerCase();
          break;
        case 'platforms':
          va = (a.platforms || []).join(',');
          vb = (b.platforms || []).join(',');
          break;
        case 'status':
          va = a.status || '';
          vb = b.status || '';
          break;
        case 'contentCount':
          va = a.contentCount || 0;
          vb = b.contentCount || 0;
          break;
        case 'totalCost':
          va = a.totalCost || 0;
          vb = b.totalCost || 0;
          break;
        default:
          va = 0; vb = 0;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function renderTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    document.querySelectorAll('thead th').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.col === sortColumn) {
        th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });

    if (!campaigns || campaigns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No campaigns yet. Run a pipeline to create your first campaign.</td></tr>';
      return;
    }

    sortCampaigns();

    const rows = campaigns.flatMap(c => {
      const mainRow = `
        <tr class="expandable" data-campaign-id="${MAT.escapeHtml(c.id)}">
          <td>${MAT.escapeHtml(c.name || c.id.slice(0, 8))}</td>
          <td>${MAT.formatDate(c.startedAt)}</td>
          <td>${(c.platforms || []).map(p => `<span class="platform-icon">${MAT.escapeHtml(p)}</span>`).join(' ')}</td>
          <td>${MAT.statusBadge(c.status)}</td>
          <td>${c.contentCount ?? 0}</td>
          <td>${MAT.formatCost(c.totalCost)}</td>
        </tr>
      `;

      if (expandedId === c.id && c.contentItems) {
        const expandedRow = `
          <tr class="expanded-row">
            <td colspan="6">
              <div class="grid grid-3">
                ${c.contentItems.map(item => `
                  <div class="card" style="padding: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                      <span class="platform-icon">${MAT.escapeHtml(item.platform)}</span>
                      ${MAT.statusBadge(item.status)}
                    </div>
                    <div class="content-preview" style="max-height: 60px; font-size: 12px;">
                      ${MAT.escapeHtml(item.content || item.title || '-')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </td>
          </tr>
        `;
        return [mainRow, expandedRow];
      }

      return [mainRow];
    });

    tbody.innerHTML = rows.join('');
  }

  async function loadHistory() {
    try {
      campaigns = await MAT.fetchJSON('/api/history');
      renderTable();
    } catch {
      const tbody = document.getElementById('history-table-body');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Failed to load history</td></tr>';
      }
    }
  }

  function init() {
    loadHistory();

    document.querySelector('thead')?.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-col]');
      if (!th) return;
      const col = th.dataset.col;
      if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDirection = 'desc';
      }
      renderTable();
    });

    document.getElementById('history-table-body')?.addEventListener('click', async (e) => {
      const row = e.target.closest('tr.expandable');
      if (!row) return;
      const id = row.dataset.campaignId;
      if (expandedId === id) {
        expandedId = null;
      } else {
        expandedId = id;
        // Load content items for this campaign
        try {
          const content = await MAT.fetchJSON(`/api/history/${id}/content`);
          const campaign = campaigns.find(c => c.id === id);
          if (campaign) campaign.contentItems = content;
        } catch {
          // Ignore - just expand without content
        }
      }
      renderTable();
    });

    document.getElementById('refresh-history-btn')?.addEventListener('click', loadHistory);
  }

  function destroy() {
    expandedId = null;
  }

  MAT.registerView('history', { render, init, destroy });
})();

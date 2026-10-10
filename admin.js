/**
 * Homies Admin Panel: Logic & Interactivity
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Session Authentication ────────────────────────────────
  const authModal = document.getElementById('auth-modal');
  const authPinInput = document.getElementById('auth-pin-input');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authError = document.getElementById('auth-error');
  const lockBtn = document.getElementById('lock-btn');

  const AUTH_KEY = 'homies_admin_auth';

  function checkAuth() {
    if (sessionStorage.getItem(AUTH_KEY) === 'true') {
      authModal.classList.add('hidden');
      initDashboard();
    } else {
      authModal.classList.remove('hidden');
      authPinInput.focus();
    }
  }

  function handleLogin() {
    const pin = authPinInput.value.trim();
    if (HomiesDB.verifyPIN(pin)) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      authModal.classList.add('hidden');
      authError.textContent = '';
      initDashboard();
      showToast('Welcome to Homies Admin HQ!', 'success');
    } else {
      authError.textContent = 'Incorrect PIN. Try default: homies2026';
      authPinInput.focus();
      authPinInput.select();
    }
  }

  authSubmitBtn.addEventListener('click', handleLogin);
  authPinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      sessionStorage.removeItem(AUTH_KEY);
      authPinInput.value = '';
      authModal.classList.remove('hidden');
      showToast('Admin session locked', 'success');
    });
  }

  // ── Toast Notifications ──────────────────────────────────
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icon = type === 'success' 
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>`;
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ── Tab Navigation ────────────────────────────────────────
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // ── Status Toggle (Header & Settings) ────────────────────
  const statusToggle = document.getElementById('header-status-toggle');
  const settingsStatusSwitch = document.getElementById('settings-status-switch');

  function updateStatusDisplay() {
    const settings = HomiesDB.getSettings();
    const isPaused = !!settings.paused;

    if (statusToggle) {
      statusToggle.className = `wl-status-toggle ${isPaused ? 'paused' : 'open'}`;
      statusToggle.querySelector('.status-text').textContent = isPaused ? 'APPLICATIONS PAUSED' : 'APPLICATIONS OPEN';
    }
    if (settingsStatusSwitch) {
      settingsStatusSwitch.checked = !isPaused;
    }
  }

  function toggleStatus() {
    const settings = HomiesDB.getSettings();
    const nextPaused = !settings.paused;
    HomiesDB.updateSettings({ paused: nextPaused });
    updateStatusDisplay();
    showToast(`Whitelist applications are now ${nextPaused ? 'PAUSED' : 'OPEN'}!`, nextPaused ? 'error' : 'success');
  }

  if (statusToggle) statusToggle.addEventListener('click', toggleStatus);
  if (settingsStatusSwitch) settingsStatusSwitch.addEventListener('change', toggleStatus);

  // ── Application Management ───────────────────────────────
  let selectedAppIds = new Set();
  let currentFilter = 'all';
  let searchQuery = '';

  const appsTableBody = document.getElementById('apps-table-body');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const bulkBar = document.getElementById('bulk-bar');
  const selectedCountEl = document.getElementById('selected-count');
  const searchInput = document.getElementById('search-input');
  const filterPills = document.querySelectorAll('.pill-btn');

  // Stats Elements
  const statAll = document.getElementById('stat-all');
  const statPending = document.getElementById('stat-pending');
  const statApproved = document.getElementById('stat-approved');
  const statRejected = document.getElementById('stat-rejected');
  const statTasks = document.getElementById('stat-tasks');
  const tabCountApps = document.getElementById('tab-count-apps');
  const tabCountTasks = document.getElementById('tab-count-tasks');

  function renderStats() {
    const apps = HomiesDB.getApplications();
    const tasks = HomiesDB.getTasks();

    const pending = apps.filter(a => a.status === 'pending').length;
    const approved = apps.filter(a => a.status === 'approved').length;
    const rejected = apps.filter(a => a.status === 'rejected').length;

    if (statAll) statAll.textContent = apps.length;
    if (statPending) statPending.textContent = pending;
    if (statApproved) statApproved.textContent = approved;
    if (statRejected) statRejected.textContent = rejected;
    if (statTasks) statTasks.textContent = tasks.length;

    if (tabCountApps) tabCountApps.textContent = apps.length;
    if (tabCountTasks) tabCountTasks.textContent = tasks.length;
  }

  function renderApplications() {
    renderStats();
    let apps = HomiesDB.getApplications();
    const tasks = HomiesDB.getTasks();

    // Filter by status
    if (currentFilter !== 'all') {
      apps = apps.filter(a => a.status === currentFilter);
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      apps = apps.filter(a => {
        if (a.id.toLowerCase().includes(q)) return true;
        if (a.status.toLowerCase().includes(q)) return true;
        if (a.proofs) {
          for (const key of Object.keys(a.proofs)) {
            if (String(a.proofs[key]).toLowerCase().includes(q)) return true;
          }
        }
        return false;
      });
    }

    // Sort newest first
    apps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (apps.length === 0) {
      appsTableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-state__icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
              </div>
              <div class="empty-state__title">No Applications Found</div>
              <div class="empty-state__desc">${HomiesDB.getApplications().length === 0 ? 'No users have submitted proofs yet. You can seed sample applications to test.' : 'No entries matched your current filter or search.'}</div>
              ${HomiesDB.getApplications().length === 0 ? '<button class="auth-btn" id="seed-btn" style="max-width: 260px; margin: 0 auto;">Generate Sample Applications</button>' : ''}
            </div>
          </td>
        </tr>`;

      const seedBtn = document.getElementById('seed-btn');
      if (seedBtn) {
        seedBtn.addEventListener('click', () => {
          HomiesDB.seedSampleApplications();
          renderApplications();
          showToast('5 sample applications generated!', 'success');
        });
      }
      updateBulkBar();
      return;
    }

    // Find wallet & twitter tasks
    const walletTask = tasks.find(t => t.type === 'wallet');
    const twitterTask = tasks.find(t => t.type === 'twitter_follow' || t.type === 'twitter_engage');

    appsTableBody.innerHTML = apps.map(app => {
      const isChecked = selectedAppIds.has(app.id);
      const dateStr = new Date(app.timestamp).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      // Proof extraction
      let walletVal = '';
      if (walletTask && app.proofs?.[walletTask.id]) {
        walletVal = app.proofs[walletTask.id];
      } else if (app.proofs) {
        for (const k of Object.keys(app.proofs)) {
          if (/^0x[a-fA-F0-9]{40}$/.test(app.proofs[k])) {
            walletVal = app.proofs[k];
            break;
          }
        }
      }

      let twitterVal = '';
      if (twitterTask && app.proofs?.[twitterTask.id]) {
        twitterVal = app.proofs[twitterTask.id];
      }

      const shortWallet = walletVal ? `${walletVal.slice(0, 6)}...${walletVal.slice(-4)}` : '<span style="color: var(--text-muted);">None</span>';
      const shortId = app.id.slice(0, 8);

      return `
        <tr data-app-id="${app.id}">
          <td>
            <input type="checkbox" class="custom-checkbox app-checkbox" data-id="${app.id}" ${isChecked ? 'checked' : ''} />
          </td>
          <td>
            <div class="app-id">
              <span>#${shortId}</span>
              <button class="copy-mini-btn" title="Copy full ID" data-copy="${app.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
          </td>
          <td>
            <span class="status-pill status-pill--${app.status}">${app.status}</span>
          </td>
          <td>
            <div style="font-size: 12px; color: var(--text-secondary);">${dateStr}</div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${walletVal ? `
                <div class="wallet-cell" title="${walletVal}">
                  <span>${shortWallet}</span>
                  <button class="copy-mini-btn" data-copy="${walletVal}" title="Copy Wallet">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </button>
                </div>` : ''}
              ${twitterVal ? `
                <div class="proof-snippet">
                  <span style="color: var(--text-muted); font-size: 11px;">Proof:</span>
                  ${twitterVal.startsWith('http') 
                    ? `<a href="${twitterVal}" target="_blank" rel="noopener">Link</a>` 
                    : `<span>${twitterVal}</span>`}
                </div>` : ''}
            </div>
          </td>
          <td>
            <div class="row-actions">
              <button class="icon-btn icon-btn--check" title="Approve" data-action="approve" data-id="${app.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </button>
              <button class="icon-btn icon-btn--cross" title="Reject" data-action="reject" data-id="${app.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <button class="icon-btn" title="View Full Details" data-action="view" data-id="${app.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="icon-btn icon-btn--trash" title="Delete" data-action="delete" data-id="${app.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    // Attach row events
    attachTableEvents();
    updateBulkBar();
  }

  function attachTableEvents() {
    // Checkboxes
    document.querySelectorAll('.app-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        if (e.target.checked) selectedAppIds.add(id);
        else selectedAppIds.delete(id);
        updateBulkBar();
      });
    });

    // Copy buttons
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.getAttribute('data-copy');
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
      });
    });

    // Row Actions
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');

        if (action === 'approve') {
          HomiesDB.updateApplicationStatus(id, 'approved');
          renderApplications();
          showToast('Application marked as APPROVED', 'success');
        } else if (action === 'reject') {
          HomiesDB.updateApplicationStatus(id, 'rejected');
          renderApplications();
          showToast('Application marked as REJECTED', 'error');
        } else if (action === 'delete') {
          if (confirm('Delete this application permanently?')) {
            HomiesDB.deleteApplication(id);
            selectedAppIds.delete(id);
            renderApplications();
            showToast('Application deleted', 'success');
          }
        } else if (action === 'view') {
          openDetailModal(id);
        }
      });
    });
  }

  function updateBulkBar() {
    const totalVisible = document.querySelectorAll('.app-checkbox').length;
    const checkedCount = selectedAppIds.size;

    if (checkedCount > 0) {
      bulkBar.classList.add('show');
      selectedCountEl.textContent = checkedCount;
    } else {
      bulkBar.classList.remove('show');
    }

    if (selectAllCheckbox) {
      selectAllCheckbox.checked = totalVisible > 0 && checkedCount === totalVisible;
    }
  }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.app-checkbox').forEach(cb => {
        const id = cb.getAttribute('data-id');
        cb.checked = isChecked;
        if (isChecked) selectedAppIds.add(id);
        else selectedAppIds.delete(id);
      });
      updateBulkBar();
    });
  }

  // Bulk Actions
  document.getElementById('bulk-approve-btn')?.addEventListener('click', () => {
    HomiesDB.bulkUpdateStatus(Array.from(selectedAppIds), 'approved');
    selectedAppIds.clear();
    renderApplications();
    showToast('Selected applications APPROVED', 'success');
  });

  document.getElementById('bulk-reject-btn')?.addEventListener('click', () => {
    HomiesDB.bulkUpdateStatus(Array.from(selectedAppIds), 'rejected');
    selectedAppIds.clear();
    renderApplications();
    showToast('Selected applications REJECTED', 'error');
  });

  document.getElementById('bulk-delete-btn')?.addEventListener('click', () => {
    if (confirm(`Permanently delete ${selectedAppIds.size} applications?`)) {
      HomiesDB.bulkDeleteApplications(Array.from(selectedAppIds));
      selectedAppIds.clear();
      renderApplications();
      showToast('Selected applications deleted', 'success');
    }
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderApplications();
    });
  }

  // Filter pills
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-filter');
      renderApplications();
    });
  });

  // ── Application Detail Modal ──────────────────────────────
  const detailModal = document.getElementById('detail-modal');
  const detailContent = document.getElementById('detail-content');
  const detailClose = document.getElementById('detail-close');

  function openDetailModal(id) {
    const apps = HomiesDB.getApplications();
    const app = apps.find(a => a.id === id);
    if (!app) return;

    const tasks = HomiesDB.getTasks();

    let proofsHTML = '';
    tasks.forEach(task => {
      const proofVal = app.proofs?.[task.id] || '<span style="color: var(--text-muted);">Not provided</span>';
      const isUrl = String(proofVal).startsWith('http');
      proofsHTML += `
        <div class="detail-row">
          <div class="detail-row__label">${task.title} (${task.type})</div>
          <div class="detail-row__val">
            ${isUrl ? `<a href="${proofVal}" target="_blank" rel="noopener">${proofVal}</a>` : proofVal}
          </div>
        </div>`;
    });

    detailContent.innerHTML = `
      <div class="detail-row" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="detail-row__label">Application ID</div>
          <div class="detail-row__val" style="font-family: monospace;">${app.id}</div>
        </div>
        <span class="status-pill status-pill--${app.status}">${app.status}</span>
      </div>
      <div class="detail-row">
        <div class="detail-row__label">Submitted Timestamp</div>
        <div class="detail-row__val">${new Date(app.timestamp).toLocaleString()}</div>
      </div>
      ${app.reviewedAt ? `
      <div class="detail-row">
        <div class="detail-row__label">Last Reviewed At</div>
        <div class="detail-row__val">${new Date(app.reviewedAt).toLocaleString()}</div>
      </div>` : ''}
      <div style="font-family: var(--font-pixel); font-size: 10px; color: var(--neon-cyan); margin: 16px 0 8px;">SUBMITTED PROOFS</div>
      ${proofsHTML}
    `;

    detailModal.classList.add('open');
  }

  if (detailClose) {
    detailClose.addEventListener('click', () => detailModal.classList.remove('open'));
  }
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) detailModal.classList.remove('open');
    });
  }

  // ── Quests & Tasks Manager ────────────────────────────────
  const taskListContainer = document.getElementById('task-list-container');
  const addTaskBtn = document.getElementById('add-task-btn');
  const taskModal = document.getElementById('task-modal');
  const taskModalClose = document.getElementById('task-modal-close');
  const taskModalSave = document.getElementById('task-modal-save');
  const resetTasksBtn = document.getElementById('reset-tasks-btn');

  // Task form fields
  const taskIdInput = document.getElementById('task-id-input');
  const taskTypeInput = document.getElementById('task-type-input');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskAccountsInput = document.getElementById('task-accounts-input');
  const taskLinksInput = document.getElementById('task-links-input');
  const taskPlaceholderInput = document.getElementById('task-placeholder-input');
  const taskRequiredSwitch = document.getElementById('task-required-switch');

  const TASK_ICONS = {
    twitter_follow: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    twitter_engage: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    wallet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>`,
    discord: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
    default: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  };

  function renderTasks() {
    renderStats();
    const tasks = HomiesDB.getTasks();

    if (tasks.length === 0) {
      taskListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">No Quests Configured</div>
          <div class="empty-state__desc">Add your first quest to collect proofs from applicants.</div>
        </div>`;
      return;
    }

    taskListContainer.innerHTML = tasks.map((task, index) => {
      const icon = TASK_ICONS[task.type] || TASK_ICONS.default;
      const reqBadge = task.required
        ? `<span class="task-badge-req task-badge-req--yes">Required</span>`
        : `<span class="task-badge-req task-badge-req--no">Optional</span>`;

      return `
        <div class="task-item" data-task-id="${task.id}">
          <div class="task-item__left">
            <div class="task-order-badge">#${index + 1}</div>
            <div class="task-item__icon">${icon}</div>
            <div class="task-item__info">
              <div class="task-item__title">
                <span>${task.title}</span>
                ${reqBadge}
              </div>
              <div class="task-item__meta">
                <span>Type: <strong>${task.type}</strong></span>
                ${task.placeholder ? `<span>Placeholder: <code>${task.placeholder}</code></span>` : ''}
                ${task.accounts?.length ? `<span>Target: <code>${task.accounts.join(', ')}</code></span>` : ''}
              </div>
            </div>
          </div>
          <div class="task-item__actions">
            <button class="icon-btn" title="Move Up" data-task-action="up" data-id="${task.id}" ${index === 0 ? 'disabled style="opacity: 0.3;"' : ''}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            </button>
            <button class="icon-btn" title="Move Down" data-task-action="down" data-id="${task.id}" ${index === tasks.length - 1 ? 'disabled style="opacity: 0.3;"' : ''}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <button class="icon-btn" title="Edit Quest" data-task-action="edit" data-id="${task.id}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
            <button class="icon-btn icon-btn--trash" title="Delete Quest" data-task-action="delete" data-id="${task.id}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    attachTaskEvents();
  }

  function attachTaskEvents() {
    document.querySelectorAll('[data-task-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-task-action');
        const id = btn.getAttribute('data-id');

        if (action === 'up') {
          HomiesDB.moveTask(id, 'up');
          renderTasks();
        } else if (action === 'down') {
          HomiesDB.moveTask(id, 'down');
          renderTasks();
        } else if (action === 'edit') {
          openTaskModal(id);
        } else if (action === 'delete') {
          if (confirm('Delete this quest? Applicant proofs for this quest will still remain in backup records.')) {
            HomiesDB.deleteTask(id);
            renderTasks();
            showToast('Quest deleted', 'success');
          }
        }
      });
    });
  }

  function openTaskModal(id = null) {
    if (id) {
      const task = HomiesDB.getTasks().find(t => t.id === id);
      if (!task) return;
      document.getElementById('task-modal-title').textContent = 'Edit Quest';
      taskIdInput.value = task.id;
      taskTypeInput.value = task.type;
      taskTitleInput.value = task.title;
      taskAccountsInput.value = task.accounts ? task.accounts.join(', ') : '';
      taskLinksInput.value = task.links ? task.links.join(', ') : '';
      taskPlaceholderInput.value = task.placeholder || '';
      taskRequiredSwitch.checked = !!task.required;
    } else {
      document.getElementById('task-modal-title').textContent = 'Add New Quest';
      taskIdInput.value = '';
      taskTypeInput.value = 'twitter_follow';
      taskTitleInput.value = '';
      taskAccountsInput.value = '';
      taskLinksInput.value = '';
      taskPlaceholderInput.value = '';
      taskRequiredSwitch.checked = true;
    }
    taskModal.classList.add('open');
  }

  if (addTaskBtn) addTaskBtn.addEventListener('click', () => openTaskModal(null));
  if (taskModalClose) taskModalClose.addEventListener('click', () => taskModal.classList.remove('open'));
  if (taskModal) {
    taskModal.addEventListener('click', (e) => {
      if (e.target === taskModal) taskModal.classList.remove('open');
    });
  }

  if (taskModalSave) {
    taskModalSave.addEventListener('click', () => {
      const title = taskTitleInput.value.trim();
      if (!title) {
        showToast('Please enter a quest title', 'error');
        taskTitleInput.focus();
        return;
      }

      const id = taskIdInput.value;
      const type = taskTypeInput.value;
      const accounts = taskAccountsInput.value.split(',').map(s => s.trim()).filter(Boolean);
      const links = taskLinksInput.value.split(',').map(s => s.trim()).filter(Boolean);
      const placeholder = taskPlaceholderInput.value.trim();
      const required = taskRequiredSwitch.checked;

      const taskData = {
        type,
        title,
        accounts: accounts.length ? accounts : undefined,
        links: links.length ? links : undefined,
        placeholder: placeholder || undefined,
        required,
      };

      if (id) {
        HomiesDB.updateTask(id, taskData);
        showToast('Quest updated!', 'success');
      } else {
        HomiesDB.addTask(taskData);
        showToast('New quest added!', 'success');
      }

      taskModal.classList.remove('open');
      renderTasks();
    });
  }

  if (resetTasksBtn) {
    resetTasksBtn.addEventListener('click', () => {
      if (confirm('Reset quests back to original Homies defaults?')) {
        HomiesDB.resetToDefaults();
        renderTasks();
        showToast('Quests reset to defaults', 'success');
      }
    });
  }

  // ── Settings ──────────────────────────────────────────────
  const settingsTitleInput = document.getElementById('settings-title-input');
  const settingsSubtitleInput = document.getElementById('settings-subtitle-input');
  const settingsSaveBtn = document.getElementById('settings-save-btn');
  const settingsNewPinInput = document.getElementById('settings-new-pin');
  const settingsPinBtn = document.getElementById('settings-pin-btn');

  function loadSettings() {
    const settings = HomiesDB.getSettings();
    if (settingsTitleInput) settingsTitleInput.value = settings.whitelistTitle || 'Homies Whitelist Quests';
    if (settingsSubtitleInput) settingsSubtitleInput.value = settings.whitelistSubtitle || '';
    updateStatusDisplay();
  }

  if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', () => {
      HomiesDB.updateSettings({
        whitelistTitle: settingsTitleInput.value.trim(),
        whitelistSubtitle: settingsSubtitleInput.value.trim(),
      });
      showToast('Settings saved successfully!', 'success');
    });
  }

  if (settingsPinBtn) {
    settingsPinBtn.addEventListener('click', () => {
      const newPin = settingsNewPinInput.value.trim();
      if (!newPin || newPin.length < 4) {
        showToast('PIN must be at least 4 characters', 'error');
        return;
      }
      HomiesDB.setPIN(newPin);
      settingsNewPinInput.value = '';
      showToast('Admin PIN updated!', 'success');
    });
  }

  // ── Export / Import Hub ───────────────────────────────────
  // Export CSV
  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    const csv = HomiesDB.exportCSV();
    if (!csv) {
      showToast('No applications to export yet', 'error');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homies-whitelist-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV Export downloaded!', 'success');
  });

  // Export JSON
  document.getElementById('export-json-btn')?.addEventListener('click', () => {
    const data = HomiesDB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homies-whitelist-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON Backup downloaded!', 'success');
  });

  // Copy Approved Wallets
  document.getElementById('copy-wallets-btn')?.addEventListener('click', () => {
    const formatSelect = document.getElementById('wallet-format-select');
    const format = formatSelect ? formatSelect.value : 'newline';
    const walletsStr = HomiesDB.getApprovedWallets(format);

    if (!walletsStr) {
      showToast('No approved wallets found. Approve applications first!', 'error');
      return;
    }

    navigator.clipboard.writeText(walletsStr);
    const count = walletsStr.split(format === 'comma' ? ',' : '\n').length;
    showToast(`Copied ${count} approved wallet(s) to clipboard!`, 'success');
  });

  // Import CSV Modal & File Upload
  const importCsvModal = document.getElementById('import-csv-modal');
  const importCsvBtn = document.getElementById('open-import-csv-btn');
  const importCsvClose = document.getElementById('import-csv-close');
  const importCsvSubmit = document.getElementById('import-csv-submit');
  const importCsvTextarea = document.getElementById('import-csv-textarea');
  const csvFileInput = document.getElementById('csv-file-input');
  const csvDropzone = document.getElementById('csv-dropzone');

  if (importCsvBtn) importCsvBtn.addEventListener('click', () => importCsvModal.classList.add('open'));
  if (importCsvClose) importCsvClose.addEventListener('click', () => importCsvModal.classList.remove('open'));
  if (importCsvModal) {
    importCsvModal.addEventListener('click', (e) => {
      if (e.target === importCsvModal) importCsvModal.classList.remove('open');
    });
  }

  if (csvDropzone && csvFileInput) {
    csvDropzone.addEventListener('click', () => csvFileInput.click());
    csvDropzone.addEventListener('dragover', (e) => { e.preventDefault(); csvDropzone.classList.add('dragover'); });
    csvDropzone.addEventListener('dragleave', () => csvDropzone.classList.remove('dragover'));
    csvDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      csvDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        const file = e.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => { importCsvTextarea.value = evt.target.result; };
        reader.readAsText(file);
      }
    });
    csvFileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => { importCsvTextarea.value = evt.target.result; };
        reader.readAsText(file);
      }
    });
  }

  if (importCsvSubmit) {
    importCsvSubmit.addEventListener('click', () => {
      const text = importCsvTextarea.value.trim();
      const res = HomiesDB.importCSV(text);
      if (res.success) {
        showToast(`Successfully imported ${res.count} applications!`, 'success');
        importCsvModal.classList.remove('open');
        importCsvTextarea.value = '';
        renderApplications();
      } else {
        showToast(res.message || 'Failed to import CSV', 'error');
      }
    });
  }

  // Import JSON Modal
  const importJsonModal = document.getElementById('import-json-modal');
  const importJsonBtn = document.getElementById('open-import-json-btn');
  const importJsonClose = document.getElementById('import-json-close');
  const importJsonSubmit = document.getElementById('import-json-submit');
  const importJsonTextarea = document.getElementById('import-json-textarea');
  const jsonFileInput = document.getElementById('json-file-input');
  const jsonDropzone = document.getElementById('json-dropzone');

  if (importJsonBtn) importJsonBtn.addEventListener('click', () => importJsonModal.classList.add('open'));
  if (importJsonClose) importJsonClose.addEventListener('click', () => importJsonModal.classList.remove('open'));
  if (importJsonModal) {
    importJsonModal.addEventListener('click', (e) => {
      if (e.target === importJsonModal) importJsonModal.classList.remove('open');
    });
  }

  if (jsonDropzone && jsonFileInput) {
    jsonDropzone.addEventListener('click', () => jsonFileInput.click());
    jsonDropzone.addEventListener('dragover', (e) => { e.preventDefault(); jsonDropzone.classList.add('dragover'); });
    jsonDropzone.addEventListener('dragleave', () => jsonDropzone.classList.remove('dragover'));
    jsonDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      jsonDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        const file = e.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => { importJsonTextarea.value = evt.target.result; };
        reader.readAsText(file);
      }
    });
    jsonFileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => { importJsonTextarea.value = evt.target.result; };
        reader.readAsText(file);
      }
    });
  }

  if (importJsonSubmit) {
    importJsonSubmit.addEventListener('click', () => {
      try {
        const data = JSON.parse(importJsonTextarea.value.trim());
        HomiesDB.importAll(data);
        showToast('JSON backup restored successfully!', 'success');
        importJsonModal.classList.remove('open');
        importJsonTextarea.value = '';
        renderApplications();
        renderTasks();
        loadSettings();
      } catch (err) {
        showToast('Invalid JSON file format', 'error');
      }
    });
  }

  // Clear All
  document.getElementById('clear-all-btn')?.addEventListener('click', () => {
    if (confirm('DANGER: This will delete ALL applications and proofs. Make sure you exported a backup first! Proceed?')) {
      HomiesDB.clearApplications();
      selectedAppIds.clear();
      renderApplications();
      showToast('All applications have been cleared', 'error');
    }
  });

  // ── Init ──────────────────────────────────────────────────
  function initDashboard() {
    renderApplications();
    renderTasks();
    loadSettings();
    updateStatusDisplay();
  }

  // ── Real-Time DB Update Listener ──────────────────────────
  window.addEventListener('homies-db-updated', () => {
    if (sessionStorage.getItem(AUTH_KEY) === 'true') {
      renderStats();
      updateStatusDisplay();
      renderApplications();
      // Only re-render tasks if modal is not open
      const taskModal = document.getElementById('task-modal');
      if (!taskModal || !taskModal.classList.contains('open')) {
        renderTasks();
      }
    }
  });

  // Start check
  checkAuth();
});

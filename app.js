/**
 * Homies — Shared Data Layer with MongoDB Cloud Persistence
 * Manages tasks, applications, and settings for whitelist system with
 * real-time server synchronisation, multi-tab BroadcastChannel, and
 * instant local-first fallback.
 */

const HomiesDB = (() => {
  const KEYS = {
    tasks: 'homies_tasks',
    applications: 'homies_apps',
    settings: 'homies_settings',
  };

  // ── Default Seed Data ─────────────────────────────────────
  const DEFAULT_TASKS = [
    {
      id: 't1',
      type: 'twitter_follow',
      title: 'Follow @HomiesART on X',
      accounts: ['@HomiesART'],
      links: ['https://x.com/HomiesART'],
      required: true,
      placeholder: '@yourusername (or profile link)',
      order: 1,
    },
    {
      id: 't2',
      type: 'twitter_engage',
      title: 'Like, Repost & Comment on Pinned Post',
      links: ['https://x.com/HomiesART'],
      required: true,
      placeholder: 'https://x.com/.../status/... (comment link)',
      order: 2,
    },
    {
      id: 't3',
      type: 'wallet',
      title: 'Submit EVM Wallet Address',
      required: true,
      placeholder: '0x1234567890abcdef1234567890abcdef12345678',
      order: 3,
    },
  ];

  const DEFAULT_SETTINGS = {
    paused: false,
    whitelistTitle: 'Homies Whitelist Quests',
    whitelistSubtitle: 'Complete the quests and enter proof details to reserve your spot in the crew.',
    adminPIN: 'homies2026',
  };

  // ── Helpers ──────────────────────────────────────────────
  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[HomiesDB LocalStorage Write Error]', e);
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ── Multi-Tab Real-Time Broadcast ─────────────────────────
  const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('homies_db_channel')
    : null;

  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'db_update') {
        if (event.data.tasks) set(KEYS.tasks, event.data.tasks);
        if (event.data.settings) set(KEYS.settings, event.data.settings);
        if (event.data.applications) set(KEYS.applications, event.data.applications);
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('homies-db-updated', { detail: event.data }));
        }
      }
    };
  }

  // Cross-tab storage fallback
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('homies_')) {
        window.dispatchEvent(new CustomEvent('homies-db-updated', { detail: { origin: 'storage_event' } }));
      }
    });
  }

  function notifyUpdated(meta = {}) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('homies-db-updated', { detail: meta }));
    }
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'db_update',
          tasks: getTasks(),
          settings: getSettings(),
          applications: getApplications(),
          timestamp: Date.now(),
          ...meta,
        });
      } catch (err) {
        console.warn('[HomiesDB Broadcast Error]', err);
      }
    }
  }

  function onUpdate(callback) {
    if (typeof window !== 'undefined' && typeof callback === 'function') {
      window.addEventListener('homies-db-updated', callback);
    }
  }

  // ── Tasks ────────────────────────────────────────────────
  function getTasks() {
    const tasks = get(KEYS.tasks, null);
    if (!tasks) {
      set(KEYS.tasks, DEFAULT_TASKS);
      return [...DEFAULT_TASKS];
    }
    return tasks.sort((a, b) => a.order - b.order);
  }

  function setTasks(tasks) {
    set(KEYS.tasks, tasks);
    notifyUpdated({ source: 'setTasks' });
  }

  function addTask(task) {
    const tasks = getTasks();
    task.id = task.id || uid();
    task.order = tasks.length + 1;
    tasks.push(task);
    setTasks(tasks);

    // Persist to MongoDB backend
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    }).catch(err => console.warn('[MongoDB Task Create]', err));

    return task;
  }

  function updateTask(id, updates) {
    const tasks = getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...updates };
    setTasks(tasks);

    // Persist to MongoDB backend
    fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[MongoDB Task Update]', err));

    return tasks[idx];
  }

  function deleteTask(id) {
    let tasks = getTasks().filter(t => t.id !== id);
    tasks.forEach((t, i) => t.order = i + 1);
    setTasks(tasks);

    // Persist to MongoDB backend
    fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(err => console.warn('[MongoDB Task Delete]', err));
  }

  function moveTask(id, direction) {
    const tasks = getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return tasks;
    if (direction === 'up' && idx > 0) {
      const temp = tasks[idx];
      tasks[idx] = tasks[idx - 1];
      tasks[idx - 1] = temp;
    } else if (direction === 'down' && idx < tasks.length - 1) {
      const temp = tasks[idx];
      tasks[idx] = tasks[idx + 1];
      tasks[idx + 1] = temp;
    }
    tasks.forEach((t, i) => t.order = i + 1);
    setTasks(tasks);

    // Persist reorder to MongoDB backend
    fetch('/api/tasks-reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks }),
    }).catch(err => console.warn('[MongoDB Tasks Reorder]', err));

    return tasks;
  }

  // ── Applications ─────────────────────────────────────────
  function getApplications() {
    return get(KEYS.applications, []);
  }

  function addApplication(app) {
    const apps = getApplications();
    app.id = app.id || uid();
    app.timestamp = app.timestamp || new Date().toISOString();
    app.status = app.status || 'pending';
    app.proofs = app.proofs || {};
    apps.unshift(app);
    set(KEYS.applications, apps);
    notifyUpdated({ source: 'addApplication', appId: app.id });

    // Persist to MongoDB backend
    fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app),
    }).catch(err => console.warn('[MongoDB Application Create]', err));

    return app;
  }

  function updateApplicationStatus(id, status) {
    const apps = getApplications();
    const idx = apps.findIndex(a => a.id === id);
    if (idx === -1) return null;
    apps[idx].status = status;
    apps[idx].reviewedAt = new Date().toISOString();
    set(KEYS.applications, apps);
    notifyUpdated({ source: 'updateApplicationStatus', appId: id, status });

    // Persist to MongoDB backend
    fetch(`/api/applications/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(err => console.warn('[MongoDB Application Status]', err));

    return apps[idx];
  }

  function deleteApplication(id) {
    const apps = getApplications().filter(a => a.id !== id);
    set(KEYS.applications, apps);
    notifyUpdated({ source: 'deleteApplication', appId: id });

    // Persist to MongoDB backend
    fetch(`/api/applications/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(err => console.warn('[MongoDB Application Delete]', err));
  }

  function clearApplications() {
    const apps = getApplications();
    const ids = apps.map(a => a.id);
    set(KEYS.applications, []);
    notifyUpdated({ source: 'clearApplications' });

    if (ids.length > 0) {
      fetch('/api/applications/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).catch(err => console.warn('[MongoDB Clear Applications]', err));
    }
  }

  function bulkUpdateStatus(ids, status) {
    const apps = getApplications();
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    apps.forEach(a => {
      if (idSet.has(a.id)) {
        a.status = status;
        a.reviewedAt = now;
      }
    });
    set(KEYS.applications, apps);
    notifyUpdated({ source: 'bulkUpdateStatus', ids, status });

    // Persist to MongoDB backend
    fetch('/api/applications/bulk-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status }),
    }).catch(err => console.warn('[MongoDB Bulk Status]', err));

    return apps;
  }

  function bulkDeleteApplications(ids) {
    const idSet = new Set(ids);
    const apps = getApplications().filter(a => !idSet.has(a.id));
    set(KEYS.applications, apps);
    notifyUpdated({ source: 'bulkDeleteApplications', ids });

    // Persist to MongoDB backend
    fetch('/api/applications/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(err => console.warn('[MongoDB Bulk Delete]', err));

    return apps;
  }

  // ── Settings ─────────────────────────────────────────────
  function getSettings() {
    return get(KEYS.settings, { ...DEFAULT_SETTINGS });
  }

  function updateSettings(updates) {
    const settings = getSettings();
    Object.assign(settings, updates);
    set(KEYS.settings, settings);
    notifyUpdated({ source: 'updateSettings', updates });

    // Persist to MongoDB backend
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(err => console.warn('[MongoDB Settings Update]', err));

    return settings;
  }

  // ── Server Sync with MongoDB ──────────────────────────────
  let isSyncing = false;
  async function syncWithServer(callback) {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const [tasksRes, settingsRes, appsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/settings'),
        fetch('/api/applications'),
      ]);

      let hasChanges = false;

      if (tasksRes.ok) {
        const tasks = await tasksRes.json();
        if (Array.isArray(tasks) && tasks.length > 0) {
          const currentStr = JSON.stringify(get(KEYS.tasks, []));
          const newStr = JSON.stringify(tasks);
          if (currentStr !== newStr) {
            set(KEYS.tasks, tasks);
            hasChanges = true;
          }
        }
      }

      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings && typeof settings === 'object') {
          const currentStr = JSON.stringify(get(KEYS.settings, {}));
          const newStr = JSON.stringify(settings);
          if (currentStr !== newStr) {
            set(KEYS.settings, settings);
            hasChanges = true;
          }
        }
      }

      if (appsRes.ok) {
        const apps = await appsRes.json();
        if (Array.isArray(apps)) {
          const currentStr = JSON.stringify(get(KEYS.applications, []));
          const newStr = JSON.stringify(apps);
          if (currentStr !== newStr) {
            set(KEYS.applications, apps);
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        notifyUpdated({ source: 'serverSync' });
      }

      if (typeof callback === 'function') callback();
    } catch (err) {
      console.debug('[HomiesDB] Server sync deferred:', err.message);
    } finally {
      isSyncing = false;
    }
  }

  // ── Export / Import ──────────────────────────────────────
  function exportAll() {
    return {
      tasks: getTasks(),
      applications: getApplications(),
      settings: getSettings(),
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
    };
  }

  function importAll(data) {
    if (!data || typeof data !== 'object') return false;
    if (Array.isArray(data.tasks)) {
      set(KEYS.tasks, data.tasks);
      fetch('/api/tasks-reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: data.tasks }),
      }).catch(() => {});
    }
    if (Array.isArray(data.applications)) {
      set(KEYS.applications, data.applications);
    }
    if (data.settings && typeof data.settings === 'object') {
      set(KEYS.settings, data.settings);
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.settings),
      }).catch(() => {});
    }
    notifyUpdated({ source: 'importAll' });
    return true;
  }

  function exportCSV() {
    const apps = getApplications();
    const tasks = getTasks();
    const headers = ['ID', 'Status', 'Submitted At', 'Reviewed At', ...tasks.map(t => t.title)];

    const rows = apps.map(app => {
      const row = [app.id, app.status, app.timestamp, app.reviewedAt || ''];
      tasks.forEach(t => {
        row.push(app.proofs?.[t.id] || '');
      });
      return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    return [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
  }

  // ── Approved Wallets Extractor ───────────────────────────
  function getApprovedWallets(format = 'newline') {
    const apps = getApplications().filter(a => a.status === 'approved');
    const tasks = getTasks();
    const walletTask = tasks.find(t => t.type === 'wallet');
    const walletTaskId = walletTask ? walletTask.id : null;

    const wallets = [];
    apps.forEach(a => {
      let w = '';
      if (walletTaskId && a.proofs?.[walletTaskId]) {
        w = a.proofs[walletTaskId].trim();
      } else if (a.proofs) {
        for (const key of Object.keys(a.proofs)) {
          const val = String(a.proofs[key]).trim();
          if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
            w = val;
            break;
          }
        }
      }
      if (w && !wallets.includes(w)) {
        wallets.push(w);
      }
    });

    if (format === 'comma') return wallets.join(', ');
    if (format === 'json') return JSON.stringify(wallets, null, 2);
    return wallets.join('\n');
  }

  // ── CSV Import ───────────────────────────────────────────
  function importCSV(csvText) {
    if (!csvText || !csvText.trim()) return { success: false, message: 'Empty CSV file' };
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return { success: false, message: 'CSV has no data rows' };

    function parseCSVLine(line) {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    }

    const headers = parseCSVLine(lines[0]);
    const tasks = getTasks();
    const apps = getApplications();
    let importedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseCSVLine(line);
      const app = {
        id: values[0] && values[0].length > 3 ? values[0] : uid(),
        status: ['pending', 'approved', 'rejected'].includes(values[1]?.toLowerCase()) ? values[1].toLowerCase() : 'pending',
        timestamp: values[2] || new Date().toISOString(),
        reviewedAt: values[3] || null,
        proofs: {},
      };

      for (let h = 4; h < headers.length; h++) {
        const headerName = headers[h];
        const val = values[h] || '';
        const matchedTask = tasks.find(t => t.title.toLowerCase() === headerName.toLowerCase());
        if (matchedTask) {
          app.proofs[matchedTask.id] = val;
        } else if (tasks[h - 4]) {
          app.proofs[tasks[h - 4].id] = val;
        }
      }

      const existingIdx = apps.findIndex(a => a.id === app.id);
      if (existingIdx >= 0) {
        apps[existingIdx] = app;
      } else {
        apps.push(app);
      }
      importedCount++;

      // Post to backend
      fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(app),
      }).catch(() => {});
    }

    set(KEYS.applications, apps);
    notifyUpdated({ source: 'importCSV' });
    return { success: true, count: importedCount };
  }

  // ── Seed Sample Applications ─────────────────────────────
  function seedSampleApplications() {
    const tasks = getTasks();
    const t1 = tasks.find(t => t.type === 'twitter_follow')?.id || 't1';
    const t2 = tasks.find(t => t.type === 'twitter_engage')?.id || 't2';
    const t3 = tasks.find(t => t.type === 'wallet')?.id || 't3';

    const samples = [
      {
        id: uid(),
        status: 'approved',
        timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
        reviewedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
        proofs: {
          [t1]: '@cryptosatoshi_og',
          [t2]: 'https://x.com/cryptosatoshi_og/status/178920192837192',
          [t3]: '0x71C845e27Ec29a32066E0495C5c2B2FBE47A46c1',
        },
      },
      {
        id: uid(),
        status: 'pending',
        timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
        reviewedAt: null,
        proofs: {
          [t1]: '@pixel_homie99',
          [t2]: 'https://x.com/pixel_homie99/status/178948291048201',
          [t3]: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
        },
      },
      {
        id: uid(),
        status: 'pending',
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
        reviewedAt: null,
        proofs: {
          [t1]: '@degen_collector',
          [t2]: 'https://x.com/degen_collector/status/178950182740192',
          [t3]: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        },
      },
    ];

    samples.forEach(s => addApplication(s));
    return samples;
  }

  // ── PIN Authentication ───────────────────────────────────
  const DEFAULT_PIN = 'homies2026';
  function verifyPIN(pin) {
    const settings = getSettings();
    const correctPIN = settings.adminPIN || DEFAULT_PIN;
    return String(pin).trim() === correctPIN;
  }

  function setPIN(newPIN) {
    if (!newPIN || String(newPIN).trim().length < 4) return false;
    updateSettings({ adminPIN: String(newPIN).trim() });
    return true;
  }

  // ── Reset Defaults ───────────────────────────────────────
  function resetToDefaults() {
    set(KEYS.tasks, DEFAULT_TASKS);
    set(KEYS.settings, DEFAULT_SETTINGS);
    notifyUpdated({ source: 'resetToDefaults' });

    fetch('/api/reset-defaults', { method: 'POST' }).catch(() => {});
    return { tasks: DEFAULT_TASKS, settings: DEFAULT_SETTINGS };
  }

  // ── Math CAPTCHA ─────────────────────────────────────────
  function generateCaptcha() {
    const ops = [
      { sym: '+', fn: (a, b) => a + b },
      { sym: '×', fn: (a, b) => a * b },
      { sym: '-', fn: (a, b) => a - b },
    ];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const a = Math.floor(Math.random() * 12) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    return { question: `${a} ${op.sym} ${b} = ?`, answer: op.fn(a, b) };
  }

  // ── Real-Time Auto Sync Setup ─────────────────────────────
  if (typeof window !== 'undefined') {
    // Initial sync immediately
    syncWithServer();
    
    // Background polling every 4 seconds to catch updates from other devices/admins
    setInterval(() => {
      syncWithServer();
    }, 4000);
  }

  return {
    getTasks, setTasks, addTask, updateTask, deleteTask, moveTask,
    getApplications, addApplication, updateApplicationStatus, deleteApplication, clearApplications,
    bulkUpdateStatus, bulkDeleteApplications,
    getSettings, updateSettings,
    exportAll, importAll, exportCSV, importCSV, getApprovedWallets,
    seedSampleApplications,
    verifyPIN, setPIN, resetToDefaults,
    generateCaptcha,
    syncWithServer,
    onUpdate,
    notifyUpdated,
  };
})();

// Universal export
if (typeof window !== 'undefined') window.HomiesDB = HomiesDB;
if (typeof global !== 'undefined') global.HomiesDB = HomiesDB;
if (typeof module !== 'undefined' && module.exports) module.exports = HomiesDB;

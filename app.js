/**
 * Homies — Shared Data Layer (localStorage-based)
 * Manages tasks, applications, and settings for whitelist system.
 */

const HomiesDB = (() => {
  const KEYS = {
    tasks: 'homies_tasks',
    applications: 'homies_apps',
    settings: 'homies_settings',
  };

  // ── Default Data ─────────────────────────────────────────
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
  };

  // ── Helpers ──────────────────────────────────────────────
  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ── Tasks ────────────────────────────────────────────────
  function getTasks() {
    const tasks = get(KEYS.tasks, null);
    if (!tasks) { set(KEYS.tasks, DEFAULT_TASKS); return [...DEFAULT_TASKS]; }
    return tasks.sort((a, b) => a.order - b.order);
  }

  function setTasks(tasks) { set(KEYS.tasks, tasks); }

  function addTask(task) {
    const tasks = getTasks();
    task.id = uid();
    task.order = tasks.length + 1;
    tasks.push(task);
    setTasks(tasks);
    return task;
  }

  function updateTask(id, updates) {
    const tasks = getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...updates };
    setTasks(tasks);
    return tasks[idx];
  }

  function deleteTask(id) {
    let tasks = getTasks().filter(t => t.id !== id);
    tasks.forEach((t, i) => t.order = i + 1);
    setTasks(tasks);
  }

  // ── Applications ─────────────────────────────────────────
  function getApplications() {
    return get(KEYS.applications, []);
  }

  function addApplication(app) {
    const apps = getApplications();
    app.id = uid();
    app.timestamp = new Date().toISOString();
    app.status = 'pending';
    apps.push(app);
    set(KEYS.applications, apps);
    return app;
  }

  function updateApplicationStatus(id, status) {
    const apps = getApplications();
    const idx = apps.findIndex(a => a.id === id);
    if (idx === -1) return null;
    apps[idx].status = status;
    apps[idx].reviewedAt = new Date().toISOString();
    set(KEYS.applications, apps);
    return apps[idx];
  }

  function deleteApplication(id) {
    const apps = getApplications().filter(a => a.id !== id);
    set(KEYS.applications, apps);
  }

  function clearApplications() {
    set(KEYS.applications, []);
  }

  // ── Settings ─────────────────────────────────────────────
  function getSettings() {
    return get(KEYS.settings, { ...DEFAULT_SETTINGS });
  }

  function updateSettings(updates) {
    const settings = getSettings();
    Object.assign(settings, updates);
    set(KEYS.settings, settings);
    return settings;
  }

  // ── Export / Import ──────────────────────────────────────
  function exportAll() {
    return {
      tasks: getTasks(),
      applications: getApplications(),
      settings: getSettings(),
      exportedAt: new Date().toISOString(),
    };
  }

  function importAll(data) {
    if (data.tasks) setTasks(data.tasks);
    if (data.applications) set(KEYS.applications, data.applications);
    if (data.settings) set(KEYS.settings, data.settings);
  }

  function exportCSV() {
    const apps = getApplications();
    const tasks = getTasks();
    if (apps.length === 0) return '';

    const headers = ['ID', 'Status', 'Submitted', 'Reviewed'];
    tasks.forEach(t => headers.push(t.title));

    const rows = apps.map(app => {
      const row = [app.id, app.status, app.timestamp, app.reviewedAt || ''];
      tasks.forEach(t => {
        row.push(app.proofs?.[t.id] || '');
      });
      return row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    return [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
  }

  // ── Task Reordering ──────────────────────────────────────
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
    return tasks;
  }

  // ── Bulk Application Actions ─────────────────────────────
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
    return apps;
  }

  function bulkDeleteApplications(ids) {
    const idSet = new Set(ids);
    const apps = getApplications().filter(a => !idSet.has(a.id));
    set(KEYS.applications, apps);
    return apps;
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
        // Fallback: look for any proof matching 0x pattern
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

    // Simple CSV line parser supporting quoted strings
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

      // Map subsequent headers to tasks if titles match or by index
      for (let h = 4; h < headers.length; h++) {
        const headerName = headers[h];
        const val = values[h] || '';
        // Find matching task by title
        const matchedTask = tasks.find(t => t.title.toLowerCase() === headerName.toLowerCase());
        if (matchedTask) {
          app.proofs[matchedTask.id] = val;
        } else if (tasks[h - 4]) {
          app.proofs[tasks[h - 4].id] = val;
        }
      }

      // Avoid exact ID collision
      const existingIdx = apps.findIndex(a => a.id === app.id);
      if (existingIdx >= 0) {
        apps[existingIdx] = app;
      } else {
        apps.push(app);
      }
      importedCount++;
    }

    set(KEYS.applications, apps);
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
        proofs: {
          [t1]: '@degen_collector',
          [t2]: 'https://x.com/degen_collector/status/178950182740192',
          [t3]: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        },
      },
      {
        id: uid(),
        status: 'approved',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
        reviewedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
        proofs: {
          [t1]: '@web3_samurai',
          [t2]: 'https://x.com/web3_samurai/status/178944771239918',
          [t3]: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        },
      },
      {
        id: uid(),
        status: 'rejected',
        timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
        reviewedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
        proofs: {
          [t1]: '@spam_bot_fake',
          [t2]: 'invalid link',
          [t3]: '0x0000000000000000000000000000000000000000',
        },
      },
    ];

    set(KEYS.applications, samples);
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

  return {
    getTasks, setTasks, addTask, updateTask, deleteTask, moveTask,
    getApplications, addApplication, updateApplicationStatus, deleteApplication, clearApplications,
    bulkUpdateStatus, bulkDeleteApplications,
    getSettings, updateSettings,
    exportAll, importAll, exportCSV, importCSV, getApprovedWallets,
    seedSampleApplications,
    verifyPIN, setPIN, resetToDefaults,
    generateCaptcha,
  };
})();

// Universal export
if (typeof window !== 'undefined') window.HomiesDB = HomiesDB;
if (typeof global !== 'undefined') global.HomiesDB = HomiesDB;
if (typeof module !== 'undefined' && module.exports) module.exports = HomiesDB;



import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS & Body Parsing Middleware ───────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// ── Default Seed Data ───────────────────────────────────────
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

const DEFAULT_APPLICATIONS = [
  {
    id: 'app_sample1',
    status: 'approved',
    timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    reviewedAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    proofs: {
      t1: '@cryptosatoshi_og',
      t2: 'https://x.com/cryptosatoshi_og/status/178920192837192',
      t3: '0x71C845e27Ec29a32066E0495C5c2B2FBE47A46c1',
    },
  },
  {
    id: 'app_sample2',
    status: 'pending',
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
    reviewedAt: null,
    proofs: {
      t1: '@pixel_homie99',
      t2: 'https://x.com/pixel_homie99/status/178948291048201',
      t3: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
    },
  },
  {
    id: 'app_sample3',
    status: 'pending',
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
    reviewedAt: null,
    proofs: {
      t1: '@degen_collector',
      t2: 'https://x.com/degen_collector/status/178950182740192',
      t3: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    },
  },
];

// In-Memory Fallback Store
const memoryStore = {
  tasks: [...DEFAULT_TASKS],
  settings: { ...DEFAULT_SETTINGS },
  applications: [...DEFAULT_APPLICATIONS],
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Mongoose Models ─────────────────────────────────────────
const TaskSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, default: 'custom' },
  title: { type: String, required: true },
  accounts: [String],
  links: [String],
  required: { type: Boolean, default: true },
  placeholder: { type: String, default: '' },
  order: { type: Number, default: 1 },
}, { timestamps: true });

const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

const ApplicationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  timestamp: { type: String, default: () => new Date().toISOString() },
  reviewedAt: { type: String, default: null },
  proofs: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

let TaskModel = mongoose.models.Task || mongoose.model('Task', TaskSchema);
let SettingModel = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
let ApplicationModel = mongoose.models.Application || mongoose.model('Application', ApplicationSchema);

// ── Serverless-Ready MongoDB Connection ─────────────────────
let cached = global.mongooseCache;
if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL ||
    ''
  ).trim();
}

async function seedDatabaseIfEmpty() {
  try {
    const taskCount = await TaskModel.countDocuments();
    if (taskCount === 0) {
      await TaskModel.insertMany(DEFAULT_TASKS);
      console.log('[MongoDB] Seeded default tasks');
    }

    const settingsCount = await SettingModel.countDocuments();
    if (settingsCount === 0) {
      const docs = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }));
      await SettingModel.insertMany(docs);
      console.log('[MongoDB] Seeded default settings');
    }

    const appCount = await ApplicationModel.countDocuments();
    if (appCount === 0) {
      await ApplicationModel.insertMany(DEFAULT_APPLICATIONS);
      console.log('[MongoDB] Seeded sample applications');
    }
  } catch (err) {
    console.warn('[MongoDB] Seeding error:', err.message);
  }
}

async function connectToDatabase() {
  const uri = getMongoUri();
  if (!uri) {
    return null;
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    };
    cached.promise = mongoose.connect(uri, opts).then(async (m) => {
      console.log('[MongoDB] Connected successfully to database!');
      await seedDatabaseIfEmpty();
      return m;
    }).catch((err) => {
      cached.promise = null;
      console.warn('[MongoDB] Connection error:', err.message);
      return null;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    console.warn('[MongoDB] Connection await failed:', err.message);
  }
  return cached.conn;
}

// Initial connection attempt
if (getMongoUri()) {
  connectToDatabase().catch(() => {});
} else {
  console.log('[MongoDB] No MONGODB_URI found in environment variables. Running in in-memory mode.');
}

function hasActiveDb() {
  return mongoose.connection.readyState === 1;
}

// Ensure database connection is ready for all /api endpoints
app.use('/api', async (req, res, next) => {
  if (getMongoUri() && mongoose.connection.readyState !== 1) {
    try {
      await connectToDatabase();
    } catch {
      // Fallback handles it gracefully
    }
  }
  next();
});

// ── API ROUTES ──────────────────────────────────────────────

// Health check & DB status
app.get('/api/health', async (req, res) => {
  const isDbActive = hasActiveDb();
  let taskCount = memoryStore.tasks.length;
  let appCount = memoryStore.applications.length;

  if (isDbActive) {
    try {
      taskCount = await TaskModel.countDocuments();
      appCount = await ApplicationModel.countDocuments();
    } catch {}
  }

  res.json({
    status: 'ok',
    database: isDbActive ? 'mongodb-connected' : (getMongoUri() ? 'mongodb-connecting' : 'in-memory-fallback'),
    hasMongoUri: !!getMongoUri(),
    stats: { tasks: taskCount, applications: appCount },
    timestamp: new Date().toISOString(),
  });
});

// ── Tasks Endpoints ─────────────────────────────────────────
app.get('/api/tasks', async (req, res) => {
  try {
    if (hasActiveDb()) {
      const docs = await TaskModel.find().sort({ order: 1 }).lean();
      if (docs && docs.length > 0) {
        return res.json(docs);
      }
    }
    const sorted = [...memoryStore.tasks].sort((a, b) => a.order - b.order);
    res.json(sorted);
  } catch (err) {
    console.warn('[Tasks GET] Falling back to memory:', err.message);
    res.json(memoryStore.tasks);
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const task = {
      id: req.body.id || uid(),
      type: req.body.type || 'custom',
      title: req.body.title || 'New Quest',
      accounts: Array.isArray(req.body.accounts) ? req.body.accounts : [],
      links: Array.isArray(req.body.links) ? req.body.links : [],
      required: req.body.required !== false,
      placeholder: req.body.placeholder || '',
      order: req.body.order || (memoryStore.tasks.length + 1),
    };

    memoryStore.tasks.push(task);

    if (hasActiveDb()) {
      try {
        await TaskModel.create(task);
      } catch (dbErr) {
        console.warn('[Task POST DB]', dbErr.message);
      }
    }

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const idx = memoryStore.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      memoryStore.tasks[idx] = { ...memoryStore.tasks[idx], ...updates };
    }

    if (hasActiveDb()) {
      try {
        await TaskModel.findOneAndUpdate({ id }, { $set: updates }, { new: true });
      } catch (dbErr) {
        console.warn('[Task PUT DB]', dbErr.message);
      }
    }

    const updated = idx !== -1 ? memoryStore.tasks[idx] : updates;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    memoryStore.tasks = memoryStore.tasks.filter(t => t.id !== id);
    memoryStore.tasks.forEach((t, i) => t.order = i + 1);

    if (hasActiveDb()) {
      try {
        await TaskModel.deleteOne({ id });
      } catch (dbErr) {
        console.warn('[Task DELETE DB]', dbErr.message);
      }
    }

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks-reorder', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (Array.isArray(tasks)) {
      memoryStore.tasks = tasks;
      if (hasActiveDb()) {
        try {
          for (const t of tasks) {
            await TaskModel.updateOne({ id: t.id }, { $set: { order: t.order } });
          }
        } catch (dbErr) {
          console.warn('[Tasks Reorder DB]', dbErr.message);
        }
      }
    }
    res.json({ success: true, tasks: memoryStore.tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Settings Endpoints ──────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    if (hasActiveDb()) {
      const docs = await SettingModel.find().lean();
      if (docs && docs.length > 0) {
        const obj = {};
        docs.forEach(d => obj[d.key] = d.value);
        return res.json({ ...DEFAULT_SETTINGS, ...obj });
      }
    }
    res.json(memoryStore.settings);
  } catch (err) {
    console.warn('[Settings GET] Falling back to memory:', err.message);
    res.json(memoryStore.settings);
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const updates = req.body;
    memoryStore.settings = { ...memoryStore.settings, ...updates };

    if (hasActiveDb()) {
      try {
        for (const [key, value] of Object.entries(updates)) {
          await SettingModel.updateOne(
            { key },
            { $set: { value } },
            { upsert: true }
          );
        }
      } catch (dbErr) {
        console.warn('[Settings PUT DB]', dbErr.message);
      }
    }

    res.json(memoryStore.settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Applications Endpoints ──────────────────────────────────
app.get('/api/applications', async (req, res) => {
  try {
    const { status, search } = req.query;
    let list = [];

    if (hasActiveDb()) {
      const query = {};
      if (status && status !== 'all') query.status = status;
      list = await ApplicationModel.find(query).sort({ timestamp: -1 }).lean();
    } else {
      list = [...memoryStore.applications];
      if (status && status !== 'all') {
        list = list.filter(a => a.status === status);
      }
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a => {
        if (a.id && a.id.toLowerCase().includes(q)) return true;
        if (a.proofs) {
          return Object.values(a.proofs).some(v => String(v).toLowerCase().includes(q));
        }
        return false;
      });
    }

    res.json(list);
  } catch (err) {
    console.warn('[Applications GET] Falling back to memory:', err.message);
    res.json(memoryStore.applications);
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const { proofs, id, status, timestamp, reviewedAt } = req.body;
    const newApp = {
      id: id || uid(),
      status: status || 'pending',
      timestamp: timestamp || new Date().toISOString(),
      reviewedAt: reviewedAt || null,
      proofs: proofs || {},
    };

    memoryStore.applications.unshift(newApp);

    if (hasActiveDb()) {
      try {
        await ApplicationModel.create(newApp);
      } catch (dbErr) {
        console.warn('[Application POST DB]', dbErr.message);
      }
    }

    res.status(201).json(newApp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const now = new Date().toISOString();

    const idx = memoryStore.applications.findIndex(a => a.id === id);
    if (idx !== -1) {
      memoryStore.applications[idx].status = status;
      memoryStore.applications[idx].reviewedAt = now;
    }

    if (hasActiveDb()) {
      try {
        await ApplicationModel.updateOne(
          { id },
          { $set: { status, reviewedAt: now } }
        );
      } catch (dbErr) {
        console.warn('[Application PUT DB]', dbErr.message);
      }
    }

    const updated = idx !== -1 ? memoryStore.applications[idx] : { id, status, reviewedAt: now };
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    memoryStore.applications = memoryStore.applications.filter(a => a.id !== id);

    if (hasActiveDb()) {
      try {
        await ApplicationModel.deleteOne({ id });
      } catch (dbErr) {
        console.warn('[Application DELETE DB]', dbErr.message);
      }
    }

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/applications/bulk-status', async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });

    const now = new Date().toISOString();
    const idSet = new Set(ids);

    memoryStore.applications.forEach(a => {
      if (idSet.has(a.id)) {
        a.status = status;
        a.reviewedAt = now;
      }
    });

    if (hasActiveDb()) {
      try {
        await ApplicationModel.updateMany(
          { id: { $in: ids } },
          { $set: { status, reviewedAt: now } }
        );
      } catch (dbErr) {
        console.warn('[Bulk Status DB]', dbErr.message);
      }
    }

    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/applications/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });

    const idSet = new Set(ids);
    memoryStore.applications = memoryStore.applications.filter(a => !idSet.has(a.id));

    if (hasActiveDb()) {
      try {
        await ApplicationModel.deleteMany({ id: { $in: ids } });
      } catch (dbErr) {
        console.warn('[Bulk Delete DB]', dbErr.message);
      }
    }

    res.json({ success: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    let correctPIN = memoryStore.settings.adminPIN || 'homies2026';

    if (hasActiveDb()) {
      try {
        const pinDoc = await SettingModel.findOne({ key: 'adminPIN' }).lean();
        if (pinDoc && pinDoc.value) correctPIN = pinDoc.value;
      } catch (err) {
        console.warn('[Verify PIN DB]', err.message);
      }
    }

    const valid = String(pin).trim() === String(correctPIN).trim();
    res.json({ valid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset-defaults', async (req, res) => {
  try {
    memoryStore.tasks = [...DEFAULT_TASKS];
    memoryStore.settings = { ...DEFAULT_SETTINGS };

    if (hasActiveDb()) {
      try {
        await TaskModel.deleteMany({});
        await TaskModel.insertMany(DEFAULT_TASKS);
        await SettingModel.deleteMany({});
        const docs = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }));
        await SettingModel.insertMany(docs);
      } catch (dbErr) {
        console.warn('[Reset DB]', dbErr.message);
      }
    }

    res.json({ success: true, tasks: memoryStore.tasks, settings: memoryStore.settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── HTML Fallback Routing ───────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Listen on Port (when not in Serverless / Vercel) ─────────
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Homies Server running at http://0.0.0.0:${PORT}`);
  });
}

export default app;

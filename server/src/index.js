/**
 * SocietyCharge — Main Server Entry Point
 * 
 * Multi-tenant EV charging management platform.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createServer } = require('http');
const { Server: SocketIO } = require('socket.io');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./db/knex');
const chargerSimulator = require('./services/chargerSimulator');
const ocppService = require('./services/ocppService');
const { renderLanding } = require('./views/landing');

// ── Create Express App ──────────────────────────────────
const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

// ── Socket.IO ───────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

// Socket.IO authentication: every connection must present a valid access token
// (client: io(url, { auth: { token } }) or an "Authorization: Bearer" header)
io.use((socket, next) => {
  const headerToken = (socket.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = socket.handshake.auth?.token || headerToken;
  if (!token) return next(new Error('Authentication required'));

  try {
    socket.data.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    next(new Error(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log(`[Socket.IO] Client connected: ${socket.id} (user ${user.id})`);

  // Every user receives their own events
  socket.join(`user_${user.id}`);

  // Society rooms carry other residents' session data, so only that
  // society's admins (and super admins) may join them.
  socket.on('join_society', async (societyId, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const id = parseInt(societyId, 10);
    if (!id) return reply({ ok: false, error: 'Valid society ID required' });

    try {
      if (user.role !== 'super_admin') {
        const member = await db('society_members')
          .where({ user_id: user.id, society_id: id, role: 'admin', status: 'approved' })
          .first();
        if (!member) {
          console.warn(`[Socket.IO] ${socket.id} (user ${user.id}) refused society_${id}`);
          return reply({ ok: false, error: 'Society admin access required' });
        }
      }

      socket.join(`society_${id}`);
      console.log(`[Socket.IO] ${socket.id} joined society_${id}`);
      reply({ ok: true });
    } catch (err) {
      console.error('[Socket.IO] join_society error:', err.message);
      reply({ ok: false, error: 'Failed to join society' });
    }
  });

  // Kept for older clients: users may only (re)join their own room
  socket.on('join_user', (userId, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (parseInt(userId, 10) !== user.id) {
      return reply({ ok: false, error: 'You can only join your own user room' });
    }
    socket.join(`user_${user.id}`);
    reply({ ok: true });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Initialize charger simulator with Socket.IO
chargerSimulator.init(io);
// Initialize OCPP 1.6-J Central System WebSocket Server
ocppService.init(httpServer, io);

// ── Middleware ───────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({
  limit: '10mb',
  // Keep the exact request bytes for webhook signature verification
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/payments/webhook')) {
      req.rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
// General API limit per client address. One admin dashboard refresh makes
// about a dozen requests, and residents on a society's shared Wi-Fi share
// one address, so this needs headroom. Sign-in has its own stricter limit.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT, 10) || 1000,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});
app.use('/api/', apiLimiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many authentication attempts' },
  validate: { xForwardedForHeader: false },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/change-password', authLimiter);

// ── API Routes ──────────────────────────────────────────
const authRoutes = require('./routes/auth');
const societyRoutes = require('./routes/societies');
const chargerRoutes = require('./routes/chargers');
const bookingRoutes = require('./routes/bookings');
const sessionRoutes = require('./routes/sessions');
const billingRoutes = require('./routes/billing');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const profileRoutes = require('./routes/profile');
const residentRoutes = require('./routes/residents');
const subscriptionRoutes = require('./routes/subscriptions');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/societies', societyRoutes);
app.use('/api/societies/:societyId/chargers', chargerRoutes);
app.use('/api/societies/:societyId/bookings', bookingRoutes);
app.use('/api/societies/:societyId/sessions', sessionRoutes);
app.use('/api/societies/:societyId/billing', billingRoutes);
app.use('/api/societies/:societyId/subscription', subscriptionRoutes);
app.use('/api/societies/:societyId', residentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);

// ── Health Check ────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'EcoVoltX',
    powered_by: 'EcoNelssol',
    version: '1.0.0',
    demo_mode: config.demoMode,
    timestamp: new Date().toISOString(),
  });
});

// ── Serve static files for admin-dashboard and resident-app ─
const adminBuildPath = path.join(__dirname, '../../admin-dashboard/dist');
const residentBuildPath = path.join(__dirname, '../../resident-app/dist');

if (fs.existsSync(adminBuildPath)) {
  app.use('/admin', express.static(adminBuildPath));
  app.get(['/admin', '/admin/*'], (req, res) => {
    res.sendFile(path.join(adminBuildPath, 'index.html'));
  });
}

if (fs.existsSync(residentBuildPath)) {
  app.use('/app', express.static(residentBuildPath));
  app.get(['/app', '/app/*'], (req, res) => {
    res.sendFile(path.join(residentBuildPath, 'index.html'));
  });
}

// ── Root Landing Page ───────────────────────────────────
app.get('/', (req, res) => {
  res.send(renderLanding({ demoMode: config.demoMode }));
});

// ── Error Handling ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: config.nodeEnv === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Ensure data directory exists ────────────────────────
const dataDir = path.dirname(path.resolve(__dirname, '../', config.dbPath));
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ── Auto-initialize DB if needed & Start Server ─────────
function fatal(lines) {
  console.error(['', '✖ EcoVoltX cannot start:', ...lines.map((l) => `  - ${l}`), ''].join('\n'));
  process.exit(1);
}

/**
 * Create the first super admin for a fresh production database
 * from SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD (no demo data, no shared password).
 */
async function createInitialSuperAdmin() {
  const problems = [];
  if (!config.superAdminEmail || !config.superAdminEmail.includes('@')) {
    problems.push('SUPERADMIN_EMAIL must be set to the first super admin\'s email');
  }
  if (config.superAdminPassword.length < 12) {
    problems.push('SUPERADMIN_PASSWORD must be set (at least 12 characters)');
  }
  if (problems.length) {
    fatal([
      'Fresh database and DEMO_MODE is off, so no demo accounts will be created.',
      ...problems,
      'Or set DEMO_MODE=true to load the sample demo data instead.',
    ]);
  }

  const hash = await bcrypt.hash(config.superAdminPassword, 12);
  await db('users').insert({
    email: config.superAdminEmail,
    password_hash: hash,
    name: config.superAdminName,
    role: 'super_admin',
  });
  console.log(`[DB] Created initial super admin ${config.superAdminEmail}. Sign in at /admin/ to set up societies.`);
}

/**
 * Loud warning when a non-demo server still has the demo accounts
 * (they all share the public demo password).
 */
async function warnAboutDemoAccounts() {
  const demo = await db('users')
    .where('email', 'superadmin@societycharge.com')
    .orWhere('email', 'like', '%@test.com')
    .count('id as count')
    .first();
  if (Number(demo?.count) > 0) {
    console.warn(`[Security] DEMO_MODE is off but ${demo.count} demo account(s) with the public demo password exist. Delete them or change their passwords before going live.`);
  }
}

async function startServer() {
  // Refuse to run in production with missing/default/weak JWT secrets
  const secretProblems = config.getSecretProblems();
  if (secretProblems.length) {
    if (config.isProduction) {
      fatal([...secretProblems, 'Set long random values, e.g. node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"']);
    }
    console.warn(`[Security] Development only: ${secretProblems.join('; ')}`);
  }

  try {
    // Always apply pending migrations so existing databases get schema/security updates
    const [, applied] = await db.migrate.latest();
    if (applied.length) {
      console.log(`[DB] Applied migrations: ${applied.join(', ')}`);
    }
    // "Fresh" = no users yet (also covers a first start that stopped before creating any)
    const userCount = await db('users').count('id as count').first();
    if (Number(userCount?.count) === 0) {
      if (config.demoMode) {
        console.log('[DB] Fresh database detected (DEMO_MODE on). Loading demo data...');
        await db.seed.run();
        console.log('[DB] Demo data loaded. All demo accounts use the password "password123".');
      } else {
        await createInitialSuperAdmin();
      }
    } else if (!config.demoMode) {
      await warnAboutDemoAccounts();
    }

    const paymentService = require('./services/paymentService');
    const paymentProblem = paymentService.getPaymentSetupProblem();
    if (paymentProblem) console.warn(`[Payments] ${paymentProblem}`);
    else console.log(`[Payments] ${paymentService.getGatewayConfig().description}`);
  } catch (err) {
    console.error('[DB] Database initialization notice:', err.message);
  }

  httpServer.listen(config.port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                   ⚡ EcoVoltX Server ⚡                   ║
║               Powered by EcoNelssol                        ║
║                                                            ║
║  API:    http://localhost:${config.port}/api                        ║
║  Health: http://localhost:${config.port}/api/health                 ║
║  Env:    ${config.nodeEnv.padEnd(46)}║
║  Demo:   ${(config.demoMode ? 'ON (sample data & demo logins)' : 'off').padEnd(46)}║
║  Sim:    ${(config.chargerSimulator ? 'ON (simulated charging sessions)' : 'off').padEnd(46)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);

    // Simulated charging sessions (demo data, DEMO-mode chargers)
    if (config.chargerSimulator) {
      chargerSimulator.startSimulation();
    } else {
      console.log('[ChargerSimulator] Off. Set CHARGER_SIMULATOR=true to simulate DEMO-mode chargers.');
    }
  });
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  chargerSimulator.stopSimulation();
  httpServer.close(() => {
    db.destroy();
    process.exit(0);
  });
});

module.exports = { app, io };

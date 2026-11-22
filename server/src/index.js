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
const { createServer } = require('http');
const { Server: SocketIO } = require('socket.io');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./db/knex');
const chargerSimulator = require('./services/chargerSimulator');
const ocppService = require('./services/ocppService');

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
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
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

// ── Root Landing / Launcher Hub ────────────────────────
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EcoVoltX — Powered by EcoNelssol | EV Platform Launcher</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background: #070d19;
      color: #f8fafc;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
    }
    .container {
      max-width: 960px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .brand-hero {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .brand-name {
      font-size: 2.8rem;
      font-weight: 900;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #ffffff 0%, #34d399 50%, #38bdf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .powered-by-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.95rem;
      font-weight: 500;
      color: #94a3b8;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 6px 16px;
      border-radius: 999px;
      margin-bottom: 16px;
    }
    .econelssol-text {
      font-weight: 800;
      font-size: 1.05rem;
      letter-spacing: -0.02em;
    }
    .eco-green { color: #00A651; }
    .nelssol-blue { color: #0066CC; }
    p.lead {
      color: #94a3b8;
      font-size: 1.05rem;
      max-width: 650px;
      margin: 0 auto;
      line-height: 1.6;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 24px;
      margin-bottom: 28px;
    }
    .card {
      background: #111a2e;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 30px 28px;
      transition: all 0.25s ease;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .card:hover {
      border-color: #00A651;
      transform: translateY(-4px);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 25px rgba(0, 166, 81, 0.18);
    }
    .card-icon {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      margin-bottom: 18px;
    }
    .card-icon.app {
      background: linear-gradient(135deg, #00A651 0%, #059669 100%);
      box-shadow: 0 0 20px rgba(0, 166, 81, 0.4);
    }
    .card-icon.admin {
      background: linear-gradient(135deg, #0066CC 0%, #0284c7 100%);
      box-shadow: 0 0 20px rgba(0, 102, 204, 0.4);
    }
    h2 {
      font-size: 1.35rem;
      font-weight: 700;
      margin-bottom: 8px;
      color: #ffffff;
    }
    .card-desc {
      color: #94a3b8;
      font-size: 0.9rem;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .card-features {
      list-style: none;
      margin-bottom: 24px;
      font-size: 0.85rem;
      color: #cbd5e1;
    }
    .card-features li {
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-features li::before {
      content: "✓";
      color: #00A651;
      font-weight: bold;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 13px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.95rem;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .btn-emerald {
      background: #00A651;
      color: #ffffff;
    }
    .btn-emerald:hover {
      background: #00c761;
      box-shadow: 0 0 20px rgba(0, 166, 81, 0.5);
    }
    .btn-cyan {
      background: #0066CC;
      color: #ffffff;
    }
    .btn-cyan:hover {
      background: #1a7fe6;
      box-shadow: 0 0 20px rgba(0, 102, 204, 0.5);
    }
    .sub-banner {
      background: linear-gradient(90deg, rgba(0, 166, 81, 0.12) 0%, rgba(0, 102, 204, 0.12) 100%);
      border: 1px solid rgba(0, 166, 81, 0.3);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .sub-badge {
      background: #00A651;
      color: white;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }
    .demo-box {
      background: #0d1526;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 22px 24px;
    }
    .demo-title {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .creds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      font-size: 0.83rem;
    }
    .cred-card {
      background: #141e33;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid #1e293b;
    }
    .cred-role {
      font-weight: 600;
      color: #34d399;
      margin-bottom: 4px;
    }
    .cred-val {
      font-family: 'JetBrains Mono', monospace;
      color: #cbd5e1;
      font-size: 0.78rem;
    }
    .status-bar {
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #64748b;
      font-size: 0.8rem;
      border-top: 1px solid #1e293b;
      padding-top: 16px;
    }
    .pulse {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #00A651;
      box-shadow: 0 0 10px #00A651;
      margin-right: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-hero">
        <span class="brand-name">⚡ EcoVoltX</span>
      </div>
      <div class="powered-by-tag">
        Powered by <span class="econelssol-text"><span class="eco-green">Eco</span><span class="nelssol-blue">Nelssol</span></span>
      </div>
      <p class="lead">Next-generation multi-society EV charging ecosystem. Complete tenant data isolation, real-time telemetry, automated billing, and tiered society SaaS subscriptions.</p>
    </div>

    <!-- Subscription Model Highlight -->
    <div class="sub-banner">
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="sub-badge">New</span>
        <span style="font-weight:600; color:#f8fafc; font-size:0.92rem;">Tiered Society Subscription Model Integrated in Admin Portal</span>
      </div>
      <div style="font-size:0.85rem; color:#94a3b8;">
        Plans: <strong style="color:#34d399;">Starter</strong> (₹1,999/mo) • <strong style="color:#38bdf8;">Pro</strong> (₹4,999/mo) • <strong style="color:#a78bfa;">Enterprise</strong> (₹9,999/mo)
      </div>
    </div>

    <div class="grid">
      <!-- Resident App -->
      <div class="card">
        <div>
          <div class="card-icon app">📱</div>
          <h2>Resident Mobile App</h2>
          <p class="card-desc">Mobile web application for residents: live chargers, instant start/stop, session telemetry, slot bookings, and monthly billing.</p>
          <ul class="card-features">
            <li>Society code join with instant approval status</li>
            <li>Real-time charger availability & telemetry</li>
            <li>Start / Stop charging with live kWh meter</li>
            <li>Calendar slot reservations</li>
            <li>Monthly invoices & mock digital payments</li>
          </ul>
        </div>
        <a href="/app/" class="btn btn-emerald">Launch Resident App →</a>
      </div>

      <!-- Admin Portal -->
      <div class="card">
        <div>
          <div class="card-icon admin">🏢</div>
          <h2>Admin Management Portal</h2>
          <p class="card-desc">Comprehensive dashboard for Society Admins & Super Admins with charger maintenance, resident approvals, tariffs, and subscription billing.</p>
          <ul class="card-features">
            <li><strong>Society Subscription & Invoicing Model</strong></li>
            <li>Live charger telemetry, reset & maintenance</li>
            <li>Resident approval & membership control</li>
            <li>TOD dynamic electricity tariffs & idle fees</li>
            <li>Super Admin MRR/ARR analytics & society management</li>
          </ul>
        </div>
        <a href="/admin/" class="btn btn-cyan">Launch Admin Portal →</a>
      </div>

      <!-- 24/7 Public Charging Access -->
      <div class="card" style="border-color: #00A651; background: linear-gradient(180deg, rgba(0, 166, 81, 0.08) 0%, rgba(17, 26, 46, 1) 100%);">
        <div>
          <div class="card-icon" style="background: linear-gradient(135deg, #00A651 0%, #0066CC 100%); box-shadow: 0 0 20px rgba(0, 166, 81, 0.4);">⚡</div>
          <h2>24/7 Public EV Access</h2>
          <p class="card-desc">Public guest mode for anyone, visitors, and drivers to discover chargers and charge 24/7 without needing registration or admin approval.</p>
          <ul class="card-features">
            <li><strong>Open 24 Hours / 7 Days a Week</strong></li>
            <li>No society login or flat verification needed</li>
            <li>Real-time availability and station locator</li>
            <li>Instant guest charge start with phone & vehicle plate</li>
            <li>Instant digital UPI billing & payment receipts</li>
          </ul>
        </div>
        <a href="/app/public" class="btn" style="background: linear-gradient(90deg, #00A651 0%, #0066CC 100%); color: white;">⚡ Start 24/7 Public Charge →</a>
      </div>
    </div>

    <!-- Demo Credentials -->
    <div class="demo-box">
      <div class="demo-title">
        <span>🔑 Demo Test Credentials (All passwords: password123)</span>
        <span style="color:#00A651; font-weight:600;">Pre-seeded in DB</span>
      </div>
      <div class="creds-grid">
        <div class="cred-card">
          <div class="cred-role">Super Admin</div>
          <div class="cred-val">superadmin@societycharge.com</div>
        </div>
        <div class="cred-card">
          <div class="cred-role">Green Valley Admin (Pro Plan)</div>
          <div class="cred-val">admin_gvr@test.com</div>
        </div>
        <div class="cred-card">
          <div class="cred-role">Sunrise Towers Admin (Starter Plan)</div>
          <div class="cred-val">admin_srt@test.com</div>
        </div>
        <div class="cred-card">
          <div class="cred-role">Resident (Green Valley)</div>
          <div class="cred-val">rahul@test.com (Flat A-101)</div>
        </div>
      </div>

      <div class="status-bar">
        <div><span class="pulse"></span> EcoVoltX Platform & Charger Simulator Online (Port 3000)</div>
        <div>
          <span style="color:#94a3b8; margin-right:12px;">Powered by <span style="font-weight:700;"><span style="color:#00A651;">Eco</span><span style="color:#0066CC;">Nelssol</span></span></span>
          <a href="/api/health" style="color:#64748b; text-decoration:none;">/api/health ↗</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `);
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
async function startServer() {
  try {
    const hasUsers = await db.schema.hasTable('users');
    // Always apply pending migrations so existing databases get schema/security updates
    const [, applied] = await db.migrate.latest();
    if (applied.length) {
      console.log(`[DB] Applied migrations: ${applied.join(', ')}`);
    }
    if (!hasUsers) {
      console.log('[DB] Fresh database detected. Running seeds...');
      await db.seed.run();
      console.log('[DB] Seeds finished successfully.');
    }
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
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);

    // Start charger simulation
    chargerSimulator.startSimulation();
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

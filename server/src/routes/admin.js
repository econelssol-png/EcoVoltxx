/**
 * Super Admin Routes
 * 
 * GET  /api/admin/dashboard               — platform overview
 * GET  /api/admin/societies               — list all societies
 * POST /api/admin/societies               — create society
 * GET  /api/admin/societies/:id           — society details
 * PUT  /api/admin/societies/:id           — update society
 * POST /api/admin/societies/:id/assign-admin — assign admin to society
 * GET  /api/admin/societies/:id/analytics — society analytics
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// All routes require super_admin role
router.use(authenticate, requireRole('super_admin'));

// ── Platform dashboard ──────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const totalSocieties = await db('societies').count('id as count').first();
    const activeSocieties = await db('societies').where({ status: 'active' }).count('id as count').first();
    const totalUsers = await db('users').where({ role: 'user' }).count('id as count').first();
    const totalChargers = await db('chargers').count('id as count').first();
    const activeSessions = await db('charging_sessions').where({ status: 'active' }).count('id as count').first();

    // Total energy and revenue
    const totals = await db('charging_sessions')
      .where({ status: 'completed' })
      .select(
        db.raw('SUM(energy_kwh) as total_energy'),
        db.raw('SUM(cost) as total_revenue'),
        db.raw('COUNT(*) as total_sessions')
      )
      .first();

    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStats = await db('charging_sessions')
      .where('start_time', '>=', todayStart.toISOString())
      .select(
        db.raw('SUM(energy_kwh) as energy'),
        db.raw('SUM(cost) as revenue'),
        db.raw('COUNT(*) as sessions')
      )
      .first();

    // Recent societies
    const recentSocieties = await db('societies')
      .orderBy('created_at', 'desc')
      .limit(5)
      .select('*');

    res.json({
      overview: {
        total_societies: totalSocieties.count,
        active_societies: activeSocieties.count,
        total_users: totalUsers.count,
        total_chargers: totalChargers.count,
        active_sessions: activeSessions.count,
        total_energy_kwh: parseFloat(totals?.total_energy || 0),
        total_revenue: parseFloat(totals?.total_revenue || 0),
        total_sessions: totals?.total_sessions || 0,
      },
      today: {
        energy_kwh: parseFloat(todayStats?.energy || 0),
        revenue: parseFloat(todayStats?.revenue || 0),
        sessions: todayStats?.sessions || 0,
      },
      recent_societies: recentSocieties,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// ── List all societies ──────────────────────────────────
router.get('/societies', async (req, res) => {
  try {
    const societies = await db('societies').orderBy('created_at', 'desc');

    // Enrich with stats
    const enriched = await Promise.all(
      societies.map(async (society) => {
        const chargers = await db('chargers').where({ society_id: society.id }).count('id as count').first();
        const members = await db('society_members').where({ society_id: society.id, status: 'approved' }).count('id as count').first();
        const sessions = await db('charging_sessions').where({ society_id: society.id, status: 'active' }).count('id as count').first();
        return {
          ...society,
          stats: {
            chargers: chargers.count,
            members: members.count,
            active_sessions: sessions.count,
          },
        };
      })
    );

    res.json({ societies: enriched });
  } catch (err) {
    console.error('List societies error:', err);
    res.status(500).json({ error: 'Failed to list societies' });
  }
});

// ── Create society ──────────────────────────────────────
router.post('/societies', async (req, res) => {
  try {
    const { name, code, address, city, state, pincode, description, default_price_per_kwh } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const existing = await db('societies').where({ code: code.toUpperCase() }).first();
    if (existing) {
      return res.status(409).json({ error: 'Society code already exists' });
    }

    const [id] = await db('societies').insert({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      address: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      description: description || null,
      default_price_per_kwh: default_price_per_kwh || 8.0,
    });

    const society = await db('societies').where({ id }).first();
    res.status(201).json({ society });
  } catch (err) {
    console.error('Create society error:', err);
    res.status(500).json({ error: 'Failed to create society' });
  }
});

// ── Get society details ─────────────────────────────────
router.get('/societies/:id', async (req, res) => {
  try {
    const society = await db('societies').where({ id: req.params.id }).first();
    if (!society) {
      return res.status(404).json({ error: 'Society not found' });
    }

    const chargers = await db('chargers').where({ society_id: society.id });
    const members = await db('society_members')
      .join('users', 'society_members.user_id', 'users.id')
      .where({ 'society_members.society_id': society.id })
      .select('users.id', 'users.name', 'users.email', 'society_members.role', 'society_members.status', 'society_members.flat_number');

    const admins = members.filter((m) => m.role === 'admin');

    res.json({ society, chargers, members, admins });
  } catch (err) {
    console.error('Get society error:', err);
    res.status(500).json({ error: 'Failed to get society' });
  }
});

// ── Update society ──────────────────────────────────────
router.put('/societies/:id', async (req, res) => {
  try {
    const society = await db('societies').where({ id: req.params.id }).first();
    if (!society) {
      return res.status(404).json({ error: 'Society not found' });
    }

    const updates = {};
    const text = (v) => (typeof v === 'string' ? v.trim() : v);

    if (req.body.name !== undefined) {
      const name = text(req.body.name);
      if (!name) return res.status(400).json({ error: 'Society name is required' });
      updates.name = name;
    }

    // Join code: residents type this to join, so keep it short, simple and unique
    if (req.body.code !== undefined) {
      const code = String(req.body.code || '').trim().toUpperCase();
      if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
        return res.status(400).json({ error: 'Join code must be 3-20 letters, numbers or dashes' });
      }
      if (code !== society.code) {
        const taken = await db('societies').where({ code }).whereNot({ id: society.id }).first();
        if (taken) return res.status(409).json({ error: 'That join code is already used by another society' });
      }
      updates.code = code;
    }

    for (const field of ['address', 'city', 'state', 'pincode', 'description']) {
      if (req.body[field] !== undefined) updates[field] = text(req.body[field]) || null;
    }

    if (req.body.default_price_per_kwh !== undefined) {
      const price = parseFloat(req.body.default_price_per_kwh);
      if (!Number.isFinite(price) || price <= 0 || price > 100) {
        return res.status(400).json({ error: 'Rate must be a number between 0 and 100 (₹ per kWh)' });
      }
      updates.default_price_per_kwh = price;
    }

    for (const field of ['status', 'max_chargers']) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    updates.updated_at = db.fn.now();

    await db('societies').where({ id: society.id }).update(updates);
    const updated = await db('societies').where({ id: society.id }).first();

    res.json({ society: updated });
  } catch (err) {
    console.error('Update society error:', err);
    res.status(500).json({ error: 'Failed to update society' });
  }
});

// ── Assign admin to society ─────────────────────────────
router.post('/societies/:id/assign-admin', async (req, res) => {
  try {
    const { email, name, password, flat_number } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const society = await db('societies').where({ id: req.params.id }).first();
    if (!society) {
      return res.status(404).json({ error: 'Society not found' });
    }

    // Find or create user
    let user = await db('users').where({ email: email.toLowerCase().trim() }).first();

    if (!user) {
      if (!password || !name) {
        return res.status(400).json({ error: 'Name and password required for new admin user' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const [userId] = await db('users').insert({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        name: name.trim(),
        role: 'user',
      });
      user = await db('users').where({ id: userId }).first();
    }

    // Check if already a member
    const existing = await db('society_members')
      .where({ user_id: user.id, society_id: society.id })
      .first();

    if (existing) {
      // Update to admin
      await db('society_members').where({ id: existing.id }).update({
        role: 'admin',
        status: 'approved',
        joined_at: existing.joined_at || new Date().toISOString(),
        updated_at: db.fn.now(),
      });
    } else {
      // Create admin membership
      await db('society_members').insert({
        user_id: user.id,
        society_id: society.id,
        flat_number: flat_number || null,
        role: 'admin',
        status: 'approved',
        joined_at: new Date().toISOString(),
      });
    }

    res.json({
      message: `${user.name} assigned as admin of ${society.name}`,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Assign admin error:', err);
    res.status(500).json({ error: 'Failed to assign admin' });
  }
});

// ── Society analytics (super admin view) ────────────────
router.get('/societies/:id/analytics', async (req, res) => {
  try {
    const societyId = parseInt(req.params.id, 10);
    const society = await db('societies').where({ id: societyId }).first();
    if (!society) {
      return res.status(404).json({ error: 'Society not found' });
    }

    const totals = await db('charging_sessions')
      .where({ society_id: societyId, status: 'completed' })
      .select(
        db.raw('SUM(energy_kwh) as total_energy'),
        db.raw('SUM(cost) as total_revenue'),
        db.raw('COUNT(*) as total_sessions')
      )
      .first();

    const chargers = await db('chargers').where({ society_id: societyId }).count('id as count').first();
    const members = await db('society_members').where({ society_id: societyId, status: 'approved' }).count('id as count').first();

    res.json({
      society,
      stats: {
        total_chargers: chargers.count,
        total_members: members.count,
        total_sessions: totals?.total_sessions || 0,
        total_energy_kwh: parseFloat(totals?.total_energy || 0),
        total_revenue: parseFloat(totals?.total_revenue || 0),
      },
    });
  } catch (err) {
    console.error('Society analytics error:', err);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

module.exports = router;

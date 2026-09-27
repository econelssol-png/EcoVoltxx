/**
 * Society Routes
 * 
 * GET    /api/societies              — list user's societies
 * POST   /api/societies              — create society (super admin)
 * GET    /api/societies/:id          — get society details
 * PUT    /api/societies/:id          — update society (super admin / society admin)
 * POST   /api/societies/:id/join     — join a society
 * GET    /api/societies/lookup/:code — lookup society by code
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

const router = express.Router();

// ── List user's societies ───────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'super_admin') {
      const societies = await db('societies')
        .select('*')
        .orderBy('created_at', 'desc');
      return res.json({ societies });
    }

    const societies = await db('society_members')
      .join('societies', 'society_members.society_id', 'societies.id')
      .where({ 'society_members.user_id': req.user.id, 'society_members.status': 'approved' })
      .select(
        'societies.*',
        'society_members.role as member_role',
        'society_members.flat_number'
      );

    res.json({ societies });
  } catch (err) {
    console.error('List societies error:', err);
    res.status(500).json({ error: 'Failed to list societies' });
  }
});

// ── Lookup society by code ──────────────────────────────
router.get('/lookup/:code', authenticate, async (req, res) => {
  try {
    const society = await db('societies')
      .where({ code: req.params.code.toUpperCase(), status: 'active' })
      .select('id', 'name', 'code', 'address', 'city')
      .first();

    if (!society) {
      return res.status(404).json({ error: 'Society not found or inactive' });
    }

    res.json({ society });
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// ── Create society (super admin only) ───────────────────
router.post('/', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { name, code, address, city, state, pincode, description, default_price_per_kwh } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Check code uniqueness
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
router.get('/:id', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const society = req.society;

    // Get stats
    const chargerCount = await db('chargers').where({ society_id: society.id }).count('id as count').first();
    const availableChargers = await db('chargers').where({ society_id: society.id, status: 'available' }).count('id as count').first();
    const memberCount = await db('society_members').where({ society_id: society.id, status: 'approved' }).count('id as count').first();
    const activeSessions = await db('charging_sessions').where({ society_id: society.id, status: 'active' }).count('id as count').first();

    res.json({
      society,
      stats: {
        total_chargers: chargerCount.count,
        available_chargers: availableChargers.count,
        total_members: memberCount.count,
        active_sessions: activeSessions.count,
      },
    });
  } catch (err) {
    console.error('Get society error:', err);
    res.status(500).json({ error: 'Failed to get society details' });
  }
});

// ── Update society ──────────────────────────────────────
router.put('/:id', authenticate, async (req, res) => {
  try {
    const societyId = parseInt(req.params.id, 10);

    // Check permissions: super admin or society admin
    if (req.user.role !== 'super_admin') {
      const membership = await db('society_members')
        .where({ user_id: req.user.id, society_id: societyId, role: 'admin', status: 'approved' })
        .first();
      if (!membership) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const allowedFields = ['name', 'address', 'city', 'state', 'pincode', 'description', 'default_price_per_kwh', 'status'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Only super admin can change status
    if (updates.status && req.user.role !== 'super_admin') {
      delete updates.status;
    }

    updates.updated_at = db.fn.now();

    await db('societies').where({ id: societyId }).update(updates);
    const society = await db('societies').where({ id: societyId }).first();

    res.json({ society });
  } catch (err) {
    console.error('Update society error:', err);
    res.status(500).json({ error: 'Failed to update society' });
  }
});

// ── Join society ────────────────────────────────────────
router.post('/:id/join', authenticate, async (req, res) => {
  try {
    const societyId = parseInt(req.params.id, 10);
    const { code, flat_number } = req.body;

    const society = await db('societies').where({ id: societyId, status: 'active' }).first();
    if (!society) {
      return res.status(404).json({ error: 'Society not found or inactive' });
    }

    // Verify code if provided
    if (code && code.toUpperCase() !== society.code) {
      return res.status(400).json({ error: 'Invalid society code' });
    }

    // Check if already a member
    const existing = await db('society_members')
      .where({ user_id: req.user.id, society_id: societyId })
      .first();

    if (existing) {
      if (existing.status === 'approved') {
        return res.status(409).json({ error: 'You are already a member of this society' });
      }
      if (existing.status === 'pending') {
        return res.status(409).json({ error: 'Your membership request is pending approval' });
      }
      if (existing.status === 'rejected' || existing.status === 'disabled') {
        return res.status(403).json({ error: 'Your membership was rejected or disabled. Please contact the society admin.' });
      }
    }

    // Create membership (auto-approve if code matches, otherwise pending)
    const status = code ? 'approved' : 'pending';

    const [id] = await db('society_members').insert({
      user_id: req.user.id,
      society_id: societyId,
      flat_number: flat_number || null,
      role: 'resident',
      status,
      joined_at: status === 'approved' ? new Date().toISOString() : null,
    });

    // Create notification for admins if pending
    if (status === 'pending') {
      const admins = await db('society_members')
        .where({ society_id: societyId, role: 'admin', status: 'approved' })
        .select('user_id');

      for (const admin of admins) {
        await db('notifications').insert({
          user_id: admin.user_id,
          society_id: societyId,
          title: 'New Membership Request',
          message: `${req.user.name} has requested to join ${society.name}`,
          type: 'membership_request',
        });
      }
    }

    const membership = await db('society_members').where({ id }).first();
    res.status(201).json({
      membership,
      message: status === 'approved'
        ? 'Successfully joined the society'
        : 'Membership request submitted. Waiting for admin approval.',
    });
  } catch (err) {
    console.error('Join society error:', err);
    res.status(500).json({ error: 'Failed to join society' });
  }
});

module.exports = router;

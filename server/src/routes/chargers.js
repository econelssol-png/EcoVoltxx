/**
 * Charger Routes
 * 
 * All routes scoped under /api/societies/:societyId/chargers
 * 
 * GET    /                  — list chargers
 * GET    /:chargerId        — charger details
 * POST   /                  — add charger (admin)
 * PUT    /:chargerId        — update charger (admin)
 * DELETE /:chargerId        — deactivate charger (admin)
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { requireSocietyAdmin, requireSocietyMember } = require('../middleware/rbac');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

const router = express.Router({ mergeParams: true });

// ── List chargers ───────────────────────────────────────
router.get('/', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const chargers = await db('chargers')
      .where({ society_id: req.societyId })
      .orderBy('charger_number', 'asc');

    res.json({ chargers });
  } catch (err) {
    console.error('List chargers error:', err);
    res.status(500).json({ error: 'Failed to list chargers' });
  }
});

// ── Get charger details ─────────────────────────────────
router.get('/:chargerId', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const charger = await db('chargers')
      .where({ id: req.params.chargerId, society_id: req.societyId })
      .first();

    if (!charger) {
      return res.status(404).json({ error: 'Charger not found' });
    }

    // Get active session if any
    const activeSession = await db('charging_sessions')
      .where({ charger_id: charger.id, status: 'active' })
      .first();

    // Get today's bookings
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = await db('bookings')
      .where({ charger_id: charger.id, booking_date: today })
      .whereIn('status', ['upcoming', 'active'])
      .join('users', 'bookings.user_id', 'users.id')
      .select('bookings.*', 'users.name as user_name')
      .orderBy('start_time', 'asc');

    res.json({ charger, activeSession, todayBookings });
  } catch (err) {
    console.error('Get charger error:', err);
    res.status(500).json({ error: 'Failed to get charger details' });
  }
});

// ── Add charger (admin) ─────────────────────────────────
router.post('/', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const {
      charger_number, name, location_description, latitude, longitude,
      connector_type, power_rating_kw, price_per_kwh, manufacturer, serial_number
    } = req.body;

    if (!charger_number) {
      return res.status(400).json({ error: 'Charger number is required' });
    }

    // Check uniqueness within society
    const existing = await db('chargers')
      .where({ society_id: req.societyId, charger_number })
      .first();

    if (existing) {
      return res.status(409).json({ error: 'Charger number already exists in this society' });
    }

    const society = await db('societies').where({ id: req.societyId }).first();

    const [id] = await db('chargers').insert({
      society_id: req.societyId,
      charger_number,
      name: name || `Charger ${charger_number}`,
      location_description: location_description || null,
      latitude: latitude || null,
      longitude: longitude || null,
      connector_type: connector_type || 'Type2',
      power_rating_kw: power_rating_kw || 7.4,
      price_per_kwh: price_per_kwh || society.default_price_per_kwh || 8.0,
      manufacturer: manufacturer || null,
      serial_number: serial_number || null,
      is_simulated: true,
      status: 'available',
    });

    const charger = await db('chargers').where({ id }).first();
    res.status(201).json({ charger });
  } catch (err) {
    console.error('Add charger error:', err);
    res.status(500).json({ error: 'Failed to add charger' });
  }
});

// ── Update charger (admin) ──────────────────────────────
router.put('/:chargerId', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const charger = await db('chargers')
      .where({ id: req.params.chargerId, society_id: req.societyId })
      .first();

    if (!charger) {
      return res.status(404).json({ error: 'Charger not found' });
    }

    const allowedFields = [
      'charger_number', 'name', 'location_description', 'latitude', 'longitude',
      'connector_type', 'power_rating_kw', 'price_per_kwh', 'status',
      'manufacturer', 'serial_number'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    updates.updated_at = db.fn.now();

    await db('chargers').where({ id: charger.id }).update(updates);
    const updated = await db('chargers').where({ id: charger.id }).first();

    res.json({ charger: updated });
  } catch (err) {
    console.error('Update charger error:', err);
    res.status(500).json({ error: 'Failed to update charger' });
  }
});

// ── Deactivate charger (admin) ──────────────────────────
router.delete('/:chargerId', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const charger = await db('chargers')
      .where({ id: req.params.chargerId, society_id: req.societyId })
      .first();

    if (!charger) {
      return res.status(404).json({ error: 'Charger not found' });
    }

    // Don't delete if there's an active session
    const activeSession = await db('charging_sessions')
      .where({ charger_id: charger.id, status: 'active' })
      .first();

    if (activeSession) {
      return res.status(400).json({ error: 'Cannot remove charger with an active charging session' });
    }

    await db('chargers').where({ id: charger.id }).update({
      status: 'offline',
      updated_at: db.fn.now(),
    });

    res.json({ message: 'Charger deactivated' });
  } catch (err) {
    console.error('Delete charger error:', err);
    res.status(500).json({ error: 'Failed to deactivate charger' });
  }
});

module.exports = router;

/**
 * Profile Routes
 * 
 * GET  /api/profile            — get profile
 * PUT  /api/profile            — update profile
 * GET  /api/profile/vehicles   — get vehicles
 * POST /api/profile/vehicles   — add vehicle
 * PUT  /api/profile/vehicles/:id — update vehicle
 * DELETE /api/profile/vehicles/:id — remove vehicle
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Get profile ─────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'email', 'phone', 'name', 'role', 'avatar_url', 'created_at')
      .first();

    const memberships = await db('society_members')
      .join('societies', 'society_members.society_id', 'societies.id')
      .where({ 'society_members.user_id': req.user.id })
      .select(
        'societies.id as society_id',
        'societies.name as society_name',
        'societies.code as society_code',
        'society_members.role as member_role',
        'society_members.flat_number',
        'society_members.status'
      );

    const vehicles = await db('vehicles').where({ user_id: req.user.id });

    res.json({ user, memberships, vehicles });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ── Update profile ──────────────────────────────────────
router.put('/', authenticate, async (req, res) => {
  try {
    const allowedFields = ['name', 'phone', 'avatar_url'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    updates.updated_at = db.fn.now();

    await db('users').where({ id: req.user.id }).update(updates);
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'email', 'phone', 'name', 'role', 'avatar_url')
      .first();

    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── Get vehicles ────────────────────────────────────────
router.get('/vehicles', authenticate, async (req, res) => {
  try {
    const vehicles = await db('vehicles').where({ user_id: req.user.id });
    res.json({ vehicles });
  } catch (err) {
    console.error('Get vehicles error:', err);
    res.status(500).json({ error: 'Failed to get vehicles' });
  }
});

// ── Add vehicle ─────────────────────────────────────────
router.post('/vehicles', authenticate, async (req, res) => {
  try {
    const { make, model, year, registration_number, battery_capacity_kwh, connector_type, color } = req.body;

    if (!make || !model) {
      return res.status(400).json({ error: 'Vehicle make and model are required' });
    }

    const [id] = await db('vehicles').insert({
      user_id: req.user.id,
      make,
      model,
      year: year || null,
      registration_number: registration_number || null,
      battery_capacity_kwh: battery_capacity_kwh || null,
      connector_type: connector_type || null,
      color: color || null,
    });

    const vehicle = await db('vehicles').where({ id }).first();
    res.status(201).json({ vehicle });
  } catch (err) {
    console.error('Add vehicle error:', err);
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

// ── Update vehicle ──────────────────────────────────────
router.put('/vehicles/:id', authenticate, async (req, res) => {
  try {
    const vehicle = await db('vehicles')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const allowedFields = ['make', 'model', 'year', 'registration_number', 'battery_capacity_kwh', 'connector_type', 'color'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    updates.updated_at = db.fn.now();

    await db('vehicles').where({ id: vehicle.id }).update(updates);
    const updated = await db('vehicles').where({ id: vehicle.id }).first();

    res.json({ vehicle: updated });
  } catch (err) {
    console.error('Update vehicle error:', err);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// ── Remove vehicle ──────────────────────────────────────
router.delete('/vehicles/:id', authenticate, async (req, res) => {
  try {
    const deleted = await db('vehicles')
      .where({ id: req.params.id, user_id: req.user.id })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json({ message: 'Vehicle removed' });
  } catch (err) {
    console.error('Delete vehicle error:', err);
    res.status(500).json({ error: 'Failed to remove vehicle' });
  }
});

module.exports = router;

/**
 * Charging Session Routes
 * 
 * All routes scoped under /api/societies/:societyId/sessions
 * 
 * GET    /                   — list sessions
 * POST   /start              — start charging session
 * POST   /:sessionId/stop    — stop charging session
 * GET    /:sessionId         — session details
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');
const chargerSimulator = require('../services/chargerSimulator');

const router = express.Router({ mergeParams: true });

// ── List sessions ───────────────────────────────────────
router.get('/', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    let query = db('charging_sessions')
      .where({ 'charging_sessions.society_id': req.societyId })
      .join('users', 'charging_sessions.user_id', 'users.id')
      .join('chargers', 'charging_sessions.charger_id', 'chargers.id')
      .select(
        'charging_sessions.*',
        'users.name as user_name',
        'users.email as user_email',
        'chargers.charger_number',
        'chargers.location_description as charger_location'
      );

    // Non-admin users only see their own sessions
    if (req.user.role !== 'super_admin' && (!req.societyMember || req.societyMember.role !== 'admin')) {
      query = query.where({ 'charging_sessions.user_id': req.user.id });
    }

    // Filter by status
    if (req.query.status) {
      query = query.where({ 'charging_sessions.status': req.query.status });
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const sessions = await query
      .orderBy('charging_sessions.start_time', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({ sessions, page, limit });
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// ── Start charging ──────────────────────────────────────
router.post('/start', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const { charger_id, booking_id } = req.body;

    if (!charger_id) {
      return res.status(400).json({ error: 'Charger ID is required' });
    }

    // Validate charger belongs to this society
    const charger = await db('chargers')
      .where({ id: charger_id, society_id: req.societyId })
      .first();

    if (!charger) {
      return res.status(404).json({ error: 'Charger not found in this society' });
    }

    if (charger.status !== 'available') {
      return res.status(400).json({
        error: `Charger is currently ${charger.status}`,
      });
    }

    // Check if user already has an active session
    const existingSession = await db('charging_sessions')
      .where({ user_id: req.user.id, society_id: req.societyId, status: 'active' })
      .first();

    if (existingSession) {
      return res.status(400).json({
        error: 'You already have an active charging session',
        session: existingSession,
      });
    }

    // If booking_id provided, validate it
    if (booking_id) {
      const booking = await db('bookings')
        .where({ id: booking_id, user_id: req.user.id, charger_id, society_id: req.societyId })
        .first();

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Mark booking as active
      await db('bookings').where({ id: booking_id }).update({
        status: 'active',
        updated_at: db.fn.now(),
      });
    }

    // Create charging session
    const [id] = await db('charging_sessions').insert({
      user_id: req.user.id,
      society_id: req.societyId,
      charger_id,
      booking_id: booking_id || null,
      start_time: new Date().toISOString(),
      energy_kwh: 0,
      cost: 0,
      price_per_kwh_at_time: charger.price_per_kwh,
      power_rating_kw_at_time: charger.power_rating_kw,
      status: 'active',
      is_simulated: charger.is_simulated,
    });

    // Start simulated charging
    await chargerSimulator.startCharging(id);

    const session = await db('charging_sessions')
      .where({ 'charging_sessions.id': id })
      .join('chargers', 'charging_sessions.charger_id', 'chargers.id')
      .select('charging_sessions.*', 'chargers.charger_number')
      .first();

    // Create notification
    await db('notifications').insert({
      user_id: req.user.id,
      society_id: req.societyId,
      title: 'Charging Started',
      message: `Charging started on Charger ${charger.charger_number}. Rate: ₹${charger.price_per_kwh}/kWh`,
      type: 'charging_started',
    });

    res.status(201).json({ session });
  } catch (err) {
    console.error('Start charging error:', err);
    res.status(500).json({ error: 'Failed to start charging' });
  }
});

// ── Stop charging ───────────────────────────────────────
router.post('/:sessionId/stop', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const session = await db('charging_sessions')
      .where({ id: req.params.sessionId, society_id: req.societyId })
      .first();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only session owner or admin can stop
    if (session.user_id !== req.user.id &&
      req.user.role !== 'super_admin' &&
      (!req.societyMember || req.societyMember.role !== 'admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Stop simulated charging
    const finalSession = await chargerSimulator.stopCharging(session.id, req.body.reason || 'user_stopped');

    // Complete associated booking if any
    if (session.booking_id) {
      await db('bookings').where({ id: session.booking_id }).update({
        status: 'completed',
        updated_at: db.fn.now(),
      });
    }

    // Create notification
    const charger = await db('chargers').where({ id: session.charger_id }).first();
    await db('notifications').insert({
      user_id: session.user_id,
      society_id: req.societyId,
      title: 'Charging Completed',
      message: `Charging completed on Charger ${charger.charger_number}. Energy: ${parseFloat(finalSession.energy_kwh).toFixed(2)} kWh, Cost: ₹${parseFloat(finalSession.cost).toFixed(2)}`,
      type: 'charging_completed',
    });

    const result = await db('charging_sessions')
      .where({ 'charging_sessions.id': session.id })
      .join('chargers', 'charging_sessions.charger_id', 'chargers.id')
      .select('charging_sessions.*', 'chargers.charger_number')
      .first();

    res.json({ session: result });
  } catch (err) {
    console.error('Stop charging error:', err);
    res.status(500).json({ error: 'Failed to stop charging' });
  }
});

// ── Get session details ─────────────────────────────────
router.get('/:sessionId', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const session = await db('charging_sessions')
      .where({ 'charging_sessions.id': req.params.sessionId, 'charging_sessions.society_id': req.societyId })
      .join('users', 'charging_sessions.user_id', 'users.id')
      .join('chargers', 'charging_sessions.charger_id', 'chargers.id')
      .select(
        'charging_sessions.*',
        'users.name as user_name',
        'chargers.charger_number',
        'chargers.location_description as charger_location'
      )
      .first();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Non-admin can only view their own sessions
    if (session.user_id !== req.user.id &&
      req.user.role !== 'super_admin' &&
      (!req.societyMember || req.societyMember.role !== 'admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ session });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

module.exports = router;

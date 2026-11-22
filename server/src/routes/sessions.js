/**
 * Charging Session Routes
 * 
 * All routes scoped under /api/societies/:societyId/sessions
 * 
 * GET    /                   — list sessions (with payment status)
 * POST   /start              — start charging session (delegates to charger integration)
 * POST   /:sessionId/stop    — stop charging session (confirmed by hardware / simulator)
 * GET    /:sessionId         — session details (with invoice / payment info)
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');
const chargerIntegrationService = require('../services/chargerIntegrationService');

const router = express.Router({ mergeParams: true });

// ── List sessions ───────────────────────────────────────
router.get('/', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    let query = db('charging_sessions')
      .where({ 'charging_sessions.society_id': req.societyId })
      .join('users', 'charging_sessions.user_id', 'users.id')
      .join('chargers', 'charging_sessions.charger_id', 'chargers.id')
      .leftJoin('payments', function () {
        this.on('payments.session_id', '=', 'charging_sessions.id')
          .andOn('payments.status', '=', db.raw('?', ['success']));
      })
      .select(
        'charging_sessions.*',
        'users.name as user_name',
        'users.email as user_email',
        'chargers.charger_number',
        'chargers.location_description as charger_location',
        'chargers.integration_mode',
        'payments.id as payment_id',
        'payments.status as payment_status',
        'payments.transaction_reference as payment_reference'
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
    const limit = parseInt(req.query.limit, 10) || 50;
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

    // Check if user already has an active session
    const existingSession = await db('charging_sessions')
      .where({ user_id: req.user.id, society_id: req.societyId, status: 'active' })
      .first();

    if (existingSession) {
      return res.status(400).json({
        error: 'You already have an active charging session in progress',
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

      await db('bookings').where({ id: booking_id }).update({
        status: 'active',
        updated_at: db.fn.now(),
      });
    }

    // Dispatch through ChargerIntegrationService (handles both OCPP physical & DEMO simulation)
    const session = await chargerIntegrationService.startSession({
      chargerId: parseInt(charger_id, 10),
      societyId: req.societyId,
      userId: req.user.id,
      bookingId: booking_id ? parseInt(booking_id, 10) : null,
    });

    const charger = await db('chargers').where({ id: charger_id }).first();

    // Create notification
    await db('notifications').insert({
      user_id: req.user.id,
      society_id: req.societyId,
      title: 'Charging Started',
      message: `Charging started on Charger ${charger.charger_number}. Rate: ₹${charger.price_per_kwh}/kWh (${charger.integration_mode === 'DEMO' ? 'Simulated Telemetry' : 'Real Hardware'})`,
      type: 'charging_started',
    });

    res.status(201).json({ session });
  } catch (err) {
    console.error('Start charging error:', err.message);
    res.status(400).json({ error: err.message });
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

    // Stop through integration service (waits for physical charger or simulator confirmation)
    const finalSession = await chargerIntegrationService.stopSession({
      sessionId: session.id,
      societyId: req.societyId,
      userId: req.user.id,
      reason: req.body.reason || 'user_stopped',
    });

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
      message: `Charging completed on Charger ${charger.charger_number}. Energy: ${parseFloat(finalSession.energy_kwh).toFixed(2)} kWh, Bill: ₹${parseFloat(finalSession.cost).toFixed(2)}.`,
      type: 'charging_completed',
    });

    const result = await db('charging_sessions')
      .where({ 'charging_sessions.id': session.id })
      .join('chargers', 'charging_sessions.charger_id', 'chargers.id')
      .select('charging_sessions.*', 'chargers.charger_number', 'chargers.integration_mode')
      .first();

    res.json({ session: result });
  } catch (err) {
    console.error('Stop charging error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── Get session details ─────────────────────────────────
router.get('/:sessionId', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const session = await db('charging_sessions')
      .where({ 'charging_sessions.id': req.params.sessionId, 'charging_sessions.society_id': req.societyId })
      .join('users', 'charging_sessions.user_id', 'users.id')
      .join('chargers', 'charging_sessions.charger_id', 'chargers.id')
      .leftJoin('payments', function () {
        this.on('payments.session_id', '=', 'charging_sessions.id')
          .andOn('payments.status', '=', db.raw('?', ['success']));
      })
      .select(
        'charging_sessions.*',
        'users.name as user_name',
        'chargers.charger_number',
        'chargers.location_description as charger_location',
        'chargers.integration_mode',
        'payments.id as payment_id',
        'payments.status as payment_status',
        'payments.transaction_reference as payment_reference'
      )
      .first();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

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

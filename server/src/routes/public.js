/**
 * Public (visitor) charging API for EcoVoltX
 *
 * Visitors can find chargers and charge without an account.
 *
 * - Charger status is the live status: a hardware charger that is not
 *   connected shows as offline and cannot be started.
 * - Sessions start and stop through the same integration service residents
 *   use, so hardware chargers get real OCPP start/stop commands.
 * - Starting returns a secret stop_token. Reading or stopping that session
 *   requires it, so nobody can stop someone else's charging.
 * - Visitor accounts get random passwords: nobody can sign in as a visitor.
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/knex');
const chargerIntegrationService = require('../services/chargerIntegrationService');

const router = express.Router();

const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile number, 10 digits
const PLATE_RE = /^[A-Z0-9 -]{4,15}$/;

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/** Find the visitor session for session_id + stop_token, or null */
async function findGuestSession(sessionId, stopToken) {
  const id = parseInt(sessionId, 10);
  if (!id || !stopToken) return null;
  const session = await db('charging_sessions').where({ id }).first();
  if (!session || !session.guest_token || !safeEqual(session.guest_token, String(stopToken))) return null;
  return session;
}

function publicSession(session) {
  const { guest_token, ...rest } = session;
  return rest;
}

// ── GET all public chargers ──────────────────────────────
router.get('/chargers', async (req, res) => {
  try {
    const chargers = await db('chargers')
      .join('societies', 'chargers.society_id', 'societies.id')
      .select(
        'chargers.*',
        'societies.name as society_name',
        'societies.code as society_code',
        'societies.address as society_address',
        'societies.city as society_city',
        'societies.state as society_state'
      )
      .orderBy('chargers.charger_number', 'asc');

    // Never expose the charger's OCPP auth key; show the live status
    const publicChargers = chargers.map(({ auth_key, ...c }) => ({
      ...c,
      status: chargerIntegrationService.liveStatus(c),
      is_public: true,
      public_rate_per_kwh: c.price_per_kwh,
    }));

    res.json({
      count: publicChargers.length,
      available_count: publicChargers.filter((c) => c.status === 'available').length,
      chargers: publicChargers,
    });
  } catch (err) {
    console.error('Public chargers error:', err);
    res.status(500).json({ error: 'Failed to list public chargers' });
  }
});

// ── POST start a visitor charging session ────────────────
router.post('/charge/start', async (req, res) => {
  try {
    const chargerId = parseInt(req.body.charger_id, 10);
    const phone = String(req.body.phone || '').replace(/\D/g, '').slice(-10);
    const vehicle = String(req.body.vehicle_number || '').trim().toUpperCase();
    const driverName = String(req.body.driver_name || '').trim().slice(0, 60) || 'Visitor';

    if (!chargerId) return res.status(400).json({ error: 'Choose a charger' });
    if (!PHONE_RE.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
    if (!PLATE_RE.test(vehicle)) return res.status(400).json({ error: 'Enter your vehicle registration number' });

    const charger = await db('chargers').where({ id: chargerId }).first();
    if (!charger) return res.status(404).json({ error: 'Charger not found' });

    const status = chargerIntegrationService.liveStatus(charger);
    if (status !== 'available') {
      return res.status(409).json({ error: `Charger ${charger.charger_number} is ${status === 'offline' ? 'offline' : `currently ${status}`}` });
    }

    // Find or create the visitor account (random password: nobody signs in as a visitor)
    const guestEmail = `guest_${phone}@ecovoltx.public`;
    let user = await db('users').where({ email: guestEmail }).first();
    if (!user) {
      const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const [userId] = await db('users').insert({
        email: guestEmail,
        phone,
        name: `${driverName} (${vehicle})`,
        password_hash: unusableHash,
        role: 'user',
      });
      user = await db('users').where({ id: userId }).first();
    }

    const existingMembership = await db('society_members')
      .where({ user_id: user.id, society_id: charger.society_id })
      .first();
    if (!existingMembership) {
      await db('society_members').insert({
        user_id: user.id,
        society_id: charger.society_id,
        flat_number: 'Visitor',
        role: 'resident',
        status: 'approved',
      });
    }

    // Same path as residents: simulator for DEMO chargers, OCPP for hardware
    let session;
    try {
      session = await chargerIntegrationService.startSession({
        chargerId: charger.id,
        societyId: charger.society_id,
        userId: user.id,
      });
    } catch (err) {
      return res.status(409).json({ error: err.message.replace(/^PRODUCTION ERROR: /, '') });
    }

    const stopToken = crypto.randomBytes(24).toString('hex');
    await db('charging_sessions').where({ id: session.id }).update({ guest_token: stopToken });

    const { auth_key, ...publicCharger } = charger;
    res.status(201).json({
      message: 'Charging started',
      session: publicSession(session),
      stop_token: stopToken,
      charger: { ...publicCharger, status: 'charging' },
    });
  } catch (err) {
    console.error('Public charge start error:', err);
    res.status(500).json({ error: 'Could not start charging' });
  }
});

// ── GET live status of a visitor session (needs its stop_token) ──
router.get('/charge/status', async (req, res) => {
  try {
    const session = await findGuestSession(req.query.session_id, req.query.stop_token);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session: publicSession(session) });
  } catch (err) {
    console.error('Public charge status error:', err);
    res.status(500).json({ error: 'Could not load the session' });
  }
});

// ── POST stop a visitor session (needs its stop_token) ───
router.post('/charge/stop', async (req, res) => {
  try {
    const session = await findGuestSession(req.body.session_id, req.body.stop_token);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'active') return res.status(409).json({ error: 'This session has already ended' });

    let completed;
    try {
      completed = await chargerIntegrationService.stopSession({
        sessionId: session.id,
        societyId: session.society_id,
        userId: session.user_id,
        reason: 'Visitor stopped charging',
      });
    } catch (err) {
      return res.status(503).json({ error: err.message.replace(/^PRODUCTION ERROR: /, '') });
    }

    completed = await db('charging_sessions').where({ id: session.id }).first();
    res.json({
      message: 'Charging stopped',
      session: publicSession(completed),
      receipt: {
        energy_kwh: Number(completed.energy_kwh || 0),
        amount_due: Number(completed.cost || 0),
        rate: Number(completed.price_per_kwh_at_time || 0),
        payment_status: 'due',
      },
    });
  } catch (err) {
    console.error('Public charge stop error:', err);
    res.status(500).json({ error: 'Could not stop charging' });
  }
});

module.exports = router;

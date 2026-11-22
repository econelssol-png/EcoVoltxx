/**
 * 24/7 Open Public Charging API Routes for EcoVoltX
 * Powered by EcoNelssol
 * 
 * Allows anyone (visitors, guests, general public) to discover chargers,
 * check real-time availability, and start charging 24/7 without registration.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/knex');
const chargerSimulator = require('../services/chargerSimulator');

const router = express.Router();

// ── GET All 24/7 Public Chargers ─────────────────────────
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
      .orderBy('chargers.status', 'asc');

    // Add public metadata (never expose the charger's OCPP auth key)
    const publicChargers = chargers.map(({ auth_key, ...c }) => ({
      ...c,
      is_public: true,
      access_hours: '24/7 Open Access',
      public_rate_per_kwh: c.price_per_kwh,
    }));

    res.json({
      title: '24/7 Public Charging Network',
      powered_by: 'EcoNelssol',
      count: publicChargers.length,
      available_count: publicChargers.filter((c) => c.status === 'available').length,
      chargers: publicChargers,
    });
  } catch (err) {
    console.error('Public chargers error:', err);
    res.status(500).json({ error: 'Failed to list public chargers' });
  }
});

// ── POST Instant 24/7 Guest Charge Start ─────────────────
router.post('/charge/start', async (req, res) => {
  try {
    const { charger_id, phone = '9876543210', vehicle_number = 'KA-01-EV-1234', driver_name = 'Public Guest' } = req.body;

    if (!charger_id) {
      return res.status(400).json({ error: 'Charger ID is required' });
    }

    const charger = await db('chargers').where({ id: charger_id }).first();
    if (!charger) {
      return res.status(404).json({ error: 'Charger not found' });
    }

    if (charger.status !== 'available') {
      return res.status(409).json({ error: `Charger is currently ${charger.status}` });
    }

    // Find or create guest user
    const guestEmail = `guest_${phone.replace(/\D/g, '').slice(-10)}@ecovoltx.public`;
    let user = await db('users').where({ email: guestEmail }).first();

    if (!user) {
      const defaultHash = await bcrypt.hash('Guest@123', 10);
      const [userId] = await db('users').insert({
        email: guestEmail,
        phone,
        name: `${driver_name} (${vehicle_number})`,
        password_hash: defaultHash,
        role: 'user',
      });
      user = await db('users').where({ id: userId }).first();

      // Auto-assign as guest member to society
      await db('society_members').insert({
        user_id: user.id,
        society_id: charger.society_id,
        flat_number: '24/7 Guest',
        role: 'resident',
        status: 'approved',
      });
    }

    // Start session
    const startTime = new Date().toISOString();
    const [sessionId] = await db('charging_sessions').insert({
      user_id: user.id,
      charger_id: charger.id,
      society_id: charger.society_id,
      start_time: startTime,
      energy_kwh: 0,
      cost: 0,
      price_per_kwh_at_time: charger.price_per_kwh || 8.0,
      power_rating_kw_at_time: charger.power_rating_kw || 7.4,
      is_simulated: charger.is_simulated !== undefined ? charger.is_simulated : 1,
      status: 'active',
    });

    // Start simulated charging
    await chargerSimulator.startCharging(sessionId);

    const session = await db('charging_sessions').where({ id: sessionId }).first();
    const { auth_key, ...publicCharger } = charger;

    res.status(201).json({
      message: '24/7 Public Charging Started!',
      session,
      charger: { ...publicCharger, status: 'charging' },
      user: { name: user.name, phone },
    });
  } catch (err) {
    console.error('Public charge start error:', err);
    res.status(500).json({ error: 'Failed to start public charging: ' + (err.message || err) });
  }
});

// ── POST Instant 24/7 Guest Charge Stop ──────────────────
router.post('/charge/stop', async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await db('charging_sessions').where({ id: session_id }).first();
    if (!session || session.status !== 'active') {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Stop simulated charging
    await chargerSimulator.stopCharging(session.id, 'User stopped 24/7 session');

    const completed = await db('charging_sessions').where({ id: session.id }).first();
    const charger = await db('chargers').where({ id: completed.charger_id }).first();

    res.json({
      message: '24/7 Public Charging Completed!',
      session: completed,
      receipt: {
        energy_kwh: completed.energy_kwh,
        total_cost: completed.cost,
        rate: completed.price_per_kwh_at_time || charger?.price_per_kwh || 8.0,
        status: 'PAID (Mock Gateway)',
      },
    });
  } catch (err) {
    console.error('Public charge stop error:', err);
    res.status(500).json({ error: 'Failed to stop public charging: ' + (err.message || err) });
  }
});

module.exports = router;

/**
 * Booking Routes
 * 
 * All routes scoped under /api/societies/:societyId/bookings
 * 
 * GET    /              — list bookings
 * POST   /              — create booking
 * GET    /:bookingId    — booking details
 * DELETE /:bookingId    — cancel booking
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');
const config = require('../config');
const localTime = require('../utils/localTime');
const paymentService = require('../services/paymentService');

const router = express.Router({ mergeParams: true });

// ── List bookings ───────────────────────────────────────
router.get('/', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    let query = db('bookings')
      .where({ 'bookings.society_id': req.societyId })
      .join('users', 'bookings.user_id', 'users.id')
      .join('chargers', 'bookings.charger_id', 'chargers.id')
      .select(
        'bookings.*',
        'users.name as user_name',
        'users.email as user_email',
        'chargers.charger_number',
        'chargers.location_description as charger_location'
      );

    // Non-admin users can only see their own bookings
    if (req.user.role !== 'super_admin' && (!req.societyMember || req.societyMember.role !== 'admin')) {
      query = query.where({ 'bookings.user_id': req.user.id });
    }

    // Filter by status
    if (req.query.status) {
      query = query.where({ 'bookings.status': req.query.status });
    }

    // Filter by date
    if (req.query.date) {
      query = query.where({ 'bookings.booking_date': req.query.date });
    }

    const bookings = await query.orderBy('bookings.booking_date', 'desc')
      .orderBy('bookings.start_time', 'asc');

    res.json({ bookings });
  } catch (err) {
    console.error('List bookings error:', err);
    res.status(500).json({ error: 'Failed to list bookings' });
  }
});

// ── Create booking ──────────────────────────────────────
router.post('/', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const { charger_id, booking_date, start_time, end_time, notes } = req.body;

    if (!charger_id || !booking_date || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Charger ID, booking date, start time, and end time are required',
      });
    }

    // Validate charger belongs to this society
    const charger = await db('chargers')
      .where({ id: charger_id, society_id: req.societyId })
      .first();

    if (!charger) {
      return res.status(404).json({ error: 'Charger not found in this society' });
    }

    if (charger.status === 'maintenance' || charger.status === 'offline') {
      return res.status(400).json({ error: 'Charger is not available for booking' });
    }

    if (!localTime.DATE_RE.test(booking_date) || !localTime.TIME_RE.test(start_time) || !localTime.TIME_RE.test(end_time)) {
      return res.status(400).json({ error: 'Use a date like 2026-12-01 and times like 18:30' });
    }

    // Validate time range
    if (start_time >= end_time) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Dates and times are India time; the server clock is UTC
    const today = localTime.today();
    if (booking_date < today) {
      return res.status(400).json({ error: 'Cannot book for a past date' });
    }
    if (localTime.hasStarted(booking_date, start_time)) {
      return res.status(400).json({ error: 'That start time has already passed. Pick a later time' });
    }

    // Check max advance booking
    if (booking_date > localTime.addDays(today, config.maxAdvanceBookingDays)) {
      return res.status(400).json({
        error: `Cannot book more than ${config.maxAdvanceBookingDays} days in advance`,
      });
    }

    // ── Conflict detection: prevent double booking ──────
    const conflicts = await db('bookings')
      .where({ charger_id, booking_date })
      .whereIn('status', ['upcoming', 'active'])
      .where(function () {
        this.where(function () {
          this.where('start_time', '<', end_time)
            .andWhere('end_time', '>', start_time);
        });
      });

    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'Time slot conflicts with an existing booking',
        conflicts: conflicts.map((c) => ({
          id: c.id,
          start_time: c.start_time,
          end_time: c.end_time,
        })),
      });
    }

    const [id] = await db('bookings').insert({
      user_id: req.user.id,
      society_id: req.societyId,
      charger_id,
      booking_date,
      start_time,
      end_time,
      status: 'upcoming',
      notes: notes || null,
    });

    const booking = await db('bookings')
      .where({ 'bookings.id': id })
      .join('chargers', 'bookings.charger_id', 'chargers.id')
      .select('bookings.*', 'chargers.charger_number', 'chargers.location_description as charger_location')
      .first();

    // Create notification
    await db('notifications').insert({
      user_id: req.user.id,
      society_id: req.societyId,
      title: 'Booking Confirmed',
      message: `Your booking for Charger ${charger.charger_number} on ${booking_date} from ${start_time} to ${end_time} is confirmed.`,
      type: 'booking_confirmed',
    });

    res.status(201).json({ booking });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ── Get booking details ─────────────────────────────────
router.get('/:bookingId', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const booking = await db('bookings')
      .where({ 'bookings.id': req.params.bookingId, 'bookings.society_id': req.societyId })
      .join('users', 'bookings.user_id', 'users.id')
      .join('chargers', 'bookings.charger_id', 'chargers.id')
      .select(
        'bookings.*',
        'users.name as user_name',
        'chargers.charger_number',
        'chargers.location_description as charger_location'
      )
      .first();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Non-admin can only view their own bookings
    if (req.user.role !== 'super_admin' &&
      (!req.societyMember || req.societyMember.role !== 'admin') &&
      booking.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ booking });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Failed to get booking' });
  }
});

// ── Cancel booking ──────────────────────────────────────
router.delete('/:bookingId', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const booking = await db('bookings')
      .where({ id: req.params.bookingId, society_id: req.societyId })
      .first();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only the booking owner or admin can cancel
    if (booking.user_id !== req.user.id &&
      req.user.role !== 'super_admin' &&
      (!req.societyMember || req.societyMember.role !== 'admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled booking' });
    }

    const slotStarted = localTime.hasStarted(booking.booking_date, booking.start_time);

    await db('bookings').where({ id: booking.id }).update({
      status: 'cancelled',
      updated_at: db.fn.now(),
    });

    // Refund policy: a paid deposit is refunded in full if the booking is
    // cancelled before its slot starts, and kept once the slot has started
    let deposit = null;
    if (!slotStarted) {
      deposit = await paymentService.refundBookingDeposit(booking.id, 'Booking cancelled before the slot started');
    } else {
      const paid = await db('payments').where({ booking_id: booking.id, status: 'success' }).first();
      if (paid) deposit = { kept: true, amount: parseFloat(paid.amount) };
    }

    res.json({ message: 'Booking cancelled successfully', deposit });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;

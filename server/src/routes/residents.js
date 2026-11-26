/**
 * Resident Management Routes (Society Admin)
 * 
 * GET  /api/societies/:societyId/residents              — list residents
 * PUT  /api/societies/:societyId/residents/:userId       — update resident status
 * GET  /api/societies/:societyId/residents/:userId/history — resident charging history
 * GET  /api/societies/:societyId/analytics               — society analytics
 * GET  /api/societies/:societyId/complaints              — list complaints
 * PUT  /api/societies/:societyId/complaints/:id          — update complaint
 */

const express = require('express');
const db = require('../db/knex');
const chargerIntegrationService = require('../services/chargerIntegrationService');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');
const { requireSocietyAdmin } = require('../middleware/rbac');

const router = express.Router({ mergeParams: true });

// ── List residents ──────────────────────────────────────
router.get('/residents', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const residents = await db('society_members')
      .join('users', 'society_members.user_id', 'users.id')
      .where({ 'society_members.society_id': req.societyId })
      .select(
        'users.id as user_id',
        'users.name',
        'users.email',
        'users.phone',
        'society_members.id as membership_id',
        'society_members.flat_number',
        'society_members.role',
        'society_members.status',
        'society_members.joined_at',
        'society_members.created_at'
      )
      .orderBy('society_members.created_at', 'desc');

    res.json({ residents });
  } catch (err) {
    console.error('List residents error:', err);
    res.status(500).json({ error: 'Failed to list residents' });
  }
});

// ── Update resident status/role ─────────────────────────
router.put('/residents/:userId', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const { status, role, flat_number } = req.body;
    const userId = parseInt(req.params.userId, 10);

    const membership = await db('society_members')
      .where({ user_id: userId, society_id: req.societyId })
      .first();

    if (!membership) {
      return res.status(404).json({ error: 'Resident not found in this society' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (role) updates.role = role;
    if (flat_number !== undefined) updates.flat_number = flat_number;

    if (status === 'approved' && membership.status === 'pending') {
      updates.joined_at = new Date().toISOString();

      // Notify the user
      await db('notifications').insert({
        user_id: userId,
        society_id: req.societyId,
        title: 'Membership Approved',
        message: `Your membership to ${req.society.name} has been approved!`,
        type: 'membership_approved',
      });
    }

    if (status === 'rejected') {
      await db('notifications').insert({
        user_id: userId,
        society_id: req.societyId,
        title: 'Membership Rejected',
        message: `Your membership request to ${req.society.name} was rejected.`,
        type: 'membership_rejected',
      });
    }

    updates.updated_at = db.fn.now();
    await db('society_members').where({ id: membership.id }).update(updates);

    const updated = await db('society_members')
      .join('users', 'society_members.user_id', 'users.id')
      .where({ 'society_members.id': membership.id })
      .select(
        'users.id as user_id', 'users.name', 'users.email',
        'society_members.*'
      )
      .first();

    res.json({ resident: updated });
  } catch (err) {
    console.error('Update resident error:', err);
    res.status(500).json({ error: 'Failed to update resident' });
  }
});

// ── Resident charging history ───────────────────────────
router.get('/residents/:userId/history', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const sessions = await db('charging_sessions')
      .where({ user_id: req.params.userId, society_id: req.societyId })
      .join('chargers', 'charging_sessions.charger_id', 'chargers.id')
      .select('charging_sessions.*', 'chargers.charger_number')
      .orderBy('start_time', 'desc');

    const totalEnergy = sessions.reduce((sum, s) => sum + parseFloat(s.energy_kwh), 0);
    const totalCost = sessions.reduce((sum, s) => sum + parseFloat(s.cost), 0);

    res.json({
      sessions,
      summary: {
        total_sessions: sessions.length,
        total_energy_kwh: parseFloat(totalEnergy.toFixed(3)),
        total_cost: parseFloat(totalCost.toFixed(2)),
      },
    });
  } catch (err) {
    console.error('Get resident history error:', err);
    res.status(500).json({ error: 'Failed to get resident history' });
  }
});

// ── Society analytics ───────────────────────────────────
router.get('/analytics', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const societyId = req.societyId;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Today's stats
    const todaySessions = await db('charging_sessions')
      .where({ society_id: societyId })
      .where('start_time', '>=', todayStart)
      .select('*');

    const todayEnergy = todaySessions.reduce((sum, s) => sum + parseFloat(s.energy_kwh), 0);
    const todayRevenue = todaySessions.reduce((sum, s) => sum + parseFloat(s.cost), 0);

    // Monthly stats
    const monthlySessions = await db('charging_sessions')
      .where({ society_id: societyId })
      .where('start_time', '>=', monthStart)
      .select('*');

    const monthlyEnergy = monthlySessions.reduce((sum, s) => sum + parseFloat(s.energy_kwh), 0);
    const monthlyRevenue = monthlySessions.reduce((sum, s) => sum + parseFloat(s.cost), 0);

    // Charger-wise usage
    const chargerUsage = await db('charging_sessions')
      .where({ 'charging_sessions.society_id': societyId, 'charging_sessions.status': 'completed' })
      .where('start_time', '>=', monthStart)
      .join('chargers', 'charging_sessions.charger_id', 'chargers.id')
      .groupBy('chargers.id', 'chargers.charger_number')
      .select(
        'chargers.id as charger_id',
        'chargers.charger_number',
        db.raw('COUNT(*) as session_count'),
        db.raw('SUM(charging_sessions.energy_kwh) as total_energy'),
        db.raw('SUM(charging_sessions.cost) as total_revenue')
      );

    // Resident-wise usage
    const residentUsage = await db('charging_sessions')
      .where({ 'charging_sessions.society_id': societyId, 'charging_sessions.status': 'completed' })
      .where('start_time', '>=', monthStart)
      .join('users', 'charging_sessions.user_id', 'users.id')
      .leftJoin('society_members', function () {
        this.on('society_members.user_id', '=', 'charging_sessions.user_id')
          .andOn('society_members.society_id', '=', 'charging_sessions.society_id');
      })
      .groupBy('users.id', 'users.name', 'society_members.flat_number')
      .select(
        'users.id as user_id',
        'users.name',
        'society_members.flat_number',
        db.raw('COUNT(*) as session_count'),
        db.raw('SUM(charging_sessions.energy_kwh) as total_energy'),
        db.raw('SUM(charging_sessions.cost) as total_cost')
      );

    // Charger stats
    const totalChargers = await db('chargers').where({ society_id: societyId }).count('id as count').first();
    const availableChargers = { count: await chargerIntegrationService.countAvailable(societyId) };
    const activeSessions = await db('charging_sessions').where({ society_id: societyId, status: 'active' }).count('id as count').first();
    const totalMembers = await db('society_members').where({ society_id: societyId, status: 'approved' }).count('id as count').first();

    // Pending payments
    const pendingPayments = await db('invoices')
      .where({ society_id: societyId, status: 'pending' })
      .sum('total_amount as total')
      .first();

    res.json({
      overview: {
        total_chargers: totalChargers.count,
        available_chargers: availableChargers.count,
        active_sessions: activeSessions.count,
        total_members: totalMembers.count,
      },
      today: {
        sessions: todaySessions.length,
        energy_kwh: parseFloat(todayEnergy.toFixed(3)),
        revenue: parseFloat(todayRevenue.toFixed(2)),
      },
      monthly: {
        sessions: monthlySessions.length,
        energy_kwh: parseFloat(monthlyEnergy.toFixed(3)),
        revenue: parseFloat(monthlyRevenue.toFixed(2)),
      },
      charger_usage: chargerUsage,
      resident_usage: residentUsage,
      pending_payments: parseFloat(pendingPayments?.total || 0),
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ── List complaints ─────────────────────────────────────
router.get('/complaints', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    let query = db('complaints')
      .where({ 'complaints.society_id': req.societyId })
      .join('users', 'complaints.user_id', 'users.id')
      .leftJoin('chargers', 'complaints.charger_id', 'chargers.id')
      .select(
        'complaints.*',
        'users.name as user_name',
        'chargers.charger_number'
      );

    // Non-admin only sees their own
    if (req.user.role !== 'super_admin' && (!req.societyMember || req.societyMember.role !== 'admin')) {
      query = query.where({ 'complaints.user_id': req.user.id });
    }

    const complaints = await query.orderBy('complaints.created_at', 'desc');
    res.json({ complaints });
  } catch (err) {
    console.error('List complaints error:', err);
    res.status(500).json({ error: 'Failed to list complaints' });
  }
});

// ── Create complaint ────────────────────────────────────
router.post('/complaints', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const { charger_id, subject, description } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }

    // Validate charger belongs to society if provided
    if (charger_id) {
      const charger = await db('chargers')
        .where({ id: charger_id, society_id: req.societyId })
        .first();
      if (!charger) {
        return res.status(404).json({ error: 'Charger not found in this society' });
      }
    }

    const [id] = await db('complaints').insert({
      user_id: req.user.id,
      society_id: req.societyId,
      charger_id: charger_id || null,
      subject,
      description,
      status: 'open',
    });

    const complaint = await db('complaints').where({ id }).first();
    res.status(201).json({ complaint });
  } catch (err) {
    console.error('Create complaint error:', err);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
});

// ── Update complaint (admin) ────────────────────────────
router.put('/complaints/:id', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const complaint = await db('complaints')
      .where({ id: req.params.id, society_id: req.societyId })
      .first();

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const { status, admin_response } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (admin_response) updates.admin_response = admin_response;
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();
    updates.updated_at = db.fn.now();

    await db('complaints').where({ id: complaint.id }).update(updates);

    if (status === 'resolved' || admin_response) {
      await db('notifications').insert({
        user_id: complaint.user_id,
        society_id: req.societyId,
        title: 'Complaint Updated',
        message: admin_response || `Your complaint "${complaint.subject}" has been updated to: ${status}`,
        type: 'complaint_update',
      });
    }

    const updated = await db('complaints').where({ id: complaint.id }).first();
    res.json({ complaint: updated });
  } catch (err) {
    console.error('Update complaint error:', err);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

module.exports = router;

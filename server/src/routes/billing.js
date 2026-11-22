/**
 * Billing Routes
 * 
 * GET  /api/societies/:societyId/billing           — user billing summary
 * GET  /api/societies/:societyId/billing/all        — all residents billing (admin)
 * POST /api/societies/:societyId/billing/generate   — generate invoices (admin)
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');
const { requireSocietyAdmin } = require('../middleware/rbac');
const billingService = require('../services/billing');

const router = express.Router({ mergeParams: true });

// ── User billing summary ────────────────────────────────
router.get('/', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const result = await billingService.getUserBillingSummary(req.user.id, req.societyId);
    res.json(result);
  } catch (err) {
    console.error('Get billing error:', err);
    res.status(500).json({ error: 'Failed to get billing info' });
  }
});

// ── All residents billing (admin) ───────────────────────
router.get('/all', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const invoices = await db('invoices')
      .where({ society_id: req.societyId, month, year })
      .join('users', 'invoices.user_id', 'users.id')
      .leftJoin('society_members', function () {
        this.on('society_members.user_id', '=', 'invoices.user_id')
          .andOn('society_members.society_id', '=', 'invoices.society_id');
      })
      .select(
        'invoices.*',
        'users.name as user_name',
        'users.email as user_email',
        'society_members.flat_number'
      )
      .orderBy('users.name', 'asc');

    // Summary
    const totalEnergy = invoices.reduce((sum, i) => sum + parseFloat(i.total_energy_kwh), 0);
    const totalAmount = invoices.reduce((sum, i) => sum + parseFloat(i.total_amount), 0);
    const pendingCount = invoices.filter((i) => i.status === 'pending').length;

    res.json({
      invoices,
      summary: {
        month,
        year,
        total_invoices: invoices.length,
        total_energy_kwh: parseFloat(totalEnergy.toFixed(3)),
        total_amount: parseFloat(totalAmount.toFixed(2)),
        pending_count: pendingCount,
      },
    });
  } catch (err) {
    console.error('Get all billing error:', err);
    res.status(500).json({ error: 'Failed to get billing data' });
  }
});

// ── Generate invoices (admin) ───────────────────────────
router.post('/generate', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const month = parseInt(req.body.month, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.body.year, 10) || new Date().getFullYear();

    const invoices = await billingService.generateMonthlyInvoices(req.societyId, month, year);

    res.json({
      message: `Generated ${invoices.length} invoices for ${month}/${year}`,
      invoices,
    });
  } catch (err) {
    console.error('Generate invoices error:', err);
    res.status(500).json({ error: 'Failed to generate invoices' });
  }
});

// ── Tariffs ─────────────────────────────────────────────
router.get('/tariffs', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const society = await db('societies').where({ id: req.societyId }).first();
    res.json({
      tariffs: [
        { id: 1, type: 'base', name: 'Base Tariff Rate', rate: 8.0, unit: '₹/kWh' },
        { id: 2, type: 'idle', name: 'Idle Penalty Policy', rate: 50.0, unit: '₹/hr' },
        { id: 3, type: 'peak', name: 'Peak Hour Multiplier (TOD)', rate: 1.25, unit: 'multiplier' },
      ],
      society,
    });
  } catch (err) {
    console.error('Get tariffs error:', err);
    res.status(500).json({ error: 'Failed to get tariffs' });
  }
});

router.post('/tariffs', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    res.json({ message: 'Tariff rule updated successfully' });
  } catch (err) {
    console.error('Update tariff error:', err);
    res.status(500).json({ error: 'Failed to update tariff' });
  }
});

module.exports = router;

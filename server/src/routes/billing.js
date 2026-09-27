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

module.exports = router;

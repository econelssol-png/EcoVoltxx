/**
 * Payment Routes
 * 
 * Secure, audited payment gateway endpoints:
 * - GET  /api/payments/config            — get gateway client config
 * - POST /api/payments/create            — create payment order from trusted DB records
 * - POST /api/payments/verify            — backend signature verification
 * - POST /api/payments/webhook           — signed webhook handling (idempotent)
 * - GET  /api/payments                   — resident payment history
 * - GET  /api/payments/:paymentId        — payment & receipt details
 * - POST /api/payments/:paymentId/refund — issue refund (society admin)
 * - GET  /api/payments/society/:societyId — society financial transactions & totals
 * - POST /api/payments/mock/simulate     — simulated demo payment helper
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { requireSocietyAdmin } = require('../middleware/rbac');
const paymentService = require('../services/paymentService');

const router = express.Router();

function sendError(res, err) {
  res.status(err.status || 400).json({ error: err.message });
}

async function isSocietyAdmin(userId, societyId) {
  const member = await db('society_members')
    .where({ user_id: userId, society_id: societyId, role: 'admin', status: 'approved' })
    .first();
  return Boolean(member);
}

// ── 1. Gateway Client Configuration ───────────────────────
router.get('/config', authenticate, (req, res) => {
  try {
    const config = paymentService.getGatewayConfig();
    res.json({ config });
  } catch (err) {
    console.error('Payment config error:', err);
    res.status(500).json({ error: 'Failed to retrieve gateway config' });
  }
});

// ── 2. Create Payment Order (Trusted Server-Side Calculation) ──
router.post('/create', authenticate, async (req, res) => {
  try {
    const { invoice_id, session_id, booking_id, method, mode } = req.body;

    const result = await paymentService.createPaymentOrder({
      userId: req.user.id,
      societyId: req.body.society_id,
      invoiceId: invoice_id ? parseInt(invoice_id, 10) : null,
      sessionId: session_id ? parseInt(session_id, 10) : null,
      bookingId: booking_id ? parseInt(booking_id, 10) : null,
      method: method || 'UPI',
      requestedMode: mode || 'DEMO',
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Create payment error:', err.message);
    sendError(res, err);
  }
});

// ── 3. Verify Payment Signature (Backend Cryptographic Check) ──
// Rule 8: Never mark payment as successful based only on frontend callback!
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { payment_id, gateway_order_id, gateway_payment_id, gateway_signature } = req.body;

    const result = await paymentService.verifyPaymentSignature({
      paymentId: payment_id ? parseInt(payment_id, 10) : null,
      userId: req.user.id,
      gatewayOrderId: gateway_order_id,
      gatewayPaymentId: gateway_payment_id,
      gatewaySignature: gateway_signature,
    });

    res.json(result);
  } catch (err) {
    console.error('Verify payment error:', err.message);
    sendError(res, err);
  }
});

// ── 4. Webhook Endpoint (Signed & Idempotent) ──────────────
// Signature is checked against the exact raw request bytes captured by
// express.json() in index.js (re-serialized JSON would never match).
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] || '';

    const result = await paymentService.processWebhook({
      rawBody: req.rawBody,
      signature,
      eventData: req.body,
    });

    res.json(result);
  } catch (err) {
    console.error('Webhook error:', err.message);
    sendError(res, err);
  }
});

// ── 5. Resident Payment History ────────────────────────────
// Rule 14: Ensure users can access only their own payments
router.get('/', authenticate, async (req, res) => {
  try {
    const payments = await db('payments')
      .where({ 'payments.user_id': req.user.id })
      .leftJoin('invoices', 'payments.invoice_id', 'invoices.id')
      .leftJoin('charging_sessions', 'payments.session_id', 'charging_sessions.id')
      .leftJoin('bookings', 'payments.booking_id', 'bookings.id')
      .select(
        'payments.*',
        'invoices.month as invoice_month',
        'invoices.year as invoice_year',
        'charging_sessions.energy_kwh as session_energy_kwh',
        'bookings.booking_date',
        'bookings.start_time as booking_start_time'
      )
      .orderBy('payments.created_at', 'desc');

    res.json({ payments });
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ error: 'Failed to list payments' });
  }
});

// ── 6. Get Payment & Receipt Details ───────────────────────
router.get('/:paymentId', authenticate, async (req, res) => {
  try {
    const payment = await db('payments')
      .where({ 'payments.id': req.params.paymentId })
      .join('users', 'payments.user_id', 'users.id')
      .join('societies', 'payments.society_id', 'societies.id')
      .leftJoin('invoices', 'payments.invoice_id', 'invoices.id')
      .leftJoin('charging_sessions', 'payments.session_id', 'charging_sessions.id')
      .select(
        'payments.*',
        'users.name as user_name',
        'users.email as user_email',
        'users.phone as user_phone',
        'societies.name as society_name',
        'societies.address as society_address',
        'societies.city as society_city',
        'societies.state as society_state',
        'societies.pincode as society_pincode',
        'invoices.month as invoice_month',
        'invoices.year as invoice_year',
        'invoices.total_energy_kwh as invoice_energy',
        'charging_sessions.energy_kwh as session_energy'
      )
      .first();

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    // Enforce authorization
    const isOwner = payment.user_id === req.user.id;
    const isSuperAdmin = req.user.role === 'super_admin';

    if (!isOwner && !isSuperAdmin && !(await isSocietyAdmin(req.user.id, payment.society_id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ payment });
  } catch (err) {
    console.error('Get payment details error:', err);
    res.status(500).json({ error: 'Failed to retrieve payment details' });
  }
});

// ── 7. Process Refund (Society Admin Only) ─────────────────
router.post('/:paymentId/refund', authenticate, async (req, res) => {
  try {
    const payment = await db('payments').where({ id: req.params.paymentId }).first();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    // Society Admin or Super Admin check
    const isSuperAdmin = req.user.role === 'super_admin';

    if (!isSuperAdmin && !(await isSocietyAdmin(req.user.id, payment.society_id))) {
      return res.status(403).json({ error: 'Only authorized society administrators can process refunds' });
    }

    const { reason, amount } = req.body;
    const refundedPayment = await paymentService.processRefund({
      paymentId: payment.id,
      adminUserId: req.user.id,
      reason,
      amount,
    });

    res.json({ message: 'Refund processed successfully', payment: refundedPayment });
  } catch (err) {
    console.error('Refund error:', err.message);
    sendError(res, err);
  }
});

// ── 8. Society Financial Transactions (Society Admin Only) ──
// Rule 14: Authorized society admins can access their society's financial reports
// Rule 10: Prevent test transactions from being reported as real collections
router.get('/society/:societyId', authenticate, async (req, res) => {
  try {
    const societyId = parseInt(req.params.societyId, 10);

    const isSuperAdmin = req.user.role === 'super_admin';

    if (!isSuperAdmin && !(await isSocietyAdmin(req.user.id, societyId))) {
      return res.status(403).json({ error: 'Unauthorized to view society financial reports' });
    }

    const payments = await db('payments')
      .where({ 'payments.society_id': societyId })
      .join('users', 'payments.user_id', 'users.id')
      .leftJoin('society_members', function () {
        this.on('society_members.user_id', '=', 'payments.user_id')
          .andOn('society_members.society_id', '=', 'payments.society_id');
      })
      .select(
        'payments.*',
        'users.name as user_name',
        'users.email as user_email',
        'society_members.flat_number'
      )
      .orderBy('payments.created_at', 'desc');

    // Financial summaries: Separate Real vs Test collections!
    const realSuccessPayments = payments.filter((p) => !p.is_test && p.status === 'success');
    const testSuccessPayments = payments.filter((p) => p.is_test && p.status === 'success');
    const pendingPayments = payments.filter((p) => p.status === 'pending');
    const refundedPayments = payments.filter((p) => p.status === 'refunded');

    const totalRealCollections = realSuccessPayments.reduce((s, p) => s + parseFloat(p.amount), 0);
    const totalTestCollections = testSuccessPayments.reduce((s, p) => s + parseFloat(p.amount), 0);
    const totalRefunded = refundedPayments.reduce((s, p) => s + parseFloat(p.refund_amount || p.amount), 0);
    const totalPending = pendingPayments.reduce((s, p) => s + parseFloat(p.amount), 0);

    res.json({
      payments,
      summary: {
        total_real_collections: parseFloat(totalRealCollections.toFixed(2)),
        total_test_collections: parseFloat(totalTestCollections.toFixed(2)),
        total_refunded: parseFloat(totalRefunded.toFixed(2)),
        total_pending: parseFloat(totalPending.toFixed(2)),
        real_transaction_count: realSuccessPayments.length,
        test_transaction_count: testSuccessPayments.length,
        refund_count: refundedPayments.length,
        pending_count: pendingPayments.length,
      },
    });
  } catch (err) {
    console.error('Society payments error:', err);
    res.status(500).json({ error: 'Failed to retrieve society payments' });
  }
});

// ── 9. Simulated Demo Payment Helper ───────────────────────
// Only available while the server runs the mock provider, only for the
// caller's own mock-provider payments, and only while they are still pending.
router.post('/mock/simulate', authenticate, async (req, res) => {
  try {
    if (!paymentService.isMockModeActive()) {
      return res.status(403).json({ error: 'Payment simulation is disabled while a real payment gateway is active' });
    }

    const { payment_id, order_id, action, outcome } = req.body;
    const resolvedAction = String(
      action || (String(outcome || '').toUpperCase() === 'FAILURE' ? 'failure' : 'success')
    ).toLowerCase();

    if (!['success', 'failure'].includes(resolvedAction)) {
      return res.status(400).json({ error: "action must be 'success' or 'failure'" });
    }

    let query = db('payments').where({ user_id: req.user.id });
    if (payment_id) {
      query = query.where({ id: payment_id });
    } else if (order_id) {
      query = query.where(function () {
        this.where({ gateway_order_id: order_id }).orWhere({ order_reference: order_id });
      });
    } else {
      return res.status(400).json({ error: 'payment_id or order_id is required' });
    }

    const payment = await query.first();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.gateway_provider !== 'mock') {
      return res.status(400).json({ error: 'Only demo (mock provider) payments can be simulated' });
    }
    if (payment.status !== 'pending') {
      return res.status(409).json({ error: `Payment is already ${payment.status}` });
    }

    if (resolvedAction === 'success') {
      const mockPaymentId = `pay_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const signature = paymentService.generateMockSignature(payment.gateway_order_id, mockPaymentId);

      const verified = await paymentService.verifyPaymentSignature({
        paymentId: payment.id,
        userId: req.user.id,
        gatewayOrderId: payment.gateway_order_id,
        gatewayPaymentId: mockPaymentId,
        gatewaySignature: signature,
      });

      return res.json({
        success: true,
        mock_payment_id: mockPaymentId,
        signature,
        payment: verified.payment,
      });
    }

    // Simulate failure
    await db('payments').where({ id: payment.id, status: 'pending' }).update({
      status: 'failed',
      failure_reason: 'User cancelled mock payment or simulated bank decline',
      updated_at: db.fn.now(),
    });

    return res.json({
      success: false,
      status: 'failed',
      message: 'Payment simulation marked as failed',
    });
  } catch (err) {
    console.error('Mock simulation error:', err.message);
    sendError(res, err);
  }
});

module.exports = router;

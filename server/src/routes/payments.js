/**
 * Payment Routes
 * 
 * POST /api/payments/create   — create payment order
 * POST /api/payments/webhook  — payment gateway webhook
 * GET  /api/payments          — list user payments
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Create payment order ────────────────────────────────
router.post('/create', authenticate, async (req, res) => {
  try {
    const { invoice_id, amount, method } = req.body;

    if (!invoice_id || !amount) {
      return res.status(400).json({ error: 'Invoice ID and amount are required' });
    }

    // Validate invoice belongs to user
    const invoice = await db('invoices')
      .where({ id: invoice_id, user_id: req.user.id })
      .first();

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    // Create payment record (gateway integration placeholder)
    // In production, this would create a Razorpay order and return order_id
    const gatewayOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const [id] = await db('payments').insert({
      user_id: req.user.id,
      invoice_id,
      society_id: invoice.society_id,
      amount: parseFloat(amount),
      method: method || 'UPI',
      gateway_order_id: gatewayOrderId,
      status: 'pending',
    });

    const payment = await db('payments').where({ id }).first();

    res.status(201).json({
      payment,
      // In production, this would include the Razorpay order details
      gateway: {
        order_id: gatewayOrderId,
        amount: parseFloat(amount) * 100, // paise for Razorpay
        currency: 'INR',
        notes: {
          invoice_id: invoice.id,
          society_id: invoice.society_id,
        },
      },
    });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// ── Payment webhook ─────────────────────────────────────
// In production, this would verify Razorpay signature
router.post('/webhook', async (req, res) => {
  try {
    const { gateway_order_id, gateway_payment_id, gateway_signature, status } = req.body;

    if (!gateway_order_id) {
      return res.status(400).json({ error: 'Gateway order ID required' });
    }

    const payment = await db('payments')
      .where({ gateway_order_id })
      .first();

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // In production: verify gateway_signature with Razorpay
    // const isValid = razorpay.verifySignature(gateway_order_id, gateway_payment_id, gateway_signature);

    const newStatus = status === 'success' ? 'success' : 'failed';

    await db('payments').where({ id: payment.id }).update({
      gateway_payment_id: gateway_payment_id || null,
      gateway_signature: gateway_signature || null,
      status: newStatus,
      updated_at: db.fn.now(),
    });

    // If successful, mark invoice as paid
    if (newStatus === 'success' && payment.invoice_id) {
      await db('invoices').where({ id: payment.invoice_id }).update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: db.fn.now(),
      });

      // Notify user
      await db('notifications').insert({
        user_id: payment.user_id,
        society_id: payment.society_id,
        title: 'Payment Successful',
        message: `Payment of ₹${payment.amount} received successfully.`,
        type: 'payment_success',
      });
    }

    res.json({ status: newStatus });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── List user payments ──────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const payments = await db('payments')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc');

    res.json({ payments });
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ error: 'Failed to list payments' });
  }
});

module.exports = router;

/**
 * Payment Service & Gateway Adapter
 *
 * Supports:
 * - Razorpay Payment Gateway Adapter (Test & Production)
 * - Clearly Labeled Mock Payment Provider (Fallback & Demo Mode)
 * - Server-side trusted calculation from database invoices / sessions / bookings
 * - HMAC-SHA256 signature verification
 * - Signed idempotent webhook handling
 * - Isolation between test collections and real production collections
 * - Refund tracking and receipt generation
 *
 * The gateway (mock vs Razorpay) is decided ONLY by server configuration.
 * Clients can never pick the mock provider when a real gateway is configured.
 */

const crypto = require('crypto');
const db = require('../db/knex');
const config = require('../config');

// Configuration from environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const PAYMENT_MODE_ENV = (process.env.PAYMENT_MODE || '').trim().toLowerCase();

const MOCK_KEY_ID = 'rzp_mock_test_key_ecovolt';
const MOCK_KEY_SECRET = 'mock_secret_key_ecovolt_charge';

const PLATFORM_NAME = 'EcoVoltX EV Platform';
const PAYMENTS_OFF_MESSAGE =
  "Online payment isn't set up yet. Your bill stays due. Pay your society admin directly for now.";
const PAYABLE_STATUSES = ['pending', 'failed'];

/**
 * Error carrying an HTTP status for the route layer
 */
class PaymentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PaymentError';
    this.status = status;
  }
}

/**
 * Check whether real Razorpay credentials are configured
 */
function isRazorpayConfigured() {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

/**
 * Resolve the active payment mode from server configuration only.
 * - 'mock'          : demo provider, no real money. Only while DEMO_MODE is on
 *                     (default there when no Razorpay keys)
 * - 'test'          : Razorpay test keys (default when keys are present)
 * - 'live'          : Razorpay live keys (PAYMENT_MODE=live)
 * - 'misconfigured' : PAYMENT_MODE asks for Razorpay but keys are missing
 * - 'mismatch'      : PAYMENT_MODE says test but the key is a live key, or
 *                     the other way round. Online payment is off, so real
 *                     money is never recorded as a test payment
 * - 'unavailable'   : DEMO_MODE is off and no Razorpay keys are set. Online
 *                     payment is off and bills stay due, so nobody can mark a
 *                     real bill as paid with the demo provider
 *
 * Without PAYMENT_MODE, a Razorpay key picks the mode itself (rzp_live_ is
 * live, rzp_test_ is test).
 */
function resolvePaymentMode() {
  const configured = isRazorpayConfigured();
  const keyKind = razorpayKeyKind();
  if (PAYMENT_MODE_ENV === 'live' || PAYMENT_MODE_ENV === 'test') {
    if (!configured) return 'misconfigured';
    if (keyKind && keyKind !== PAYMENT_MODE_ENV) return 'mismatch';
    return PAYMENT_MODE_ENV;
  }
  if (PAYMENT_MODE_ENV === 'mock') return config.demoMode ? 'mock' : 'unavailable';
  if (configured) return keyKind || 'test';
  return config.demoMode ? 'mock' : 'unavailable';
}

/**
 * 'live' or 'test' from the Razorpay key prefix, or null for any other format
 */
function razorpayKeyKind() {
  if (RAZORPAY_KEY_ID.startsWith('rzp_live_')) return 'live';
  if (RAZORPAY_KEY_ID.startsWith('rzp_test_')) return 'test';
  return null;
}

/**
 * Why online payment is off, for the startup log (null when it works)
 */
function getPaymentSetupProblem() {
  const mode = resolvePaymentMode();
  if (mode === 'misconfigured') {
    return `PAYMENT_MODE is "${PAYMENT_MODE_ENV}" but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing. Online payment is off.`;
  }
  if (mode === 'mismatch') {
    const keyKind = razorpayKeyKind();
    return `PAYMENT_MODE is "${PAYMENT_MODE_ENV}" but RAZORPAY_KEY_ID is a ${keyKind} key (rzp_${keyKind}_). Online payment is off until they match: set PAYMENT_MODE to "${keyKind}", or use ${PAYMENT_MODE_ENV} keys.`;
  }
  if (mode === 'unavailable') {
    return PAYMENT_MODE_ENV === 'mock'
      ? 'PAYMENT_MODE=mock is ignored while DEMO_MODE is off. Online payment is off until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.'
      : 'Online payment is off until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.';
  }
  return null;
}

function isMockModeActive() {
  return resolvePaymentMode() === 'mock';
}

function razorpayAuthHeader() {
  return 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
}

function hmacHex(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Constant-time comparison of two strings
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Get active payment gateway config (public-safe)
 */
function getGatewayConfig() {
  const mode = resolvePaymentMode();
  const isMock = mode === 'mock';
  const isLive = mode === 'live';

  let description;
  if (isMock) description = 'Demo Mode: Mock Payment Provider (No real card/UPI charged)';
  else if (isLive) description = 'Production Mode: Razorpay Live Gateway';
  else if (mode === 'test') description = 'Test Mode: Razorpay Sandbox/Test';
  else description = PAYMENTS_OFF_MESSAGE;

  const available = mode === 'mock' || mode === 'test' || mode === 'live';

  return {
    provider: isMock ? 'mock' : (available ? 'razorpay' : null),
    mode: isLive ? 'production' : mode,
    is_test: !isLive,
    key_id: isMock ? MOCK_KEY_ID : (available ? RAZORPAY_KEY_ID : null),
    currency: 'INR',
    is_live: isLive,
    available,
    description,
    // Why online payment is off (for the admin portal); null when it works
    setup_problem: getPaymentSetupProblem(),
  };
}

/**
 * Create a trusted payment order
 * Calculates amount strictly from DB records (invoices, sessions, bookings)
 */
async function createPaymentOrder({ userId, societyId, invoiceId, sessionId, bookingId, method, requestedMode = 'DEMO' }) {
  let trustedAmount = 0;
  let itemDescription = '';
  let metadata = {};

  // 1. Resolve trusted amount from server-side database
  if (invoiceId) {
    const invoice = await db('invoices')
      .where({ id: invoiceId, user_id: userId })
      .first();

    if (!invoice) throw new PaymentError('Invoice not found or does not belong to user', 404);
    if (invoice.status === 'paid') throw new PaymentError('Invoice is already fully paid', 409);

    trustedAmount = parseFloat(invoice.total_amount);
    itemDescription = `EV Charging Invoice #${invoice.id} (${invoice.month}/${invoice.year})`;
    societyId = invoice.society_id;
    metadata = { invoice_id: invoice.id, month: invoice.month, year: invoice.year };
  } else if (sessionId) {
    const session = await db('charging_sessions')
      .where({ id: sessionId, user_id: userId })
      .first();

    if (!session) throw new PaymentError('Charging session not found or does not belong to user', 404);
    if (session.status === 'active') throw new PaymentError('Cannot pay for an ongoing session. Please stop charging first.');

    // Check if already paid
    const existingPaid = await db('payments')
      .where({ session_id: sessionId, status: 'success' })
      .first();
    if (existingPaid) throw new PaymentError('Charging session bill is already paid', 409);

    trustedAmount = parseFloat(session.cost);
    if (trustedAmount <= 0) trustedAmount = 10.0; // minimum fee if 0 kWh
    itemDescription = `Charging Session #${session.id} (${parseFloat(session.energy_kwh).toFixed(2)} kWh)`;
    societyId = session.society_id;
    metadata = { session_id: session.id, energy_kwh: session.energy_kwh, charger_id: session.charger_id };
  } else if (bookingId) {
    const booking = await db('bookings')
      .where({ id: bookingId, user_id: userId })
      .first();

    if (!booking) throw new PaymentError('Booking not found or does not belong to user', 404);
    if (booking.status === 'cancelled') throw new PaymentError('Cannot pay for a cancelled booking');

    const depositPaid = await db('payments')
      .where({ booking_id: bookingId, status: 'success' })
      .first();
    if (depositPaid) throw new PaymentError('The deposit for this booking is already paid', 409);

    // Slot reservation deposit / booking fee (fixed ₹50)
    trustedAmount = 50.0; // standard slot booking deposit
    itemDescription = `Slot Booking Deposit #${booking.id} (${booking.booking_date} ${booking.start_time})`;
    societyId = booking.society_id;
    metadata = { booking_id: booking.id, booking_date: booking.booking_date, charger_id: booking.charger_id };
  } else {
    throw new PaymentError('Must specify invoiceId, sessionId, or bookingId to initiate payment');
  }

  if (!Number.isFinite(trustedAmount) || trustedAmount <= 0) {
    throw new PaymentError('Calculated payment amount must be greater than zero');
  }

  // 2. Gateway selection comes from server configuration only.
  // The client's requested mode can never downgrade a real gateway to the mock provider.
  const mode = resolvePaymentMode();

  if (mode === 'misconfigured' || mode === 'mismatch' || mode === 'unavailable') {
    throw new PaymentError(PAYMENTS_OFF_MESSAGE, 503);
  }

  const isMock = mode === 'mock';
  if (requestedMode === 'PRODUCTION' && isMock) {
    throw new PaymentError(
      'PRODUCTION MODE SETUP ERROR: Razorpay live credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are missing in environment variables. Real payment processing is disabled. Please configure credentials or switch to Demo mode.',
      503
    );
  }

  const isTest = mode !== 'live';

  const orderReference = `ORD_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const transactionReference = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const amountPaise = Math.round(trustedAmount * 100);

  let gatewayOrderId = '';

  // 3. Gateway Adapter logic
  if (!isMock) {
    // Real Razorpay API Order Creation
    try {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': razorpayAuthHeader(),
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt: orderReference,
          notes: {
            userId: String(userId),
            societyId: String(societyId),
            invoiceId: invoiceId ? String(invoiceId) : '',
            sessionId: sessionId ? String(sessionId) : '',
            bookingId: bookingId ? String(bookingId) : '',
            isTest: String(isTest),
          },
        }),
      });

      const rzpData = await response.json();
      if (!response.ok || !rzpData.id) {
        throw new Error(rzpData.error?.description || 'Razorpay order creation failed');
      }
      gatewayOrderId = rzpData.id;
    } catch (err) {
      console.error('[RazorpayAdapter] Order creation error:', err.message);
      throw new PaymentError(`Razorpay order creation failed: ${err.message}`, 502);
    }
  } else {
    // Clearly labeled Mock Payment Provider Order
    gatewayOrderId = `order_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  // 4. Save Payment record in Database with 'pending' status
  const [paymentId] = await db('payments').insert({
    user_id: userId,
    society_id: societyId,
    invoice_id: invoiceId || null,
    session_id: sessionId || null,
    booking_id: bookingId || null,
    amount: trustedAmount,
    currency: 'INR',
    method: method || 'UPI',
    gateway_order_id: gatewayOrderId,
    order_reference: orderReference,
    transaction_reference: transactionReference,
    is_test: isTest,
    gateway_provider: isMock ? 'mock' : 'razorpay',
    status: 'pending',
    refund_status: 'none',
    refund_amount: 0,
    metadata: JSON.stringify(metadata),
  });

  const payment = await db('payments').where({ id: paymentId }).first();

  // Log in integration_logs
  await db('integration_logs').insert({
    society_id: societyId,
    type: 'payment_order_created',
    level: 'info',
    source: isMock ? 'mock_gateway' : 'razorpay_gateway',
    message: `Payment order ${orderReference} created for ₹${trustedAmount} (${isMock ? 'MOCK / DEMO' : (isTest ? 'RAZORPAY TEST' : 'LIVE')})`,
    details: JSON.stringify({ paymentId, orderReference, gatewayOrderId, isTest }),
  });

  return {
    payment: {
      id: payment.id,
      transaction_reference: payment.transaction_reference,
      order_reference: payment.order_reference,
      amount: trustedAmount,
      currency: 'INR',
      status: payment.status,
      is_test: isTest,
      provider: payment.gateway_provider,
      item_description: itemDescription,
    },
    gateway: {
      order_id: gatewayOrderId,
      amount_paise: amountPaise,
      currency: 'INR',
      key_id: isMock ? MOCK_KEY_ID : RAZORPAY_KEY_ID,
      provider: isMock ? 'mock' : 'razorpay',
      is_test: isTest,
      name: PLATFORM_NAME,
      description: itemDescription,
      prefill: {
        method: method || 'UPI',
      },
    },
  };
}

/**
 * Atomically move a payment from pending/failed to success and reconcile
 * the linked invoice/booking. Returns false if the payment was not payable
 * (e.g. already processed by a concurrent request, or refunded).
 */
async function markPaymentSuccess(payment, { gatewayPaymentId, gatewaySignature = null, method = null }) {
  const updates = {
    gateway_payment_id: gatewayPaymentId,
    status: 'success',
    failure_reason: null,
    updated_at: db.fn.now(),
  };
  if (gatewaySignature) updates.gateway_signature = gatewaySignature;
  if (method) updates.method = method;

  const changed = await db('payments')
    .where({ id: payment.id })
    .whereIn('status', PAYABLE_STATUSES)
    .update(updates);

  if (!changed) return false;

  // 1. If invoice payment: mark invoice as paid
  if (payment.invoice_id) {
    await db('invoices').where({ id: payment.invoice_id }).update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: db.fn.now(),
    });
  }

  // 2. If booking payment: touch booking
  let bookingCancelled = false;
  if (payment.booking_id) {
    await db('bookings').where({ id: payment.booking_id }).update({
      updated_at: db.fn.now(),
    });
    const booking = await db('bookings').where({ id: payment.booking_id }).first();
    bookingCancelled = booking?.status === 'cancelled';
  }

  // 3. Create resident notification
  await db('notifications').insert({
    user_id: payment.user_id,
    society_id: payment.society_id,
    title: 'Payment Successful',
    message: `Payment of ₹${payment.amount} (Ref: ${payment.transaction_reference}) received successfully. ${payment.is_test ? '[DEMO/TEST]' : ''}`,
    type: 'payment_success',
    metadata: JSON.stringify({
      payment_id: payment.id,
      transaction_reference: payment.transaction_reference,
      is_test: payment.is_test,
    }),
  });

  // 4. Log integration event
  await db('integration_logs').insert({
    society_id: payment.society_id,
    type: 'payment_verified',
    level: 'info',
    source: payment.gateway_provider,
    message: `Payment #${payment.id} verified successfully. Amount: ₹${payment.amount}`,
    details: JSON.stringify({
      transaction_reference: payment.transaction_reference,
      gateway_payment_id: gatewayPaymentId,
      is_test: payment.is_test,
    }),
  });

  // 5. A deposit that went through after its booking was cancelled (for
  // example the payment window was closed mid-payment) is refunded at once
  if (bookingCancelled) {
    await refundBookingDeposit(payment.booking_id, 'Deposit paid after the booking was cancelled');
  }

  return true;
}

/**
 * Refund every paid deposit of a booking in full. Used when a booking is
 * cancelled before its slot starts, and when a deposit arrives for a booking
 * that is already cancelled.
 *
 * Returns null when nothing was paid, { refunded, amount, status } on success,
 * or { failed, amount } when the gateway refused (an error is logged for the
 * admin to refund it from Payments).
 */
async function refundBookingDeposit(bookingId, reason) {
  const deposits = await db('payments').where({ booking_id: bookingId, status: 'success' });
  if (!deposits.length) return null;

  let refunded = 0;
  let failed = 0;
  let status = 'processed';
  for (const deposit of deposits) {
    try {
      const result = await processRefund({ paymentId: deposit.id, adminUserId: null, reason });
      refunded += parseFloat(result.refund_amount);
      if (result.refund_status !== 'processed') status = result.refund_status;
    } catch (err) {
      failed += parseFloat(deposit.amount);
      console.error(`[Payments] Automatic deposit refund failed for payment #${deposit.id}:`, err.message);
      await db('integration_logs').insert({
        society_id: deposit.society_id,
        type: 'payment_error',
        level: 'error',
        source: deposit.gateway_provider,
        message: `Automatic refund of the ₹${deposit.amount} deposit for booking #${bookingId} (payment #${deposit.id}) failed: ${err.message}. Refund it from Payments.`,
        details: JSON.stringify({ bookingId, paymentId: deposit.id, reason }),
      });
    }
  }

  if (failed) return { failed: true, amount: failed };
  return { refunded: true, amount: refunded, status };
}

/**
 * Verify payment signature on backend
 * Rule: NEVER mark a payment as successful based only on frontend callback.
 * The signature must be computed over THIS payment's stored gateway order id,
 * and only the payment's owner may verify it.
 */
async function verifyPaymentSignature({ paymentId, userId, gatewayOrderId, gatewayPaymentId, gatewaySignature }) {
  if (!gatewayOrderId || !gatewayPaymentId || !gatewaySignature) {
    throw new PaymentError('Order ID, Payment ID, and Signature are required for verification');
  }

  const payment = await db('payments')
    .where(paymentId ? { id: paymentId } : { gateway_order_id: gatewayOrderId })
    .first();

  // Hide other users' payments behind the same "not found" response
  if (!payment || (userId != null && payment.user_id !== userId)) {
    throw new PaymentError('Payment record not found', 404);
  }

  // The signed order must be the order stored for this payment
  if (payment.gateway_order_id !== gatewayOrderId) {
    throw new PaymentError('Order ID does not match this payment', 400);
  }

  // Idempotency
  if (payment.status === 'success') {
    return {
      success: true,
      already_processed: true,
      payment,
      message: 'Payment was already verified and processed successfully',
    };
  }

  if (!PAYABLE_STATUSES.includes(payment.status)) {
    throw new PaymentError(`Payment is ${payment.status} and cannot be verified`, 409);
  }

  let secret;
  if (payment.gateway_provider === 'mock') {
    if (!isMockModeActive()) {
      throw new PaymentError('Demo payments cannot be completed on this server', 400);
    }
    secret = MOCK_KEY_SECRET;
  } else {
    if (!isRazorpayConfigured()) {
      throw new PaymentError('Razorpay credentials are not configured on the server', 503);
    }
    secret = RAZORPAY_KEY_SECRET;
  }

  const expectedSignature = hmacHex(secret, `${payment.gateway_order_id}|${gatewayPaymentId}`);

  if (!safeEqual(expectedSignature, String(gatewaySignature))) {
    await db('payments').where({ id: payment.id, status: 'pending' }).update({
      status: 'failed',
      failure_reason: 'Cryptographic signature verification failed',
      updated_at: db.fn.now(),
    });

    await db('integration_logs').insert({
      society_id: payment.society_id,
      type: 'payment_error',
      level: 'error',
      source: payment.gateway_provider,
      message: `Signature verification FAILED for payment #${payment.id}`,
      details: JSON.stringify({ gatewayOrderId, gatewayPaymentId }),
    });

    throw new PaymentError('Payment verification failed: Invalid cryptographic signature', 400);
  }

  const changed = await markPaymentSuccess(payment, { gatewayPaymentId, gatewaySignature });
  const updatedPayment = await db('payments').where({ id: payment.id }).first();

  if (!changed) {
    if (updatedPayment.status === 'success') {
      return {
        success: true,
        already_processed: true,
        payment: updatedPayment,
        message: 'Payment was already verified and processed successfully',
      };
    }
    throw new PaymentError(`Payment is ${updatedPayment.status} and cannot be verified`, 409);
  }

  return {
    success: true,
    already_processed: false,
    payment: updatedPayment,
    message: 'Payment verified and recorded successfully',
  };
}

/**
 * Handle signed Razorpay Webhook with idempotency.
 * rawBody must be the exact bytes Razorpay sent (not re-serialized JSON).
 */
async function processWebhook({ rawBody, signature, eventData }) {
  // 1. Signature verification (always required)
  if (!RAZORPAY_WEBHOOK_SECRET) {
    throw new PaymentError('Webhooks are disabled: RAZORPAY_WEBHOOK_SECRET is not configured', 503);
  }
  if (!rawBody || !signature) {
    throw new PaymentError('Missing webhook body or signature', 400);
  }

  const expectedSignature = hmacHex(RAZORPAY_WEBHOOK_SECRET, rawBody);
  if (!safeEqual(expectedSignature, String(signature))) {
    throw new PaymentError('Invalid webhook signature', 401);
  }

  const event = eventData?.event;
  const payload = eventData?.payload || {};

  // Log incoming webhook event
  await db('integration_logs').insert({
    type: 'payment_webhook',
    level: 'info',
    source: 'razorpay_webhook',
    message: `Received webhook event: ${event}`,
    details: JSON.stringify({ event, id: eventData?.id }),
  });

  if (event === 'order.paid' || event === 'payment.captured') {
    const paymentEntity = payload.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const gatewayPaymentId = paymentEntity?.id;

    if (!orderId) return { received: true, ignored: true };

    const payment = await db('payments')
      .where({ gateway_order_id: orderId, gateway_provider: 'razorpay' })
      .first();
    if (!payment) {
      return { received: true, status: 'order_not_found' };
    }

    if (payment.status === 'success') {
      return { received: true, status: 'already_reconciled' };
    }

    // The captured amount must match the amount we charged for this record
    const expectedPaise = Math.round(parseFloat(payment.amount) * 100);
    if (paymentEntity.amount !== undefined && Number(paymentEntity.amount) !== expectedPaise) {
      await db('integration_logs').insert({
        society_id: payment.society_id,
        type: 'payment_error',
        level: 'error',
        source: 'razorpay_webhook',
        message: `Webhook amount mismatch for payment #${payment.id}: expected ${expectedPaise} paise, got ${paymentEntity.amount}`,
        details: JSON.stringify({ orderId, gatewayPaymentId }),
      });
      return { received: true, status: 'amount_mismatch' };
    }

    const changed = await markPaymentSuccess(payment, {
      gatewayPaymentId,
      method: paymentEntity.method || null,
    });

    return { received: true, status: changed ? 'payment_captured' : 'not_payable' };
  } else if (event === 'payment.failed') {
    const paymentEntity = payload.payment?.entity;
    const orderId = paymentEntity?.order_id;

    if (orderId) {
      await db('payments')
        .where({ gateway_order_id: orderId, gateway_provider: 'razorpay', status: 'pending' })
        .update({
          status: 'failed',
          failure_reason: paymentEntity.error_description || 'Payment failed at gateway',
          updated_at: db.fn.now(),
        });
    }

    return { received: true, status: 'payment_failed_recorded' };
  } else if (event === 'refund.processed') {
    const refundEntity = payload.refund?.entity;
    const gatewayPaymentId = refundEntity?.payment_id;

    if (gatewayPaymentId) {
      await db('payments')
        .where({ gateway_payment_id: gatewayPaymentId, gateway_provider: 'razorpay' })
        .update({
          status: 'refunded',
          refund_status: 'processed',
          refund_id: refundEntity.id,
          refund_amount: refundEntity.amount ? (refundEntity.amount / 100) : null,
          updated_at: db.fn.now(),
        });
    }

    return { received: true, status: 'refund_processed' };
  }

  return { received: true, unhandled: event };
}

/**
 * Process a refund for a payment (admin action).
 * Razorpay payments are refunded through the Razorpay API before the
 * database is updated; mock payments are refunded in the database only.
 */
async function processRefund({ paymentId, adminUserId, reason, amount }) {
  const payment = await db('payments').where({ id: paymentId }).first();
  if (!payment) throw new PaymentError('Payment not found', 404);
  if (payment.status !== 'success') {
    throw new PaymentError(`Cannot refund payment in '${payment.status}' state`, 409);
  }

  const paidAmount = parseFloat(payment.amount);
  let refundAmount = paidAmount;
  if (amount !== undefined && amount !== null && amount !== '') {
    refundAmount = parseFloat(amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      throw new PaymentError('Refund amount must be a number greater than zero');
    }
    refundAmount = Math.min(refundAmount, paidAmount);
  }
  refundAmount = Math.round(refundAmount * 100) / 100;
  const isFullRefund = refundAmount >= paidAmount;

  // Lock the payment so two admins cannot refund it at the same time
  const locked = await db('payments')
    .where({ id: payment.id, status: 'success' })
    .where((q) => q.where('refund_status', 'none').orWhereNull('refund_status'))
    .update({ refund_status: 'requested', updated_at: db.fn.now() });

  if (!locked) {
    throw new PaymentError('A refund has already been issued or is in progress for this payment', 409);
  }

  let refundId;
  let refundStatus = 'processed';

  try {
    if (payment.gateway_provider === 'razorpay') {
      if (!isRazorpayConfigured()) {
        throw new PaymentError('Razorpay credentials are not configured; cannot refund a gateway payment', 503);
      }
      if (!payment.gateway_payment_id) {
        throw new PaymentError('Payment has no gateway payment id to refund', 400);
      }

      const response = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.gateway_payment_id)}/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': razorpayAuthHeader(),
          },
          body: JSON.stringify({
            amount: Math.round(refundAmount * 100),
            notes: {
              reason: String(reason || 'Administrator refund').slice(0, 250),
              transaction_reference: payment.transaction_reference,
            },
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.id) {
        throw new PaymentError(`Razorpay refund failed: ${data.error?.description || `HTTP ${response.status}`}`, 502);
      }
      refundId = data.id;
      refundStatus = data.status === 'processed' ? 'processed' : 'requested';
    } else {
      refundId = `ref_mock_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    }
  } catch (err) {
    // Release the lock so the refund can be retried
    await db('payments').where({ id: payment.id }).update({ refund_status: 'none', updated_at: db.fn.now() });
    throw err;
  }

  await db('payments').where({ id: payment.id }).update({
    status: 'refunded',
    refund_status: refundStatus,
    refund_amount: refundAmount,
    refund_id: refundId,
    updated_at: db.fn.now(),
  });

  // A full refund of an invoice payment re-opens the invoice
  if (payment.invoice_id && isFullRefund) {
    await db('invoices').where({ id: payment.invoice_id }).update({
      status: 'pending',
      paid_at: null,
      updated_at: db.fn.now(),
    });
  }

  // Notify resident
  await db('notifications').insert({
    user_id: payment.user_id,
    society_id: payment.society_id,
    title: 'Refund Processed',
    message: `A refund of ₹${refundAmount} for transaction ${payment.transaction_reference} has been ${refundStatus === 'processed' ? 'processed' : 'initiated'}. Reason: ${reason || 'Administrator refund'}.`,
    type: 'payment_refund',
  });

  // Log in integration logs
  await db('integration_logs').insert({
    society_id: payment.society_id,
    type: 'payment_refund',
    level: 'warn',
    source: payment.gateway_provider,
    message: `Refund of ₹${refundAmount} ${refundStatus} for payment #${payment.id} ${adminUserId ? `by admin #${adminUserId}` : 'automatically'}`,
    details: JSON.stringify({ paymentId, refundId, refundAmount, refundStatus, reason }),
  });

  return await db('payments').where({ id: payment.id }).first();
}

/**
 * Generate a mock signature helper for tests and demo checkout
 */
function generateMockSignature(gatewayOrderId, gatewayPaymentId) {
  return hmacHex(MOCK_KEY_SECRET, `${gatewayOrderId}|${gatewayPaymentId}`);
}

module.exports = {
  PaymentError,
  isRazorpayConfigured,
  isMockModeActive,
  getPaymentSetupProblem,
  getGatewayConfig,
  createPaymentOrder,
  verifyPaymentSignature,
  processWebhook,
  processRefund,
  refundBookingDeposit,
  generateMockSignature,
};

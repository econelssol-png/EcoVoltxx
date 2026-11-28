import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Receipt,
  ShieldCheck,
  Zap,
  Loader2,
  X
} from 'lucide-react';

const RAZORPAY_CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Load Razorpay's checkout.js on demand (only needed when the server uses Razorpay)
 */
function loadRazorpayCheckout() {
  if (typeof window.Razorpay === 'function') return Promise.resolve();

  return new Promise((resolve, reject) => {
    document.querySelectorAll('script[data-razorpay-checkout]').forEach((s) => s.remove());
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_URL;
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => {
      if (typeof window.Razorpay === 'function') resolve();
      else reject(new Error('Razorpay checkout failed to initialise. Please retry.'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Could not load Razorpay checkout. Check your connection and retry.'));
    };
    document.body.appendChild(script);
  });
}

/**
 * Universal Payment Modal for Resident App
 * Supports:
 * - Invoices, Charging Sessions, and Booking Deposits
 * - Test/Demo Mock Gateway & Production Razorpay
 * - Strict backend signature verification (Rule 8)
 * - Success, Failure, Pending, and Retry states (Rule 3)
 */
export default function PaymentModal({
  isOpen,
  onClose,
  paymentTarget, // { type: 'invoice' | 'session' | 'booking', id, amount, title, societyId }
  onPaymentSuccess,
}) {
  const [step, setStep] = useState('checkout'); // 'checkout' | 'pending' | 'success' | 'failure'
  const [method, setMethod] = useState('UPI');
  const [loading, setLoading] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('checkout');
      setPaymentResult(null);
      setErrorMessage('');
      // Load gateway config
      api.getPaymentConfig()
        .then(res => setGatewayConfig(res.config))
        .catch(err => console.error('Failed to load gateway config:', err));
    }
  }, [isOpen]);

  if (!isOpen || !paymentTarget) return null;

  // The server has no payment gateway set up (no Razorpay keys, demo mode off)
  const paymentsOff = gatewayConfig?.available === false;

  const handleInitiatePayment = async () => {
    setLoading(true);
    setErrorMessage('');
    setStep('pending');

    try {
      // 1. Create order on backend (amount calculated from trusted DB record)
      const orderPayload = {
        society_id: paymentTarget.societyId,
        method,
        mode: gatewayConfig?.is_live ? 'PRODUCTION' : 'DEMO',
      };

      if (paymentTarget.type === 'invoice') orderPayload.invoice_id = paymentTarget.id;
      else if (paymentTarget.type === 'session') orderPayload.session_id = paymentTarget.id;
      else if (paymentTarget.type === 'booking') orderPayload.booking_id = paymentTarget.id;

      const orderData = await api.createPayment(orderPayload);
      const { payment, gateway } = orderData;

      // 2. Gateway execution (the server decides the provider)
      if (gateway.provider === 'mock') {
        // Mock Payment Provider (Demo Mode)
        // Automatically simulate verification with backend
        setTimeout(async () => {
          try {
            const simRes = await api.simulateMockPayment({
              payment_id: payment.id,
              action: 'success',
            });

            if (simRes.success) {
              setPaymentResult(simRes.payment);
              setStep('success');
              if (onPaymentSuccess) onPaymentSuccess(simRes.payment);
            } else {
              setErrorMessage(simRes.message || 'Payment simulation failed');
              setStep('failure');
            }
          } catch (verErr) {
            setErrorMessage(verErr.message || 'Signature verification failed');
            setStep('failure');
          } finally {
            setLoading(false);
          }
        }, 400);
      } else {
        // Real Razorpay Gateway (test or live keys)
        await loadRazorpayCheckout();

        const options = {
          key: gateway.key_id,
          amount: gateway.amount_paise,
          currency: gateway.currency,
          name: gateway.name,
          description: gateway.description,
          order_id: gateway.order_id,
          handler: async function (response) {
            try {
              // Rule 8: NEVER mark success based only on frontend callback. Verify with backend!
              const verifyRes = await api.verifyPayment({
                payment_id: payment.id,
                gateway_order_id: response.razorpay_order_id,
                gateway_payment_id: response.razorpay_payment_id,
                gateway_signature: response.razorpay_signature,
              });

              if (verifyRes.success) {
                setPaymentResult(verifyRes.payment);
                setStep('success');
                if (onPaymentSuccess) onPaymentSuccess(verifyRes.payment);
              } else {
                setErrorMessage('Payment verification rejected by server');
                setStep('failure');
              }
            } catch (vErr) {
              setErrorMessage(vErr.message);
              setStep('failure');
            } finally {
              setLoading(false);
            }
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
              setErrorMessage('Payment cancelled by user');
              setStep('failure');
            },
          },
          prefill: {
            method,
          },
          theme: {
            color: '#00A651',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to initialize payment');
      setStep('failure');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="modal-content" style={{
        background: '#131e18',
        borderRadius: '16px',
        border: '1px solid #1f3325',
        width: '100%',
        maxWidth: '440px',
        padding: '1.5rem',
        color: 'var(--text-primary)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(0, 166, 81, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00A651',
            }}>
              <CreditCard size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Pay</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* STEP 1: Checkout */}
        {step === 'checkout' && (
          <div>
            {/* Mode Banner */}
            {paymentsOff ? (
              <div role="status" style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'rgba(237, 237, 237, 0.04)',
                border: '1px solid var(--border-color)',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
              }}>
                <strong style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.25rem' }}>
                  Online payment isn't set up yet
                </strong>
                Your bill stays due. Pay your society admin directly for now, or come back here once online payment is switched on.
              </div>
            ) : (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: gatewayConfig?.is_live ? 'rgba(0, 166, 81, 0.1)' : 'rgba(234, 179, 8, 0.12)',
              border: `1px solid ${gatewayConfig?.is_live ? '#00A651' : 'rgba(234, 179, 8, 0.4)'}`,
              marginBottom: '1.25rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              {gatewayConfig?.is_live ? (
                <>
                  <ShieldCheck size={16} color="#00A651" />
                  <span style={{ color: '#00A651', fontWeight: 600 }}>
                    PRODUCTION MODE — Razorpay Live Gateway Active
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} color="#eab308" />
                  <span style={{ color: '#fef08a' }}>
                    <strong>DEMO / TEST MODE:</strong> {gatewayConfig?.provider === 'razorpay' ? 'Razorpay test gateway' : 'Demo gateway'} (No real bank charge)
                  </span>
                </>
              )}
            </div>
            )}

            {/* Item Card */}
            <div style={{
              background: '#0d1510',
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid #1a2a1f',
              marginBottom: '1.25rem',
            }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Item Payable
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                {paymentTarget.title || 'EV Charging Services'}
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderTop: '1px dashed #233728',
                paddingTop: '0.75rem',
              }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{paymentsOff ? 'Amount due' : 'Total'}</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 500, color: '#00A651' }}>
                  ₹{parseFloat(paymentTarget.amount).toFixed(2)}
                </span>
              </div>
            </div>

            {paymentsOff ? (
              <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
                Close
              </button>
            ) : (
            <>
            {/* Payment Method Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Select Payment Method
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {['UPI', 'Card', 'Netbanking'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      border: method === m ? '2px solid #00A651' : '1px solid #233728',
                      background: method === m ? 'rgba(0, 166, 81, 0.15)' : '#0d1510',
                      color: method === m ? '#00A651' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleInitiatePayment}
                disabled={loading}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Zap size={16} /> Pay ₹{parseFloat(paymentTarget.amount).toFixed(2)}
              </button>
            </div>
            <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-muted)', textAlign: 'center' }}>
              By paying you agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>terms</a>
              {' '}and the{' '}
              <a href="/refunds" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>refund policy</a>
            </p>
            </>
            )}
          </div>
        )}

        {/* STEP 2: Pending / Verifying */}
        {step === 'pending' && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ display: 'inline-block', marginBottom: '1rem' }}>
              <div className="spinner" style={{ width: '42px', height: '42px', borderWidth: '3px' }} />
            </div>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Processing & Verifying Payment...
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Performing trusted server-side HMAC signature verification. Please do not close this window.
            </p>
          </div>
        )}

        {/* STEP 3: Payment Success */}
        {step === 'success' && paymentResult && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(0, 166, 81, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: '#00A651',
            }}>
              <CheckCircle size={36} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Payment received
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Your transaction has been securely verified and recorded.
            </p>

            {/* Details Box */}
            <div style={{
              background: '#0d1510',
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid #1a2a1f',
              textAlign: 'left',
              fontSize: '0.82rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Reference</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{paymentResult.transaction_reference}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Amount paid</span>
                <span style={{ fontWeight: 500, color: '#00A651' }}>₹{parseFloat(paymentResult.amount).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Method</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{paymentResult.method || method}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Mode:</span>
                <span style={{
                  color: paymentResult.is_test ? '#eab308' : '#00A651',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}>
                  {paymentResult.is_test ? 'TEST / DEMO MODE' : 'VERIFIED PRODUCTION'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={onClose}
            >
              Done & Close
            </button>
          </div>
        )}

        {/* STEP 4: Payment Failure */}
        {step === 'failure' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: 'var(--red)',
            }}>
              <XCircle size={36} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Payment Incomplete
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--red)', marginBottom: '1.25rem', padding: '0 0.5rem' }}>
              {errorMessage || 'The payment could not be completed.'}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep('checkout')}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <RotateCcw size={16} /> Retry Payment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

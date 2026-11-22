const WebSocket = require('ws');
const http = require('http');

async function runTests() {
  console.log('=== STARTING E2E INTEGRATION TESTS: PAYMENTS & OCPP 1.6-J ===');
  let token = '';
  let adminToken = '';
  let societyId = '';
  let testInvoiceId = '';
  let paymentId = '';

  // 1. Authenticate Resident
  console.log('\n[1] Testing Resident Authentication...');
  const residentLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rahul@test.com', password: 'password123' }),
  });
  const residentLoginData = await residentLoginRes.json();
  if (!residentLoginRes.ok || !residentLoginData.accessToken) {
    throw new Error(`Resident login failed: ${JSON.stringify(residentLoginData)}`);
  }
  token = residentLoginData.accessToken;
  societyId = residentLoginData.memberships?.[0]?.society_id || 1;
  console.log(`✓ Resident logged in: ${residentLoginData.user.name} (Society: ${societyId})`);

  // 2. Authenticate Admin
  console.log('\n[2] Testing Admin Authentication...');
  const adminLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin_gvr@test.com', password: 'password123' }),
  });
  const adminLoginData = await adminLoginRes.json();
  if (!adminLoginRes.ok || !adminLoginData.accessToken) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
  }
  adminToken = adminLoginData.accessToken;
  console.log(`✓ Admin logged in: ${adminLoginData.user.name}`);

  // 3. Test Payment Config API
  console.log('\n[3] Testing Payment Config API...');
  const configRes = await fetch('http://localhost:3000/api/payments/config', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const configData = await configRes.json();
  const cfg = configData.config || {};
  console.log(`✓ Payment config retrieved: provider=${cfg.provider}, isTestMode=${cfg.isTestMode}`);

  // 4. Admin Generates Invoices & Resident Fetches Them
  console.log('\n[4] Generating Billing Invoices & Testing Order Creation...');
  const genRes = await fetch(`http://localhost:3000/api/societies/${societyId}/billing/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({}),
  });
  const genData = await genRes.json();
  console.log(`✓ Invoice generation response: ${genData.message || JSON.stringify(genData)}`);

  const billRes = await fetch(`http://localhost:3000/api/societies/${societyId}/billing`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const billData = await billRes.json();
  const invoices = billData.invoices || [];
  console.log(`✓ Resident has ${invoices.length} invoices`);
  
  if (invoices.length === 0) {
    throw new Error('No invoices found after generation');
  }
  const pendingInv = invoices.find((inv) => inv.status !== 'paid');
  if (!pendingInv) {
    throw new Error('No unpaid invoice available for the payment test (run `npm run db:reset` in server/ for fresh data)');
  }
  testInvoiceId = pendingInv.id;
  console.log(`Selected invoice ID: ${testInvoiceId}, amount: ₹${pendingInv.amount || pendingInv.total_amount}`);

  async function createInvoiceOrder() {
    const res = await fetch('http://localhost:3000/api/payments/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        invoice_id: testInvoiceId,
        society_id: societyId,
      }),
    });
    const data = await res.json();
    const orderId = data.gateway?.order_id || data.payment?.order_reference;
    if (!res.ok || !orderId) {
      throw new Error(`Order creation failed: ${JSON.stringify(data)}`);
    }
    return data;
  }

  // 4b. Security checks on a throwaway order
  console.log('\n[4b] Testing payment security rules...');
  const probeOrder = await createInvoiceOrder();

  const foreignSimRes = await fetch('http://localhost:3000/api/payments/mock/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ payment_id: probeOrder.payment.id, action: 'success' }),
  });
  if (foreignSimRes.status !== 404) {
    throw new Error(`Another user could simulate this payment (HTTP ${foreignSimRes.status})`);
  }
  console.log('✓ Other users cannot complete a resident\'s payment via /mock/simulate');

  const foreignVerifyRes = await fetch('http://localhost:3000/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      payment_id: probeOrder.payment.id,
      gateway_order_id: probeOrder.gateway.order_id,
      gateway_payment_id: 'pay_forged',
      gateway_signature: 'a'.repeat(64),
    }),
  });
  if (foreignVerifyRes.status !== 404) {
    throw new Error(`Another user could verify this payment (HTTP ${foreignVerifyRes.status})`);
  }
  console.log('✓ Other users cannot verify a resident\'s payment');

  const forgedVerifyRes = await fetch('http://localhost:3000/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      payment_id: probeOrder.payment.id,
      gateway_order_id: probeOrder.gateway.order_id,
      gateway_payment_id: 'pay_forged',
      gateway_signature: 'a'.repeat(64),
    }),
  });
  if (forgedVerifyRes.ok) {
    throw new Error('A forged 64-character signature was accepted');
  }
  console.log(`✓ Forged signature rejected (HTTP ${forgedVerifyRes.status})`);

  const webhookRes = await fetch('http://localhost:3000/api/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_forged', order_id: probeOrder.gateway.order_id } } },
    }),
  });
  if (webhookRes.ok) {
    throw new Error('Unsigned webhook was accepted');
  }
  console.log(`✓ Unsigned webhook rejected (HTTP ${webhookRes.status})`);

  const orderData = await createInvoiceOrder();
  const gatewayOrder = orderData.gateway || {};
  const gatewayOrderId = gatewayOrder.order_id || orderData.payment?.order_reference;
  console.log(`✓ Payment order created: ${gatewayOrderId}, amount: ₹${(gatewayOrder.amount_paise || 0) / 100}, provider: ${gatewayOrder.provider}`);

  // 5. Simulate Mock Payment & Verification
  console.log('\n[5] Simulating Mock Payment & Signature Verification...');
  const simRes = await fetch('http://localhost:3000/api/payments/mock/simulate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      order_id: gatewayOrderId,
      outcome: 'SUCCESS',
      payment_method: 'UPI',
    }),
  });
  const simData = await simRes.json();
  if (!simRes.ok || !simData.payment) {
    throw new Error(`Payment verification failed: ${JSON.stringify(simData)}`);
  }
  paymentId = simData.payment.id;
  console.log(`✓ Payment captured: ID=${paymentId}, status=${simData.payment.status}, txnRef=${simData.payment.transaction_reference}`);

  // 6. Test Payment History API
  console.log('\n[6] Testing Resident Payment History API...');
  const histRes = await fetch('http://localhost:3000/api/payments', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const histData = await histRes.json();
  const payments = histData.payments || [];
  const found = payments.find(p => p.id === paymentId);
  if (!found) {
    throw new Error(`Payment ${paymentId} not listed in resident history`);
  }
  console.log(`✓ Payment history confirmed: ${payments.length} records. Latest matches ID=${found.id}, is_test=${found.is_test}`);

  // 7. Test Admin Society Payments & Partitioning
  console.log('\n[7] Testing Admin Society Payments & Test Partitioning...');
  const socPayRes = await fetch(`http://localhost:3000/api/payments/society/${societyId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const socPayData = await socPayRes.json();
  console.log(`✓ Admin society payments retrieved: total=${socPayData.payments?.length || 0}`);
  console.log(`  Real Collected: ₹${socPayData.summary?.total_real_collections || 0}`);
  console.log(`  Test Mode Volume: ₹${socPayData.summary?.total_test_collections || 0} (${socPayData.summary?.test_transaction_count || 0} active, ${socPayData.summary?.refund_count || 0} refunded)`);

  // 8. Test Refund API
  console.log('\n[8] Testing Admin Refund Capability...');
  const refundRes = await fetch(`http://localhost:3000/api/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      amount: 0.5,
      reason: 'Resident overcharged duplicate diagnostic slot',
    }),
  });
  const refundData = await refundRes.json();
  if (!refundRes.ok || !refundData.payment) {
    throw new Error(`Refund failed: ${JSON.stringify(refundData)}`);
  }
  console.log(`✓ Refund processed: amount=₹${refundData.payment.refund_amount}, status=${refundData.payment.refund_status}`);

  // 9. Test Charger Hardware Integrations (OCPP 1.6-J)
  console.log('\n[9] Testing Physical Charger (OCPP 1.6-J) WebSocket Server...');

  // Auth keys must never be visible to residents or the public
  const publicChargersRes = await fetch('http://localhost:3000/api/public/chargers');
  const publicChargers = (await publicChargersRes.json()).chargers || [];
  if (publicChargers.some((c) => 'auth_key' in c)) {
    throw new Error('Public charger list exposes charger auth keys');
  }
  const residentChargersRes = await fetch(`http://localhost:3000/api/societies/${societyId}/chargers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const residentChargers = (await residentChargersRes.json()).chargers || [];
  if (residentChargers.some((c) => 'auth_key' in c)) {
    throw new Error('Resident charger list exposes charger auth keys');
  }
  console.log('✓ Charger auth keys hidden from public and resident APIs');

  // Admins can read the key to configure hardware
  const adminChargersRes = await fetch(`http://localhost:3000/api/societies/${societyId}/chargers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminChargers = (await adminChargersRes.json()).chargers || [];
  const testCharger = adminChargers.find((c) => c.charger_number === 'C-01');
  if (!testCharger?.auth_key) {
    throw new Error('Admin could not read the auth key for charger C-01');
  }

  // Connections without a valid key must be refused
  function expectRejected(url) {
    return new Promise((resolve, reject) => {
      const probe = new WebSocket(url, ['ocpp1.6']);
      const timer = setTimeout(() => { probe.terminate(); reject(new Error(`No rejection for ${url}`)); }, 5000);
      probe.on('close', (code) => {
        clearTimeout(timer);
        if (code === 4003) resolve();
        else reject(new Error(`Expected close code 4003 for ${url}, got ${code}`));
      });
      probe.on('error', () => {});
    });
  }
  await expectRejected('ws://localhost:3000/ocpp/C-01');
  await expectRejected('ws://localhost:3000/ocpp/C-01?token=key_ecovolt_c_01');
  console.log('✓ OCPP connections without a valid auth key are rejected');

  const wsUrl = `ws://localhost:3000/ocpp/C-01?token=${encodeURIComponent(testCharger.auth_key)}`;
  console.log('Connecting simulated OCPP 1.6-J EV charger to: ws://localhost:3000/ocpp/C-01?token=<auth key>');

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, ['ocpp1.6', 'ocpp1.6j']);
    let messageIdCounter = 1;
    const pendingCalls = new Map();

    function sendCall(action, payload) {
      const msgId = String(messageIdCounter++);
      return new Promise((res, rej) => {
        pendingCalls.set(msgId, { res, rej, action });
        const callMessage = JSON.stringify([2, msgId, action, payload]);
        ws.send(callMessage);
      });
    }

    ws.on('open', async () => {
      console.log('✓ WebSocket connection established with Central System');
      try {
        // A. BootNotification
        console.log('  Sending BootNotification...');
        const bootResp = await sendCall('BootNotification', {
          chargePointVendor: 'Schneider Electric',
          chargePointModel: 'EVlink Pro AC',
          chargePointSerialNumber: 'SE-EVL-2026-001',
          firmwareVersion: 'v3.2.1-prod',
        });
        console.log(`  ✓ BootNotification Response: status=${bootResp.status}, interval=${bootResp.interval}s`);

        // B. Heartbeat
        console.log('  Sending Heartbeat...');
        const hbResp = await sendCall('Heartbeat', {});
        console.log(`  ✓ Heartbeat Response: currentTime=${hbResp.currentTime}`);

        // C. StatusNotification
        console.log('  Sending StatusNotification (Connector 1 -> Preparing)...');
        await sendCall('StatusNotification', {
          connectorId: 1,
          errorCode: 'NoError',
          status: 'Preparing',
        });
        console.log('  ✓ StatusNotification handled');

        // D. Authorize
        console.log('  Sending Authorize (idTag: TAG-RAHUL-01)...');
        const authResp = await sendCall('Authorize', { idTag: 'TAG-RAHUL-01' });
        console.log(`  ✓ Authorize Response: idTagInfo.status=${authResp.idTagInfo?.status}`);

        // E. StartTransaction
        console.log('  Sending StartTransaction...');
        const startResp = await sendCall('StartTransaction', {
          connectorId: 1,
          idTag: 'TAG-RAHUL-01',
          meterStart: 12500,
          timestamp: new Date().toISOString(),
        });
        console.log(`  ✓ StartTransaction Response: transactionId=${startResp.transactionId}, status=${startResp.idTagInfo?.status}`);

        // F. MeterValues
        console.log('  Sending MeterValues...');
        await sendCall('MeterValues', {
          connectorId: 1,
          transactionId: startResp.transactionId,
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [
                { value: '14200', context: 'Sample.Periodic', format: 'Raw', measurand: 'Energy.Active.Import.Register', unit: 'Wh' },
                { value: '32.1', context: 'Sample.Periodic', measurand: 'Current.Import', unit: 'A' },
                { value: '230.5', context: 'Sample.Periodic', measurand: 'Voltage', unit: 'V' },
                { value: '7.4', context: 'Sample.Periodic', measurand: 'Power.Active.Import', unit: 'kW' },
              ],
            },
          ],
        });
        console.log('  ✓ MeterValues received and processed');

        // G. StopTransaction
        console.log('  Sending StopTransaction...');
        const stopResp = await sendCall('StopTransaction', {
          transactionId: startResp.transactionId,
          idTag: 'TAG-RAHUL-01',
          meterStop: 15100,
          timestamp: new Date().toISOString(),
          reason: 'Local',
        });
        console.log(`  ✓ StopTransaction handled. Consumed: ${(15100 - 12500) / 1000} kWh`);

        ws.close();
        resolve();
      } catch (err) {
        ws.close();
        reject(err);
      }
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        const [type, msgId, payloadOrAction, payloadIfCall] = parsed;
        if (type === 3) {
          // CallResult [3, messageId, payload]
          if (pendingCalls.has(msgId)) {
            const { res } = pendingCalls.get(msgId);
            pendingCalls.delete(msgId);
            res(payloadOrAction);
          }
        } else if (type === 4) {
          // CallError
          if (pendingCalls.has(msgId)) {
            const { rej } = pendingCalls.get(msgId);
            pendingCalls.delete(msgId);
            rej(new Error(`OCPP Error: ${JSON.stringify(payloadOrAction)}`));
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });

  // 10. Test Admin Remote Commands & Diagnostics
  console.log('\n[10] Testing Admin Remote Commands (Reset & Diagnostics)...');
  const resetRes = await fetch(`http://localhost:3000/api/societies/${societyId}/chargers/1/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      command: 'Reset',
      type: 'Soft',
    }),
  });
  const resetData = await resetRes.json();
  console.log(`✓ Remote Reset response: ${JSON.stringify(resetData)}`);

  const diagRes = await fetch(`http://localhost:3000/api/societies/${societyId}/chargers/1/diagnostics`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const diagData = await diagRes.json();
  console.log(`✓ Diagnostics retrieved: charger=${diagData.charger?.name}, status=${diagData.charger?.status}, audits=${diagData.recent_commands?.length || 0}`);

  // 11. Test Integration Logs API
  console.log('\n[11] Testing Integration Logs API...');
  const logsRes = await fetch(`http://localhost:3000/api/societies/${societyId}/chargers/integration/logs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const logsData = await logsRes.json();
  const logs = logsData.logs || [];
  console.log(`✓ Retrieved ${logs.length} integration logs. Recent entries:`);
  logs.slice(0, 3).forEach(l => {
    console.log(`  [${(l.level || 'info').toUpperCase()}] [${l.type || l.source}] ${l.message}`);
  });

  console.log('\n======================================================');
  console.log('🎉 ALL E2E INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});

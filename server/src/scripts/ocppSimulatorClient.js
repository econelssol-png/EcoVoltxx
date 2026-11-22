/**
 * EcoVoltX — OCPP 1.6-J Charger Simulator Client
 * 
 * Simulates real physical EV charge points connected over WebSocket (OCPP 1.6-J).
 * Emulates hardware charging stations:
 * - WebSocket connection with OCPP 1.6 subprotocol & authentication tokens
 * - BootNotification & periodic Heartbeat
 * - Connector StatusNotification (Available, Preparing, Charging, Finishing)
 * - Handling RemoteStartTransaction & streaming real MeterValues
 * - Handling RemoteStopTransaction, Reset, UnlockConnector, ChangeAvailability
 * - Auto-reconnection logic
 */

const WebSocket = require('ws');
const db = require('../db/knex');

const SERVER_URL = process.env.OCPP_SERVER_URL || 'ws://localhost:3000/ocpp';
const HEARTBEAT_INTERVAL_MS = 30000;
const METER_TICK_INTERVAL_MS = 3000;

class SimulatedChargerClient {
  constructor(charger) {
    this.charger = charger;
    this.ws = null;
    this.messageCounter = 1;
    this.pendingCalls = new Map();
    this.heartbeatTimer = null;
    this.meterTimer = null;
    this.reconnectTimer = null;
    this.activeTransaction = null;
    this.isStopping = false;

    // Local meter in Wh
    this.currentMeterWh = charger.meter_reading_wh || (charger.id * 14200);
  }

  log(msg, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const prefix = `[${time}] ⚡ Charger #${this.charger.charger_number} (ID: ${this.charger.id})`;
    if (type === 'error') console.error(`${prefix} ❌ ${msg}`);
    else if (type === 'warn') console.warn(`${prefix} ⚠️  ${msg}`);
    else console.log(`${prefix} ${msg}`);
  }

  connect() {
    if (this.isStopping) return;

    const url = `${SERVER_URL}/${this.charger.id}?token=${encodeURIComponent(this.charger.auth_key || '')}`;
    this.log(`Connecting to Central System: ${url}...`);

    try {
      this.ws = new WebSocket(url, ['ocpp1.6', 'ocpp1.6j']);

      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason));
      this.ws.on('error', (err) => this.log(`WebSocket error: ${err.message}`, 'error'));
    } catch (err) {
      this.log(`Failed to initiate connection: ${err.message}`, 'error');
      this.scheduleReconnect();
    }
  }

  async handleOpen() {
    this.log(`✅ Connected successfully via OCPP 1.6-J!`);

    try {
      // 1. Send BootNotification
      const bootRes = await this.sendCall('BootNotification', {
        chargePointVendor: this.charger.vendor || 'Schneider Electric',
        chargePointModel: this.charger.model || 'EVlink Pro AC',
        chargePointSerialNumber: `EVX-SN-${this.charger.id.toString().padStart(4, '0')}`,
        firmwareVersion: this.charger.firmware_version || 'v2.4.1-ecovolt',
      });

      this.log(`BootNotification status: ${bootRes.status}`);

      // 2. Announce connectors status
      const connectorCount = this.charger.connector_count || 1;
      for (let c = 1; c <= connectorCount; c++) {
        await this.sendCall('StatusNotification', {
          connectorId: c,
          errorCode: 'NoError',
          status: 'Available',
          info: `Connector ${c} ready`,
          timestamp: new Date().toISOString(),
        });
      }
      this.log(`Reported ${connectorCount} connector(s) as Available.`);

      // 3. Start Heartbeat interval
      const interval = (bootRes.interval ? bootRes.interval * 1000 : HEARTBEAT_INTERVAL_MS);
      this.startHeartbeat(interval);

    } catch (err) {
      this.log(`Boot handshake error: ${err.message}`, 'error');
    }
  }

  startHeartbeat(intervalMs) {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(async () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          await this.sendCall('Heartbeat', {});
        } catch (err) {
          this.log(`Heartbeat missed: ${err.message}`, 'warn');
        }
      }
    }, intervalMs);
  }

  handleClose(code, reason) {
    this.log(`Disconnected from Central System (code: ${code}, reason: ${reason || 'none'})`, 'warn');
    this.cleanup();
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.isStopping) return;
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  cleanup() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.meterTimer) {
      clearInterval(this.meterTimer);
      this.meterTimer = null;
    }
    this.pendingCalls.clear();
  }

  stop() {
    this.isStopping = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.cleanup();
    if (this.ws) {
      try {
        this.ws.close(1000, 'Simulator stopped');
      } catch (e) {}
    }
  }

  sendCall(action, payload) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not open'));
      }

      const messageId = String(this.messageCounter++);
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(messageId);
        reject(new Error(`Call ${action} timed out after 10s`));
      }, 10000);

      this.pendingCalls.set(messageId, { resolve, reject, timeout, action });
      const call = JSON.stringify([2, messageId, action, payload]);
      this.ws.send(call);
    });
  }

  sendCallResult(messageId, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const result = JSON.stringify([3, messageId, payload]);
      this.ws.send(result);
    }
  }

  sendCallError(messageId, errorCode, errorDescription) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const err = JSON.stringify([4, messageId, errorCode, errorDescription, {}]);
      this.ws.send(err);
    }
  }

  async handleMessage(raw) {
    try {
      const data = JSON.parse(raw.toString());
      if (!Array.isArray(data)) return;

      const [typeId, messageId] = data;

      // Type 2: CALL from Central System
      if (typeId === 2) {
        const action = data[2];
        const payload = data[3] || {};
        await this.handleCentralCommand(messageId, action, payload);
      }
      // Type 3: CALLRESULT resolving our call
      else if (typeId === 3) {
        const payload = data[2] || {};
        const pending = this.pendingCalls.get(messageId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingCalls.delete(messageId);
          pending.resolve(payload);
        }
      }
      // Type 4: CALLERROR
      else if (typeId === 4) {
        const errorCode = data[2];
        const errorDesc = data[3];
        const pending = this.pendingCalls.get(messageId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingCalls.delete(messageId);
          pending.reject(new Error(`${errorCode}: ${errorDesc}`));
        }
      }
    } catch (err) {
      this.log(`Error parsing message: ${err.message}`, 'error');
    }
  }

  async handleCentralCommand(messageId, action, payload) {
    this.log(`📥 Received central command: [${action}] ${JSON.stringify(payload)}`);

    switch (action) {
      case 'RemoteStartTransaction':
        await this.handleRemoteStart(messageId, payload);
        break;

      case 'RemoteStopTransaction':
        await this.handleRemoteStop(messageId, payload);
        break;

      case 'Reset':
        this.sendCallResult(messageId, { status: 'Accepted' });
        this.log(`Reset command accepted (${payload.type || 'Soft'}). Re-initializing...`);
        setTimeout(async () => {
          await this.sendCall('BootNotification', {
            chargePointVendor: this.charger.vendor || 'Schneider Electric',
            chargePointModel: this.charger.model || 'EVlink Pro AC',
            chargePointSerialNumber: `EVX-SN-${this.charger.id.toString().padStart(4, '0')}`,
            firmwareVersion: this.charger.firmware_version || 'v2.4.1-ecovolt',
          });
          await this.sendCall('StatusNotification', {
            connectorId: 1,
            errorCode: 'NoError',
            status: 'Available',
          });
        }, 1000);
        break;

      case 'UnlockConnector':
        this.sendCallResult(messageId, { status: 'Unlocked' });
        this.log(`Connector ${payload.connectorId || 1} unlocked.`);
        break;

      case 'ChangeAvailability':
        this.sendCallResult(messageId, { status: 'Accepted' });
        const newStatus = payload.type === 'Operative' ? 'Available' : 'Unavailable';
        await this.sendCall('StatusNotification', {
          connectorId: payload.connectorId || 1,
          errorCode: 'NoError',
          status: newStatus,
        });
        this.log(`Availability changed to ${newStatus}`);
        break;

      default:
        this.sendCallResult(messageId, { status: 'Accepted' });
        break;
    }
  }

  async handleRemoteStart(messageId, payload) {
    const connectorId = payload.connectorId || 1;
    const idTag = payload.idTag || 'EVX-TAG-DEFAULT';

    // 1. Accept the command
    this.sendCallResult(messageId, { status: 'Accepted' });

    // 2. Report connector preparing (cable plugged in)
    await this.sendCall('StatusNotification', {
      connectorId,
      errorCode: 'NoError',
      status: 'Preparing',
    });

    // 3. Initiate StartTransaction
    try {
      const startRes = await this.sendCall('StartTransaction', {
        connectorId,
        idTag,
        meterStart: Math.floor(this.currentMeterWh),
        timestamp: new Date().toISOString(),
      });

      const transactionId = startRes.transactionId;
      this.activeTransaction = {
        transactionId,
        connectorId,
        startTime: Date.now(),
        initialMeterWh: this.currentMeterWh,
      };

      this.log(`🚀 Transaction #${transactionId} started on connector ${connectorId}`);

      // 4. Update status to Charging
      await this.sendCall('StatusNotification', {
        connectorId,
        errorCode: 'NoError',
        status: 'Charging',
      });

      // 5. Start streaming MeterValues
      this.startMeterValuesStream(transactionId, connectorId);

    } catch (err) {
      this.log(`Failed to start transaction: ${err.message}`, 'error');
      await this.sendCall('StatusNotification', {
        connectorId,
        errorCode: 'NoError',
        status: 'Available',
      });
    }
  }

  startMeterValuesStream(transactionId, connectorId) {
    if (this.meterTimer) clearInterval(this.meterTimer);

    const powerKw = parseFloat(this.charger.power_rating_kw) || 7.4;
    // Wh increment per tick: (powerKw * 1000) * (intervalSec / 3600)
    const whPerTick = (powerKw * 1000) * (METER_TICK_INTERVAL_MS / 3600000);

    this.meterTimer = setInterval(async () => {
      if (!this.activeTransaction || this.activeTransaction.transactionId !== transactionId) {
        clearInterval(this.meterTimer);
        return;
      }

      this.currentMeterWh += whPerTick;
      const energyDeliveredKwh = ((this.currentMeterWh - this.activeTransaction.initialMeterWh) / 1000).toFixed(3);

      this.log(`⚡ Charging active: +${energyDeliveredKwh} kWh delivered (Meter: ${Math.floor(this.currentMeterWh)} Wh)`);

      try {
        await this.sendCall('MeterValues', {
          connectorId,
          transactionId,
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [
                {
                  value: String(Math.floor(this.currentMeterWh)),
                  context: 'Sample.Periodic',
                  format: 'Raw',
                  measurand: 'Energy.Active.Import.Register',
                  unit: 'Wh',
                },
                {
                  value: String((powerKw * 1000).toFixed(0)),
                  context: 'Sample.Periodic',
                  format: 'Raw',
                  measurand: 'Power.Active.Import',
                  unit: 'W',
                },
              ],
            },
          ],
        });
      } catch (err) {
        this.log(`Failed to send MeterValues: ${err.message}`, 'warn');
      }
    }, METER_TICK_INTERVAL_MS);
  }

  async handleRemoteStop(messageId, payload) {
    const transactionId = payload.transactionId;

    // 1. Accept command
    this.sendCallResult(messageId, { status: 'Accepted' });

    if (this.meterTimer) {
      clearInterval(this.meterTimer);
      this.meterTimer = null;
    }

    const connectorId = this.activeTransaction?.connectorId || 1;
    this.activeTransaction = null;

    // 2. Report Finishing
    await this.sendCall('StatusNotification', {
      connectorId,
      errorCode: 'NoError',
      status: 'Finishing',
    });

    // 3. StopTransaction
    await this.sendCall('StopTransaction', {
      transactionId,
      meterStop: Math.floor(this.currentMeterWh),
      timestamp: new Date().toISOString(),
      reason: 'Remote',
    });

    this.log(`🛑 Transaction #${transactionId} completed. Final meter: ${Math.floor(this.currentMeterWh)} Wh`);

    // 4. Return to Available
    await this.sendCall('StatusNotification', {
      connectorId,
      errorCode: 'NoError',
      status: 'Available',
    });
  }
}

// ── Main Entrypoint ──────────────────────────────────────────
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         ⚡ EcoVoltX — OCPP 1.6-J Charger Simulator ⚡      ║
║           Connecting Virtual EV Hardware Stations          ║
╚════════════════════════════════════════════════════════════╝
`);

  try {
    const societyFilter = process.argv.find(a => a.startsWith('--society='));
    const chargerFilter = process.argv.find(a => a.startsWith('--charger='));

    let query = db('chargers').select('*');

    if (societyFilter) {
      const socId = parseInt(societyFilter.split('=')[1], 10);
      query = query.where({ society_id: socId });
      console.log(`Filtering for Society ID: ${socId}`);
    } else {
      // Default to Society 1 (Green Valley Residences)
      query = query.where({ society_id: 1 });
      console.log('Defaulting to Society 1 (Green Valley Residences). Use --society=all to connect all.');
    }

    if (chargerFilter) {
      const chgId = chargerFilter.split('=')[1];
      query = query.where(function() {
        this.where('id', parseInt(chgId, 10) || 0)
          .orWhere('charger_number', chgId);
      });
      console.log(`Filtering for Charger: ${chgId}`);
    }

    const chargers = await query;

    if (chargers.length === 0) {
      console.log('No matching chargers found in database.');
      process.exit(1);
    }

    console.log(`Found ${chargers.length} charger(s) to connect:\n`);
    chargers.forEach((c) => {
      console.log(`  • Charger #${c.charger_number} (ID: ${c.id}) | ${c.name} | ${c.power_rating_kw} kW | Mode: ${c.integration_mode}`);
    });
    console.log('');

    const clients = chargers.map((c) => new SimulatedChargerClient(c));
    clients.forEach((client) => client.connect());

    const shutdown = () => {
      console.log('\nGracefully shutting down simulated chargers...');
      clients.forEach((c) => c.stop());
      db.destroy();
      setTimeout(() => process.exit(0), 500);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SimulatedChargerClient };

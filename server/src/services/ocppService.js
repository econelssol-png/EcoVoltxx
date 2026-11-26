/**
 * OCPP 1.6-J Central System (CSMS) Service
 * 
 * Implements real WebSocket server for Open Charge Point Protocol (OCPP 1.6-J).
 * Handles:
 * - Charger Authentication & WebSocket Handshake
 * - Inbound OCPP Messages (BootNotification, Heartbeat, StatusNotification, Authorize, StartTransaction, MeterValues, StopTransaction)
 * - Outbound Central System Commands (RemoteStartTransaction, RemoteStopTransaction, Reset, UnlockConnector, ChangeAvailability)
 * - Audit Trail Logging in charger_commands_audit
 * - Real-time Socket.IO emission to Admin Dashboard and Resident App
 * - Distinct DEMO mode (simulated) vs PRODUCTION mode (physical hardware confirmed)
 */

const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/knex');

/**
 * Read the charger's auth key from ?token= / ?key= or an HTTP Basic
 * Authorization header (password part), as used by OCPP Security Profile 1.
 */
function extractChargerAuthKey(request, url) {
  const fromQuery = url.searchParams.get('token') || url.searchParams.get('key');
  if (fromQuery) return fromQuery;

  const header = request.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    return sep >= 0 ? decoded.slice(sep + 1) : decoded;
  }
  return null;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Message Type IDs in OCPP-J
const MESSAGE_TYPE_CALL = 2;
const MESSAGE_TYPE_CALLRESULT = 3;
const MESSAGE_TYPE_CALLERROR = 4;

class OcppService {
  constructor() {
    this.wss = null;
    this.socketManager = null;
    // Map of active charger connections: chargerId -> { ws, chargerIdentity, societyId, connectedAt, lastPing }
    this.activeChargers = new Map();
    // Map of pending outbound commands: messageId -> { resolve, reject, timer, command, chargerId }
    this.pendingCommands = new Map();
  }

  /**
   * Attach OCPP WebSocket server to existing HTTP server
   */
  init(httpServer, io) {
    this.socketManager = io;

    this.wss = new WebSocketServer({
      noServer: true,
      handleProtocols: (protocols) => {
        if (protocols.has('ocpp1.6')) return 'ocpp1.6';
        if (protocols.has('ocpp1.5')) return 'ocpp1.5';
        return false;
      },
    });

    // Handle HTTP Upgrade for /ocpp
    httpServer.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname.startsWith('/ocpp')) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    console.log('[OCPP] OCPP 1.6-J Central System initialized on ws://<host>/ocpp/:chargerIdentity');
  }

  /**
   * Handle incoming WebSocket connection from EV Charger
   */
  async handleConnection(ws, request) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    // Path format: /ocpp/:chargerIdentity or /ocpp?identity=...
    const pathParts = url.pathname.split('/').filter(Boolean);
    const chargerIdentity = pathParts[1] || url.searchParams.get('identity') || url.searchParams.get('charger');
    const providedKey = extractChargerAuthKey(request, url);

    if (!chargerIdentity) {
      console.warn('[OCPP] Connection rejected: Missing charger identity');
      ws.close(4001, 'Missing charger identity in path /ocpp/:chargerIdentity');
      return;
    }

    try {
      // Look up every charger matching this identity (charger numbers can repeat across societies)
      const candidates = await db('chargers')
        .where(function () {
          this.where('charger_number', chargerIdentity)
            .orWhere('ocpp_id', chargerIdentity)
            .orWhere('id', parseInt(chargerIdentity, 10) || 0);
        });

      if (candidates.length === 0) {
        console.warn(`[OCPP] Connection rejected: Charger '${chargerIdentity}' not registered`);
        ws.close(4004, 'Charger not registered');
        return;
      }

      // Authentication is mandatory: the charger must present its auth key
      // (?token=<key> or HTTP Basic auth password, OCPP Security Profile 1)
      const charger = providedKey
        ? candidates.find((c) => c.auth_key && safeEqual(c.auth_key, providedKey))
        : null;

      if (!charger) {
        console.warn(`[OCPP] Authentication failed for charger '${chargerIdentity}'`);
        ws.close(4003, 'Unauthorized: Missing or invalid charger auth key');
        return;
      }

      const chargerId = charger.id;
      const societyId = charger.society_id;

      // Register connection
      this.activeChargers.set(chargerId, {
        ws,
        chargerIdentity,
        societyId,
        connectedAt: new Date(),
        lastPing: new Date(),
      });

      // Update charger status to online
      await db('chargers').where({ id: chargerId }).update({
        connectivity_status: 'online',
        last_heartbeat: db.fn.now(),
        updated_at: db.fn.now(),
      });

      // Log in integration logs
      await db('integration_logs').insert({
        society_id: societyId,
        charger_id: chargerId,
        type: 'ocpp_event',
        level: 'info',
        source: 'ocpp_server',
        message: `Physical Charger #${charger.charger_number} connected via OCPP 1.6-J`,
        details: JSON.stringify({ ip: request.socket.remoteAddress, chargerIdentity }),
      });

      // Emit real-time update
      if (this.socketManager) {
        this.socketManager.to(`society_${societyId}`).emit('charger_connection_changed', {
          chargerId,
          connectivity_status: 'online',
          last_heartbeat: new Date().toISOString(),
        });
      }

      console.log(`[OCPP] Charger #${charger.charger_number} (ID: ${chargerId}) connected.`);

      // Listen for incoming OCPP messages
      ws.on('message', async (data) => {
        try {
          const messageStr = data.toString();
          const parsed = JSON.parse(messageStr);
          await this.handleOcppMessage(chargerId, societyId, parsed, ws);
        } catch (err) {
          console.error(`[OCPP] Error parsing message from charger ${chargerId}:`, err);
        }
      });

      // Handle close
      ws.on('close', async (code, reason) => {
        console.log(`[OCPP] Charger #${charger.charger_number} disconnected (code: ${code})`);
        this.activeChargers.delete(chargerId);

        // Update DB: mark offline
        await db('chargers').where({ id: chargerId }).update({
          connectivity_status: 'offline',
          status: 'offline', // Rule: Never show charger as available if offline!
          updated_at: db.fn.now(),
        });

        // Update connector status
        await db('charger_connectors').where({ charger_id: chargerId }).update({
          status: 'Unavailable',
          updated_at: db.fn.now(),
        });

        // Log disconnection
        await db('integration_logs').insert({
          society_id: societyId,
          charger_id: chargerId,
          type: 'ocpp_event',
          level: 'warn',
          source: 'ocpp_server',
          message: `Physical Charger #${charger.charger_number} disconnected (${reason || 'Connection lost'})`,
          details: JSON.stringify({ code, reason: String(reason) }),
        });

        // Emit socket event
        if (this.socketManager) {
          this.socketManager.to(`society_${societyId}`).emit('charger_connection_changed', {
            chargerId,
            connectivity_status: 'offline',
            status: 'offline',
          });
        }
      });

      ws.on('error', (err) => {
        console.error(`[OCPP] Socket error on charger ${chargerId}:`, err.message);
      });
    } catch (err) {
      console.error('[OCPP] Connection initialization error:', err);
      ws.close(1011, 'Internal Server Error');
    }
  }

  /**
   * Parse and route OCPP 1.6-J messages
   */
  async handleOcppMessage(chargerId, societyId, message, ws) {
    if (!Array.isArray(message)) return;

    const [messageTypeId, uniqueId] = message;

    // Handle CALL from charger to Central System
    if (messageTypeId === MESSAGE_TYPE_CALL) {
      const action = message[2];
      const payload = message[3] || {};
      await this.handleCall(chargerId, societyId, uniqueId, action, payload, ws);
    }
    // Handle CALLRESULT from charger responding to our command
    else if (messageTypeId === MESSAGE_TYPE_CALLRESULT) {
      const payload = message[2] || {};
      this.handleCallResult(uniqueId, payload);
    }
    // Handle CALLERROR
    else if (messageTypeId === MESSAGE_TYPE_CALLERROR) {
      const errorCode = message[2];
      const errorDescription = message[3];
      this.handleCallError(uniqueId, errorCode, errorDescription);
    }
  }

  /**
   * Resolve an OCPP idTag to the user to bill. The app starts sessions with
   * idTag "USR_<userId>"; the user must be an active, approved member of the
   * charger's society. Anything else (unknown RFID cards, free-vend) returns null.
   */
  async resolveIdTag(idTag, societyId) {
    const match = /^USR_(\d+)$/.exec(String(idTag || ''));
    if (!match) return null;
    const user = await db('users').where({ id: parseInt(match[1], 10), is_active: true }).first();
    if (!user) return null;
    const member = await db('society_members')
      .where({ user_id: user.id, society_id: societyId, status: 'approved' })
      .first();
    return member ? user : null;
  }

  async logRejectedTag(chargerId, societyId, idTag, action) {
    try {
      await db('integration_logs').insert({
        society_id: societyId,
        charger_id: chargerId,
        type: 'ocpp_event',
        level: 'warn',
        source: 'ocpp_server',
        message: `Refused unknown card or tag at the charger (${action}). Start charging from the EcoVoltX app instead`,
        details: JSON.stringify({ idTag: String(idTag || '').slice(0, 40), action }),
      });
    } catch (err) {
      console.error('[OCPP] Could not log refused tag:', err.message);
    }
  }

  /**
   * Handle Inbound CALL actions
   */
  async handleCall(chargerId, societyId, uniqueId, action, payload, ws) {
    const nowIso = new Date().toISOString();

    // 1. BootNotification
    if (action === 'BootNotification') {
      const { chargePointVendor, chargePointModel, firmwareVersion } = payload;

      await db('chargers').where({ id: chargerId }).update({
        vendor: chargePointVendor || undefined,
        model: chargePointModel || undefined,
        firmware_version: firmwareVersion || undefined,
        connectivity_status: 'online',
        last_heartbeat: db.fn.now(),
        updated_at: db.fn.now(),
      });

      this.sendCallResult(ws, uniqueId, {
        status: 'Accepted',
        currentTime: nowIso,
        interval: 60, // 60 seconds heartbeat interval
      });

      await db('integration_logs').insert({
        society_id: societyId,
        charger_id: chargerId,
        type: 'ocpp_event',
        level: 'info',
        source: 'ocpp_server',
        message: `BootNotification Accepted for charger #${chargerId}`,
        details: JSON.stringify(payload),
      });
    }

    // 2. Heartbeat
    else if (action === 'Heartbeat') {
      await db('chargers').where({ id: chargerId }).update({
        last_heartbeat: db.fn.now(),
        connectivity_status: 'online',
      });

      const entry = this.activeChargers.get(chargerId);
      if (entry) entry.lastPing = new Date();

      this.sendCallResult(ws, uniqueId, {
        currentTime: nowIso,
      });
    }

    // 3. StatusNotification
    else if (action === 'StatusNotification') {
      const { connectorId = 1, status = 'Available', errorCode = 'NoError' } = payload;

      // Update connector
      await db('charger_connectors')
        .where({ charger_id: chargerId, connector_id: connectorId })
        .update({
          status,
          last_status_time: db.fn.now(),
          updated_at: db.fn.now(),
        });

      // Map OCPP connector status to overall charger status
      let chargerStatus = 'available';
      if (status === 'Charging') chargerStatus = 'charging';
      else if (status === 'Faulted') chargerStatus = 'maintenance';
      else if (status === 'Unavailable') chargerStatus = 'offline';
      else if (status === 'Reserved') chargerStatus = 'available';

      await db('chargers').where({ id: chargerId }).update({
        status: chargerStatus,
        error_code: errorCode === 'NoError' ? null : errorCode,
        last_heartbeat: db.fn.now(),
        updated_at: db.fn.now(),
      });

      this.sendCallResult(ws, uniqueId, {});

      // Emit Socket.IO event to dashboards
      if (this.socketManager) {
        this.socketManager.to(`society_${societyId}`).emit('charger_status_changed', {
          chargerId,
          status: chargerStatus,
          connectorId,
          connectorStatus: status,
          errorCode,
        });
      }
    }

    // 4. Authorize: only tags that belong to an approved member of this society
    else if (action === 'Authorize') {
      const { idTag } = payload;
      const user = await this.resolveIdTag(idTag, societyId);
      if (!user) {
        await this.logRejectedTag(chargerId, societyId, idTag, 'Authorize');
      }
      this.sendCallResult(ws, uniqueId, {
        idTagInfo: user
          ? { status: 'Accepted', expiryDate: new Date(Date.now() + 86400000).toISOString() }
          : { status: 'Invalid' },
      });
    }

    // 5. StartTransaction
    else if (action === 'StartTransaction') {
      const { connectorId = 1, idTag, meterStart = 0, timestamp } = payload;

      // Find if there is an active booked or pending session
      let session = await db('charging_sessions')
        .where({ charger_id: chargerId, status: 'active' })
        .first();

      const charger = await db('chargers').where({ id: chargerId }).first();

      if (!session) {
        // Started at the charger (not from the app): bill only the owner of the tag.
        // Unknown tags are refused, so nobody else is billed for this charging.
        const tagUser = await this.resolveIdTag(idTag, societyId);
        if (!tagUser) {
          await this.logRejectedTag(chargerId, societyId, idTag, 'StartTransaction');
          this.sendCallResult(ws, uniqueId, {
            transactionId: 0,
            idTagInfo: { status: 'Invalid' },
          });
          return;
        }

        const [sessionId] = await db('charging_sessions').insert({
          user_id: tagUser.id,
          society_id: societyId,
          charger_id: chargerId,
          start_time: timestamp || nowIso,
          energy_kwh: 0,
          cost: 0,
          price_per_kwh_at_time: charger.price_per_kwh,
          power_rating_kw_at_time: charger.power_rating_kw,
          status: 'active',
          is_simulated: false, // Physical hardware session!
        });

        session = await db('charging_sessions').where({ id: sessionId }).first();
      }

      // Update charger and connector
      await db('chargers').where({ id: chargerId }).update({
        status: 'charging',
        meter_reading_wh: meterStart,
      });

      await db('charger_connectors')
        .where({ charger_id: chargerId, connector_id: connectorId })
        .update({
          status: 'Charging',
          current_session_id: session.id,
          meter_reading_wh: meterStart,
        });

      this.sendCallResult(ws, uniqueId, {
        transactionId: session.id,
        idTagInfo: { status: 'Accepted' },
      });

      if (this.socketManager) {
        this.socketManager.to(`society_${societyId}`).emit('session_update', {
          sessionId: session.id,
          chargerId,
          status: 'active',
          energyKwh: 0,
          cost: 0,
        });
      }
    }

    // 6. MeterValues
    else if (action === 'MeterValues') {
      const { connectorId = 1, transactionId, meterValue = [] } = payload;

      let currentWh = 0;
      for (const mv of meterValue) {
        if (mv.sampledValue) {
          for (const s of mv.sampledValue) {
            if (!s.measurand || s.measurand === 'Energy.Active.Import.Register') {
              currentWh = parseFloat(s.value);
            }
          }
        }
      }

      if (currentWh > 0) {
        await db('chargers').where({ id: chargerId }).update({
          meter_reading_wh: currentWh,
        });

        await db('charger_connectors')
          .where({ charger_id: chargerId, connector_id: connectorId })
          .update({
            meter_reading_wh: currentWh,
          });

        if (transactionId) {
          const session = await db('charging_sessions').where({ id: transactionId }).first();
          if (session && session.status === 'active') {
            const energyKwh = parseFloat((currentWh / 1000).toFixed(3));
            const cost = parseFloat((energyKwh * parseFloat(session.price_per_kwh_at_time)).toFixed(2));
            const durationMs = Date.now() - new Date(session.start_time).getTime();
            const durationMinutes = Math.floor(durationMs / 60000);

            await db('charging_sessions').where({ id: transactionId }).update({
              energy_kwh: energyKwh,
              cost: cost,
              duration_minutes: durationMinutes,
              updated_at: db.fn.now(),
            });

            if (this.socketManager) {
              this.socketManager.to(`society_${societyId}`).emit('session_update', {
                sessionId: session.id,
                chargerId,
                energyKwh,
                cost,
                durationMinutes,
                status: 'active',
              });
            }
          }
        }
      }

      this.sendCallResult(ws, uniqueId, {});
    }

    // 7. StopTransaction
    else if (action === 'StopTransaction') {
      const { transactionId, meterStop = 0, timestamp, reason = 'Remote' } = payload;

      // transactionId 0 is the placeholder we return when a tag is refused:
      // nothing was started, so there is nothing to stop or bill
      if (transactionId === 0) {
        this.sendCallResult(ws, uniqueId, { idTagInfo: { status: 'Invalid' } });
        return;
      }

      let session = null;
      if (transactionId) {
        session = await db('charging_sessions').where({ id: transactionId }).first();
      } else {
        session = await db('charging_sessions')
          .where({ charger_id: chargerId, status: 'active' })
          .first();
      }

      if (session) {
        const endTime = timestamp || nowIso;
        const durationMs = new Date(endTime).getTime() - new Date(session.start_time).getTime();
        const durationMinutes = Math.max(1, Math.floor(durationMs / 60000));
        let finalEnergy = parseFloat(session.energy_kwh);

        // If meterStop provided, use real meter difference
        if (meterStop > 0) {
          finalEnergy = parseFloat((meterStop / 1000).toFixed(3));
        }

        const finalCost = parseFloat((finalEnergy * parseFloat(session.price_per_kwh_at_time)).toFixed(2));

        await db('charging_sessions').where({ id: session.id }).update({
          status: 'completed',
          end_time: endTime,
          duration_minutes: durationMinutes,
          energy_kwh: finalEnergy,
          cost: finalCost,
          stop_reason: reason,
          updated_at: db.fn.now(),
        });
      }

      // Mark charger & connector as available
      await db('chargers').where({ id: chargerId }).update({
        status: 'available',
        meter_reading_wh: meterStop > 0 ? meterStop : undefined,
        updated_at: db.fn.now(),
      });

      await db('charger_connectors').where({ charger_id: chargerId }).update({
        status: 'Available',
        current_session_id: null,
        meter_reading_wh: meterStop > 0 ? meterStop : undefined,
        updated_at: db.fn.now(),
      });

      this.sendCallResult(ws, uniqueId, {
        idTagInfo: { status: 'Accepted' },
      });

      if (this.socketManager) {
        this.socketManager.to(`society_${societyId}`).emit('charger_status_changed', {
          chargerId,
          status: 'available',
        });
        if (session) {
          this.socketManager.to(`society_${societyId}`).emit('session_update', {
            sessionId: session.id,
            chargerId,
            status: 'completed',
          });
        }
      }
    }

    // Default handler for other actions
    else {
      this.sendCallResult(ws, uniqueId, {});
    }
  }

  /**
   * Send CALLRESULT [3, UniqueId, Payload]
   */
  sendCallResult(ws, uniqueId, payload) {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify([MESSAGE_TYPE_CALLRESULT, uniqueId, payload]));
    }
  }

  /**
   * Handle incoming CALLRESULT resolving our outgoing command
   */
  handleCallResult(uniqueId, payload) {
    const pending = this.pendingCommands.get(uniqueId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingCommands.delete(uniqueId);

    // Update command audit in database
    db('charger_commands_audit')
      .where({ id: pending.auditId })
      .update({
        status: payload.status === 'Rejected' ? 'rejected' : 'accepted',
        response: JSON.stringify(payload),
        completed_at: db.fn.now(),
      })
      .catch(console.error);

    pending.resolve(payload);
  }

  /**
   * Handle incoming CALLERROR
   */
  handleCallError(uniqueId, errorCode, errorDescription) {
    const pending = this.pendingCommands.get(uniqueId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingCommands.delete(uniqueId);

    db('charger_commands_audit')
      .where({ id: pending.auditId })
      .update({
        status: 'failed',
        response: JSON.stringify({ errorCode, errorDescription }),
        completed_at: db.fn.now(),
      })
      .catch(console.error);

    pending.reject(new Error(`Charger command failed: [${errorCode}] ${errorDescription}`));
  }

  /**
   * Send Central System command to Charger (RemoteStart, RemoteStop, Reset, etc.)
   */
  async sendCommand(chargerId, commandName, payload, { societyId, userId = null, timeoutMs = 10000 }) {
    const charger = await db('chargers').where({ id: chargerId }).first();
    if (!charger) throw new Error(`Charger #${chargerId} not found`);

    const connection = this.activeChargers.get(chargerId);

    // Rule 14: Safe timeout and failure handling for disconnected chargers
    // Rule 13: Do not report command as successful until confirmed!
    if (!connection || connection.ws.readyState !== 1) {
      // Record failure audit
      await db('charger_commands_audit').insert({
        charger_id: chargerId,
        society_id: societyId || charger.society_id,
        user_id: userId,
        command: commandName,
        connector_id: payload.connectorId || 1,
        payload: JSON.stringify(payload),
        status: 'failed',
        response: JSON.stringify({ error: 'Charger is offline or disconnected from Central System' }),
        completed_at: db.fn.now(),
      });

      throw new Error(
        `Charger ${charger.charger_number} is OFFLINE / unreachable via OCPP Central System. Verify physical charger network connectivity and WebSocket credentials.`
      );
    }

    const messageId = uuidv4();

    // Create audit record
    const [auditId] = await db('charger_commands_audit').insert({
      charger_id: chargerId,
      society_id: societyId || charger.society_id,
      user_id: userId,
      command: commandName,
      connector_id: payload.connectorId || 1,
      payload: JSON.stringify(payload),
      status: 'pending',
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        this.pendingCommands.delete(messageId);
        await db('charger_commands_audit').where({ id: auditId }).update({
          status: 'timeout',
          response: JSON.stringify({ error: `Command timed out after ${timeoutMs}ms` }),
          completed_at: db.fn.now(),
        });
        reject(new Error(`Timeout: Charger ${charger.charger_number} did not respond to ${commandName} within ${timeoutMs / 1000} seconds.`));
      }, timeoutMs);

      this.pendingCommands.set(messageId, {
        resolve,
        reject,
        timer,
        auditId,
        command: commandName,
        chargerId,
      });

      // Send OCPP Call: [2, "<MessageId>", "<Action>", { <Payload> }]
      const rawMessage = JSON.stringify([MESSAGE_TYPE_CALL, messageId, commandName, payload]);
      connection.ws.send(rawMessage);
    });
  }

  /**
   * Check if a charger is currently connected via OCPP
   */
  isChargerConnected(chargerId) {
    const conn = this.activeChargers.get(chargerId);
    return Boolean(conn && conn.ws.readyState === 1);
  }

  /**
   * Get active connection stats
   */
  getConnectionInfo(chargerId) {
    const conn = this.activeChargers.get(chargerId);
    if (!conn) return null;
    return {
      connected: true,
      chargerIdentity: conn.chargerIdentity,
      connectedAt: conn.connectedAt,
      lastPing: conn.lastPing,
    };
  }
}

const ocppService = new OcppService();
module.exports = ocppService;

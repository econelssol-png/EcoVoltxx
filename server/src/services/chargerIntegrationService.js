/**
 * Unified Charger Integration Service
 * 
 * Cleanly separates charger communication logic from booking, billing, and resident UI.
 * Manages dispatch between DEMO mode (simulation engine) and PRODUCTION mode (OCPP physical hardware).
 */

const db = require('../db/knex');
const ocppService = require('./ocppService');
const chargerSimulator = require('./chargerSimulator');

class ChargerIntegrationService {
  /**
   * Status to show residents, visitors and admins. A hardware (PRODUCTION)
   * charger that is not connected over OCPP cannot charge, so it is offline
   * no matter what the stored status says.
   */
  liveStatus(charger) {
    if (
      charger &&
      charger.integration_mode === 'PRODUCTION' &&
      charger.status === 'available' &&
      !ocppService.isChargerConnected(charger.id)
    ) {
      return 'offline';
    }
    return charger?.status;
  }

  /** Chargers in a society that can actually start a session right now */
  async countAvailable(societyId) {
    const rows = await db('chargers').where({ society_id: societyId }).select('id', 'status', 'integration_mode');
    return rows.filter((c) => this.liveStatus(c) === 'available').length;
  }

  /**
   * Start charging session on a charger (dispatches based on integration_mode)
   */
  async startSession({ chargerId, societyId, userId, bookingId }) {
    const charger = await db('chargers').where({ id: chargerId, society_id: societyId }).first();
    if (!charger) throw new Error('Charger not found in this society');

    // Rule 11 & 12: Never show charger as available if status unknown or offline
    if (charger.status === 'offline' || charger.connectivity_status === 'offline') {
      throw new Error(`Charger ${charger.charger_number} is offline and cannot accept charging commands.`);
    }

    if (charger.status !== 'available') {
      throw new Error(`Charger ${charger.charger_number} is currently ${charger.status}`);
    }

    // PRODUCTION MODE
    if (charger.integration_mode === 'PRODUCTION') {
      // Must have physical charger connected
      const isOnline = ocppService.isChargerConnected(charger.id);
      if (!isOnline) {
        throw new Error(
          `PRODUCTION ERROR: Physical Charger ${charger.charger_number} is disconnected from OCPP Central System. Physical hardware connection required.`
        );
      }

      // Create session in pending/active state
      const [sessionId] = await db('charging_sessions').insert({
        user_id: userId,
        society_id: societyId,
        charger_id: charger.id,
        booking_id: bookingId || null,
        start_time: new Date().toISOString(),
        energy_kwh: 0,
        cost: 0,
        price_per_kwh_at_time: charger.price_per_kwh,
        power_rating_kw_at_time: charger.power_rating_kw,
        status: 'active',
        is_simulated: false, // Real physical session!
      });

      // Send RemoteStartTransaction via OCPP
      try {
        const response = await ocppService.sendCommand(
          charger.id,
          'RemoteStartTransaction',
          {
            connectorId: 1,
            idTag: `USR_${userId}`,
          },
          { societyId, userId, timeoutMs: 12000 }
        );

        if (response.status !== 'Accepted') {
          // Revert session if hardware rejected
          await db('charging_sessions').where({ id: sessionId }).update({
            status: 'error',
            stop_reason: 'Hardware rejected RemoteStartTransaction',
          });
          throw new Error(`Physical charger rejected start command: ${JSON.stringify(response)}`);
        }

        // Hardware confirmed! Update charger
        await db('chargers').where({ id: charger.id }).update({
          status: 'charging',
          updated_at: db.fn.now(),
        });

        await db('charger_connectors').where({ charger_id: charger.id, connector_id: 1 }).update({
          status: 'Charging',
          current_session_id: sessionId,
          updated_at: db.fn.now(),
        });

        const session = await db('charging_sessions').where({ id: sessionId }).first();
        return session;
      } catch (err) {
        // Rollback session
        await db('charging_sessions').where({ id: sessionId }).update({
          status: 'error',
          stop_reason: err.message,
        });
        throw err;
      }
    }

    // DEMO MODE (Simulation)
    else {
      const [sessionId] = await db('charging_sessions').insert({
        user_id: userId,
        society_id: societyId,
        charger_id: charger.id,
        booking_id: bookingId || null,
        start_time: new Date().toISOString(),
        energy_kwh: 0,
        cost: 0,
        price_per_kwh_at_time: charger.price_per_kwh,
        power_rating_kw_at_time: charger.power_rating_kw,
        status: 'active',
        is_simulated: true, // Clearly simulated!
      });

      // Start simulator loop for this session
      await chargerSimulator.startCharging(sessionId);

      // Update connector
      await db('charger_connectors').where({ charger_id: charger.id, connector_id: 1 }).update({
        status: 'Charging',
        current_session_id: sessionId,
        updated_at: db.fn.now(),
      });

      const session = await db('charging_sessions').where({ id: sessionId }).first();
      return session;
    }
  }

  /**
   * Stop charging session
   */
  async stopSession({ sessionId, societyId, userId, reason = 'user_stopped' }) {
    const session = await db('charging_sessions').where({ id: sessionId }).first();
    if (!session) throw new Error('Session not found');
    if (session.status !== 'active') throw new Error('Session is not active');

    const charger = await db('chargers').where({ id: session.charger_id }).first();

    // PRODUCTION MODE (Physical Hardware)
    if (charger && charger.integration_mode === 'PRODUCTION') {
      const isOnline = ocppService.isChargerConnected(charger.id);
      if (!isOnline) {
        throw new Error(
          `PRODUCTION ERROR: Charger ${charger.charger_number} is offline. Cannot communicate stop command to physical hardware.`
        );
      }

      // Send RemoteStopTransaction
      const response = await ocppService.sendCommand(
        charger.id,
        'RemoteStopTransaction',
        {
          transactionId: session.id,
        },
        { societyId, userId, timeoutMs: 12000 }
      );

      if (response.status !== 'Accepted') {
        throw new Error(`Physical charger rejected stop command: ${JSON.stringify(response)}`);
      }

      // Completed through hardware confirmation
      const endTime = new Date();
      const durationMs = endTime.getTime() - new Date(session.start_time).getTime();
      const durationMinutes = Math.max(1, Math.floor(durationMs / 60000));

      await db('charging_sessions').where({ id: session.id }).update({
        status: 'completed',
        end_time: endTime.toISOString(),
        duration_minutes: durationMinutes,
        stop_reason: reason,
        updated_at: db.fn.now(),
      });

      await db('chargers').where({ id: charger.id }).update({
        status: 'available',
        updated_at: db.fn.now(),
      });

      await db('charger_connectors').where({ charger_id: charger.id }).update({
        status: 'Available',
        current_session_id: null,
        updated_at: db.fn.now(),
      });

      return await db('charging_sessions').where({ id: session.id }).first();
    }

    // DEMO MODE
    else {
      return await chargerSimulator.stopCharging(session.id, reason);
    }
  }

  /**
   * Remote Reset Charger (Admin Command)
   */
  async resetCharger({ chargerId, societyId, userId, type = 'Soft' }) {
    const charger = await db('chargers').where({ id: chargerId, society_id: societyId }).first();
    if (!charger) throw new Error('Charger not found');

    if (charger.integration_mode === 'PRODUCTION') {
      return await ocppService.sendCommand(
        charger.id,
        'Reset',
        { type },
        { societyId, userId, timeoutMs: 10000 }
      );
    } else {
      // Demo simulated reset
      await db('chargers').where({ id: charger.id }).update({
        status: 'available',
        connectivity_status: 'online',
        last_heartbeat: db.fn.now(),
        updated_at: db.fn.now(),
      });
      return { status: 'Accepted', message: `Simulated ${type} reset completed` };
    }
  }

  /**
   * Unlock Connector (Admin Command)
   */
  async unlockConnector({ chargerId, connectorId = 1, societyId, userId }) {
    const charger = await db('chargers').where({ id: chargerId, society_id: societyId }).first();
    if (!charger) throw new Error('Charger not found');

    if (charger.integration_mode === 'PRODUCTION') {
      return await ocppService.sendCommand(
        charger.id,
        'UnlockConnector',
        { connectorId },
        { societyId, userId, timeoutMs: 10000 }
      );
    } else {
      await db('charger_connectors')
        .where({ charger_id: charger.id, connector_id: connectorId })
        .update({ status: 'Available', updated_at: db.fn.now() });
      return { status: 'Unlocked', message: 'Simulated connector unlocked' };
    }
  }

  /**
   * Get Charger Diagnostics & Connection Info
   */
  async getDiagnostics(chargerId) {
    const charger = await db('chargers').where({ id: chargerId }).first();
    if (!charger) throw new Error('Charger not found');

    const connectors = await db('charger_connectors').where({ charger_id: chargerId }).select('*');
    const recentAudit = await db('charger_commands_audit')
      .where({ charger_id: chargerId })
      .orderBy('sent_at', 'desc')
      .limit(10);
    const recentLogs = await db('integration_logs')
      .where({ charger_id: chargerId })
      .orderBy('created_at', 'desc')
      .limit(10);

    const isConnected = ocppService.isChargerConnected(chargerId);
    const connInfo = ocppService.getConnectionInfo(chargerId);

    return {
      charger,
      connectors,
      is_connected: isConnected,
      connection_info: connInfo,
      recent_commands: recentAudit,
      recent_logs: recentLogs,
    };
  }
}

const chargerIntegrationService = new ChargerIntegrationService();
module.exports = chargerIntegrationService;

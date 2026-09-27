/**
 * Charger Simulator Service
 * 
 * Simulates EV charging by periodically incrementing energy_kwh
 * on active charging sessions. Designed to be easily replaced
 * with a real OCPP integration layer.
 * 
 * Architecture:
 * ┌─────────────────────┐
 * │  Simulated Charger   │  ← This service (for dev/demo)
 * │  Service              │
 * └────────┬─────────────┘
 *          │ same interface
 * ┌────────▼─────────────┐
 * │  OCPP Integration     │  ← Future real charger layer
 * │  Layer                │
 * └──────────────────────┘
 */

const db = require('../db/knex');
const config = require('../config');

let simulationInterval = null;
let socketManager = null;

/**
 * Initialize the simulator with a reference to SocketManager
 */
function init(io) {
  socketManager = io;
}

/**
 * Start the simulation loop
 */
function startSimulation() {
  if (simulationInterval) return;

  console.log('[ChargerSimulator] Starting simulation loop...');

  simulationInterval = setInterval(async () => {
    try {
      await tickSimulation();
    } catch (err) {
      console.error('[ChargerSimulator] Simulation tick error:', err);
    }
  }, config.simulationIntervalMs);
}

/**
 * Stop the simulation loop
 */
function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log('[ChargerSimulator] Simulation stopped.');
  }
}

/**
 * Single simulation tick — update all active simulated sessions
 */
async function tickSimulation() {
  const activeSessions = await db('charging_sessions')
    .where({ status: 'active', is_simulated: true })
    .select('*');

  for (const session of activeSessions) {
    // Calculate energy increment based on power rating and interval
    const intervalMinutes = config.simulationIntervalMs / 60000;
    const energyIncrement = (session.power_rating_kw_at_time / 60) * intervalMinutes;

    const newEnergy = parseFloat(session.energy_kwh) + energyIncrement;
    const newCost = newEnergy * parseFloat(session.price_per_kwh_at_time);
    const durationMs = Date.now() - new Date(session.start_time).getTime();
    const durationMinutes = Math.floor(durationMs / 60000);

    await db('charging_sessions')
      .where({ id: session.id })
      .update({
        energy_kwh: parseFloat(newEnergy.toFixed(3)),
        cost: parseFloat(newCost.toFixed(2)),
        duration_minutes: durationMinutes,
        updated_at: db.fn.now(),
      });

    // Emit real-time update via Socket.IO
    if (socketManager) {
      socketManager.to(`society_${session.society_id}`).emit('session_update', {
        sessionId: session.id,
        chargerId: session.charger_id,
        userId: session.user_id,
        energyKwh: parseFloat(newEnergy.toFixed(3)),
        cost: parseFloat(newCost.toFixed(2)),
        durationMinutes,
        status: 'active',
      });

      socketManager.to(`user_${session.user_id}`).emit('session_update', {
        sessionId: session.id,
        chargerId: session.charger_id,
        energyKwh: parseFloat(newEnergy.toFixed(3)),
        cost: parseFloat(newCost.toFixed(2)),
        durationMinutes,
        status: 'active',
      });
    }
  }
}

/**
 * Start a simulated charging session
 */
async function startCharging(sessionId) {
  const session = await db('charging_sessions').where({ id: sessionId }).first();
  if (!session) throw new Error('Session not found');

  // Mark charger as charging
  await db('chargers')
    .where({ id: session.charger_id })
    .update({ status: 'charging', updated_at: db.fn.now() });

  // Emit charger status update
  if (socketManager) {
    socketManager.to(`society_${session.society_id}`).emit('charger_status', {
      chargerId: session.charger_id,
      status: 'charging',
    });
  }

  console.log(`[ChargerSimulator] Started charging — Session #${sessionId}, Charger #${session.charger_id}`);
}

/**
 * Stop a simulated charging session
 */
async function stopCharging(sessionId, reason = 'user_stopped') {
  const session = await db('charging_sessions').where({ id: sessionId }).first();
  if (!session) throw new Error('Session not found');

  const endTime = new Date();
  const durationMs = endTime.getTime() - new Date(session.start_time).getTime();
  const durationMinutes = Math.floor(durationMs / 60000);

  // Finalize session
  await db('charging_sessions')
    .where({ id: sessionId })
    .update({
      status: 'completed',
      end_time: endTime.toISOString(),
      duration_minutes: durationMinutes,
      stop_reason: reason,
      updated_at: db.fn.now(),
    });

  // Mark charger as available
  await db('chargers')
    .where({ id: session.charger_id })
    .update({ status: 'available', updated_at: db.fn.now() });

  // Emit updates
  if (socketManager) {
    const updatedSession = await db('charging_sessions').where({ id: sessionId }).first();

    socketManager.to(`society_${session.society_id}`).emit('charger_status', {
      chargerId: session.charger_id,
      status: 'available',
    });

    socketManager.to(`society_${session.society_id}`).emit('session_update', {
      sessionId: session.id,
      chargerId: session.charger_id,
      userId: session.user_id,
      energyKwh: parseFloat(updatedSession.energy_kwh),
      cost: parseFloat(updatedSession.cost),
      durationMinutes,
      status: 'completed',
    });

    socketManager.to(`user_${session.user_id}`).emit('session_update', {
      sessionId: session.id,
      chargerId: session.charger_id,
      energyKwh: parseFloat(updatedSession.energy_kwh),
      cost: parseFloat(updatedSession.cost),
      durationMinutes,
      status: 'completed',
    });
  }

  console.log(`[ChargerSimulator] Stopped charging — Session #${sessionId} (${reason})`);
  return await db('charging_sessions').where({ id: sessionId }).first();
}

module.exports = {
  init,
  startSimulation,
  stopSimulation,
  startCharging,
  stopCharging,
};

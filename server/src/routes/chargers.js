/**
 * Charger Routes
 * 
 * All routes scoped under /api/societies/:societyId/chargers
 * 
 * GET    /                           — list chargers (with connectors and online status)
 * GET    /:chargerId                 — charger details
 * POST   /                           — add charger (admin)
 * PUT    /:chargerId                 — update charger (admin)
 * DELETE /:chargerId                 — deactivate charger (admin)
 * POST   /:chargerId/command         — send hardware command (Reset, UnlockConnector) (admin)
 * GET    /:chargerId/diagnostics     — live diagnostics and command audit log (admin)
 * GET    /integration/config         — get society OCPP integration settings (admin)
 * PUT    /integration/config         — update society OCPP integration settings (admin)
 * GET    /integration/logs           — get integration health and error logs (admin)
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { requireSocietyAdmin } = require('../middleware/rbac');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');
const ocppService = require('../services/ocppService');
const chargerIntegrationService = require('../services/chargerIntegrationService');
const config = require('../config');
const crypto = require('crypto');

// Charger OCPP auth keys are secrets: only society admins and super admins may see them
function canSeeChargerSecrets(req) {
  return req.user.role === 'super_admin' || req.societyMember?.role === 'admin';
}

function stripChargerSecrets(charger) {
  const { auth_key, ...rest } = charger;
  return rest;
}

function generateChargerAuthKey() {
  return `ck_${crypto.randomBytes(24).toString('hex')}`;
}

const router = express.Router({ mergeParams: true });

// ── 1. List chargers ───────────────────────────────────────
router.get('/', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const chargers = await db('chargers')
      .where({ society_id: req.societyId })
      .orderBy('charger_number', 'asc');

    // Enrich with connectors and live OCPP connection state
    const enriched = await Promise.all(
      chargers.map(async (c) => {
        const connectors = await db('charger_connectors')
          .where({ charger_id: c.id })
          .orderBy('connector_id', 'asc');

        const isConnected = ocppService.isChargerConnected(c.id);
        const connInfo = ocppService.getConnectionInfo(c.id);

        return {
          ...(canSeeChargerSecrets(req) ? c : stripChargerSecrets(c)),
          status: chargerIntegrationService.liveStatus(c),
          connectors,
          is_ocpp_connected: isConnected,
          connection_info: connInfo,
        };
      })
    );

    res.json({ chargers: enriched });
  } catch (err) {
    console.error('List chargers error:', err);
    res.status(500).json({ error: 'Failed to list chargers' });
  }
});

// ── 2. Society Integration Configuration ───────────────────
router.get('/integration/config', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    let config = await db('charger_integration_configs')
      .where({ society_id: req.societyId })
      .first();

    // Chargers must use wss:// when the site is served over HTTPS (as on Railway)
    const host = req.get('host') || 'localhost:3000';
    const scheme = req.protocol === 'https' ? 'wss' : 'ws';

    if (config && req.protocol === 'https' && /^ws:\/\//i.test(config.ocpp_server_ws_url || '')) {
      await db('charger_integration_configs').where({ id: config.id }).update({
        ocpp_server_ws_url: config.ocpp_server_ws_url.replace(/^ws:\/\//i, 'wss://'),
        updated_at: db.fn.now(),
      });
      config = await db('charger_integration_configs').where({ id: config.id }).first();
    }

    if (!config) {
      const wsUrl = `${scheme}://${host}/ocpp`;
      const [id] = await db('charger_integration_configs').insert({
        society_id: req.societyId,
        ocpp_server_ws_url: wsUrl,
        heartbeat_interval_seconds: 60,
        connection_timeout_seconds: 30,
        default_mode: 'DEMO',
        auth_required: false,
        notes: 'Standard EcoVoltX OCPP 1.6-J Central System',
      });
      config = await db('charger_integration_configs').where({ id }).first();
    }

    res.json({ config });
  } catch (err) {
    console.error('Get integration config error:', err);
    res.status(500).json({ error: 'Failed to retrieve integration config' });
  }
});

router.put('/integration/config', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const { ocpp_server_ws_url, heartbeat_interval_seconds, connection_timeout_seconds, default_mode, auth_required, notes } = req.body;

    await db('charger_integration_configs')
      .where({ society_id: req.societyId })
      .update({
        ocpp_server_ws_url: ocpp_server_ws_url !== undefined ? ocpp_server_ws_url : undefined,
        heartbeat_interval_seconds: heartbeat_interval_seconds ? parseInt(heartbeat_interval_seconds, 10) : undefined,
        connection_timeout_seconds: connection_timeout_seconds ? parseInt(connection_timeout_seconds, 10) : undefined,
        default_mode: default_mode || undefined,
        auth_required: auth_required !== undefined ? Boolean(auth_required) : undefined,
        notes: notes !== undefined ? notes : undefined,
        updated_at: db.fn.now(),
      });

    const updated = await db('charger_integration_configs').where({ society_id: req.societyId }).first();
    res.json({ config: updated });
  } catch (err) {
    console.error('Update integration config error:', err);
    res.status(500).json({ error: 'Failed to update integration config' });
  }
});

// ── 3. Integration Health and Error Logs ───────────────────
router.get('/integration/logs', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const type = req.query.type;
    const level = req.query.level;

    let query = db('integration_logs')
      .where({ society_id: req.societyId });

    if (type) query = query.where({ type });
    if (level) query = query.where({ level });

    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(limit);

    res.json({ logs });
  } catch (err) {
    console.error('Get integration logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve integration logs' });
  }
});

// ── 4. Charger Details ─────────────────────────────────────
router.get('/:chargerId', authenticate, enforceTenantIsolation, async (req, res) => {
  try {
    const charger = await db('chargers')
      .where({ id: req.params.chargerId, society_id: req.societyId })
      .first();

    if (!charger) {
      return res.status(404).json({ error: 'Charger not found' });
    }

    const connectors = await db('charger_connectors')
      .where({ charger_id: charger.id })
      .orderBy('connector_id', 'asc');

    // Active session
    const activeSession = await db('charging_sessions')
      .where({ charger_id: charger.id, status: 'active' })
      .first();

    // Today's bookings
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = await db('bookings')
      .where({ charger_id: charger.id, booking_date: today })
      .whereIn('status', ['upcoming', 'active'])
      .join('users', 'bookings.user_id', 'users.id')
      .select('bookings.*', 'users.name as user_name')
      .orderBy('start_time', 'asc');

    const isConnected = ocppService.isChargerConnected(charger.id);
    const connInfo = ocppService.getConnectionInfo(charger.id);

    res.json({
      charger: {
        ...(canSeeChargerSecrets(req) ? charger : stripChargerSecrets(charger)),
        status: chargerIntegrationService.liveStatus(charger),
        is_ocpp_connected: isConnected,
        connection_info: connInfo,
      },
      connectors,
      activeSession,
      todayBookings,
    });
  } catch (err) {
    console.error('Get charger error:', err);
    res.status(500).json({ error: 'Failed to get charger details' });
  }
});

// ── 5. Add Charger (Admin) ─────────────────────────────────
router.post('/', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const {
      charger_number, name, location_description,
      connector_type, price_per_kwh,
      vendor, manufacturer, model, ocpp_version,
      connector_count = 1, auth_key,
    } = req.body;

    // The dashboard's quick "Add charger" form sends power_output_kw / parking_slot
    const power_rating_kw = parseFloat(req.body.power_rating_kw ?? req.body.power_output_kw) || null;
    const parking_location = req.body.parking_location || req.body.parking_slot || null;

    // New chargers are real hardware unless the server runs in demo mode
    const requestedMode = String(req.body.integration_mode || '').toUpperCase();
    const integration_mode = ['DEMO', 'PRODUCTION'].includes(requestedMode)
      ? requestedMode
      : (config.demoMode ? 'DEMO' : 'PRODUCTION');

    if (!charger_number) {
      return res.status(400).json({ error: 'Charger number is required' });
    }

    // Check uniqueness
    const existing = await db('chargers')
      .where({ society_id: req.societyId, charger_number })
      .first();

    if (existing) {
      return res.status(409).json({ error: 'Charger number already exists in this society' });
    }

    const society = await db('societies').where({ id: req.societyId }).first();

    const [id] = await db('chargers').insert({
      society_id: req.societyId,
      charger_number,
      name: name || `Charger ${charger_number}`,
      location_description: location_description || parking_location || null,
      parking_location: parking_location || location_description || null,
      connector_type: connector_type || 'Type2',
      power_rating_kw: power_rating_kw || 7.4,
      price_per_kwh: price_per_kwh || society.default_price_per_kwh || 8.0,
      manufacturer: manufacturer || vendor || 'Schneider Electric',
      vendor: vendor || manufacturer || 'Schneider Electric',
      model: model || 'EVlink Pro AC',
      ocpp_version: ocpp_version || '1.6J',
      integration_mode,
      connector_count: parseInt(connector_count, 10) || 1,
      auth_key: auth_key || generateChargerAuthKey(),
      status: 'available',
      connectivity_status: integration_mode === 'DEMO' ? 'online' : 'offline',
      is_simulated: integration_mode !== 'PRODUCTION',
    });

    // Create connector 1
    await db('charger_connectors').insert({
      charger_id: id,
      connector_id: 1,
      connector_type: connector_type || 'Type2',
      status: 'Available',
      meter_reading_wh: 0,
    });

    // If dual connector, create connector 2
    if (parseInt(connector_count, 10) > 1) {
      await db('charger_connectors').insert({
        charger_id: id,
        connector_id: 2,
        connector_type: 'CCS2',
        status: 'Available',
        meter_reading_wh: 0,
      });
    }

    const charger = await db('chargers').where({ id }).first();
    const connectors = await db('charger_connectors').where({ charger_id: id }).select('*');

    res.status(201).json({ charger: { ...charger, connectors } });
  } catch (err) {
    console.error('Add charger error:', err);
    res.status(500).json({ error: 'Failed to add charger' });
  }
});

// ── 6. Update Charger (Admin) ──────────────────────────────
router.put('/:chargerId', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const charger = await db('chargers')
      .where({ id: req.params.chargerId, society_id: req.societyId })
      .first();

    if (!charger) {
      return res.status(404).json({ error: 'Charger not found' });
    }

    const allowedFields = [
      'charger_number', 'name', 'location_description', 'parking_location',
      'connector_type', 'power_rating_kw', 'price_per_kwh', 'status',
      'manufacturer', 'vendor', 'model', 'ocpp_version', 'integration_mode',
      'connector_count', 'auth_key', 'connectivity_status',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Keep is_simulated aligned with integration_mode
    if (updates.integration_mode) {
      updates.is_simulated = updates.integration_mode !== 'PRODUCTION';
    }

    updates.updated_at = db.fn.now();

    await db('chargers').where({ id: charger.id }).update(updates);
    const updated = await db('chargers').where({ id: charger.id }).first();
    const connectors = await db('charger_connectors').where({ charger_id: charger.id }).select('*');

    res.json({ charger: { ...updated, connectors } });
  } catch (err) {
    console.error('Update charger error:', err);
    res.status(500).json({ error: 'Failed to update charger' });
  }
});

// ── 7. Send Charger Hardware Command (Admin) ───────────────
router.post('/:chargerId/command', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const { command, type = 'Soft', connectorId = 1 } = req.body;
    const chargerId = parseInt(req.params.chargerId, 10);

    if (command === 'Reset') {
      const result = await chargerIntegrationService.resetCharger({
        chargerId,
        societyId: req.societyId,
        userId: req.user.id,
        type,
      });
      return res.json({ success: true, result });
    } else if (command === 'UnlockConnector') {
      const result = await chargerIntegrationService.unlockConnector({
        chargerId,
        connectorId: parseInt(connectorId, 10) || 1,
        societyId: req.societyId,
        userId: req.user.id,
      });
      return res.json({ success: true, result });
    } else {
      return res.status(400).json({ error: `Unsupported command '${command}'` });
    }
  } catch (err) {
    console.error('Charger command error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── 8. Charger Diagnostics & Audit Trail (Admin) ───────────
router.get('/:chargerId/diagnostics', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const diagnostics = await chargerIntegrationService.getDiagnostics(parseInt(req.params.chargerId, 10));
    res.json(diagnostics);
  } catch (err) {
    console.error('Diagnostics error:', err);
    res.status(500).json({ error: 'Failed to retrieve diagnostics' });
  }
});

// ── 9. Deactivate Charger (Admin) ──────────────────────────
router.delete('/:chargerId', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const charger = await db('chargers')
      .where({ id: req.params.chargerId, society_id: req.societyId })
      .first();

    if (!charger) {
      return res.status(404).json({ error: 'Charger not found' });
    }

    const activeSession = await db('charging_sessions')
      .where({ charger_id: charger.id, status: 'active' })
      .first();

    if (activeSession) {
      return res.status(400).json({ error: 'Cannot remove charger with an active charging session' });
    }

    await db('chargers').where({ id: charger.id }).update({
      status: 'offline',
      connectivity_status: 'offline',
      updated_at: db.fn.now(),
    });

    res.json({ message: 'Charger deactivated' });
  } catch (err) {
    console.error('Delete charger error:', err);
    res.status(500).json({ error: 'Failed to deactivate charger' });
  }
});

module.exports = router;

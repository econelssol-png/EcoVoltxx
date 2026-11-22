/**
 * Seed Charger Connectors & Integration Configs
 */

const crypto = require('crypto');

exports.seed = async function (knex) {
  // Ensure societies have integration configs
  const societies = await knex('societies').select('id');
  for (const s of societies) {
    const existingConfig = await knex('charger_integration_configs').where({ society_id: s.id }).first();
    if (!existingConfig) {
      await knex('charger_integration_configs').insert({
        society_id: s.id,
        ocpp_server_ws_url: `ws://localhost:3000/ocpp`,
        heartbeat_interval_seconds: 60,
        connection_timeout_seconds: 30,
        default_mode: 'DEMO',
        auth_required: false,
        notes: 'Standard EcoVoltX OCPP 1.6-J Central System gateway',
      });
    }
  }

  // Ensure each charger has connectors
  const chargers = await knex('chargers').select('*');
  for (const c of chargers) {
    // Update charger details if not set
    await knex('chargers').where({ id: c.id }).update({
      vendor: c.vendor || (c.power_rating_kw > 15 ? 'ABB E-mobility' : 'Schneider Electric'),
      model: c.model || (c.power_rating_kw > 15 ? 'Terra 24 DC' : 'EVlink Smart AC'),
      ocpp_version: c.ocpp_version || '1.6J',
      integration_mode: c.integration_mode || 'DEMO',
      connector_count: c.connector_count || (c.id === 2 ? 2 : 1),
      parking_location: c.parking_location || c.location_description || `Bay #${c.charger_number}`,
      connectivity_status: c.connectivity_status === 'unknown' ? (c.status === 'offline' ? 'offline' : 'online') : c.connectivity_status,
      meter_reading_wh: c.meter_reading_wh || (c.id * 14250),
      auth_key: c.auth_key || `ck_${crypto.randomBytes(24).toString('hex')}`,
    });

    const conn1 = await knex('charger_connectors').where({ charger_id: c.id, connector_id: 1 }).first();
    if (!conn1) {
      await knex('charger_connectors').insert({
        charger_id: c.id,
        connector_id: 1,
        connector_type: c.connector_type || 'Type2',
        status: c.status === 'charging' ? 'Charging' : (c.status === 'offline' ? 'Unavailable' : 'Available'),
        meter_reading_wh: c.meter_reading_wh || (c.id * 14250),
      });
    }

    if (c.id === 2 || c.connector_count === 2) {
      const conn2 = await knex('charger_connectors').where({ charger_id: c.id, connector_id: 2 }).first();
      if (!conn2) {
        await knex('charger_connectors').insert({
          charger_id: c.id,
          connector_id: 2,
          connector_type: 'CCS2',
          status: 'Available',
          meter_reading_wh: 5200,
        });
      }
    }
  }

  // Add sample integration logs if empty
  const logCount = await knex('integration_logs').count('id as count').first();
  if (parseInt(logCount?.count || 0) === 0) {
    await knex('integration_logs').insert([
      {
        society_id: 1,
        charger_id: 1,
        type: 'ocpp_event',
        level: 'info',
        source: 'ocpp_server',
        message: 'Charger C-01 connected to Central System via OCPP 1.6-J',
        details: JSON.stringify({ event: 'BootNotification', status: 'Accepted', firmware: 'v2.4.1-prod' }),
      },
      {
        society_id: 1,
        charger_id: 1,
        type: 'ocpp_event',
        level: 'info',
        source: 'ocpp_server',
        message: 'Heartbeat received from C-01 (latency 14ms)',
        details: JSON.stringify({ interval: 60 }),
      },
      {
        society_id: 1,
        charger_id: 2,
        type: 'ocpp_event',
        level: 'info',
        source: 'ocpp_server',
        message: 'StatusNotification: Connector 1 Available, Connector 2 Available',
        details: JSON.stringify({ connectorId: 1, status: 'Available' }),
      },
      {
        society_id: 1,
        type: 'payment_webhook',
        level: 'info',
        source: 'payment_gateway',
        message: 'Payment gateway adapter initialized (Mode: Test/Mock Active)',
        details: JSON.stringify({ provider: 'razorpay', test_mode: true }),
      },
    ]);
  }
};

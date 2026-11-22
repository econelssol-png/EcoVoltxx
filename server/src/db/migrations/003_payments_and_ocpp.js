/**
 * Add Payments and OCPP Charger Integration Schema
 * 
 * Expands payments table with transaction references, order references, refund support,
 * test mode tracking, and relations to bookings and sessions.
 * 
 * Expands chargers table with physical OCPP hardware metadata, vendor, model,
 * connector IDs, integration mode (DEMO vs PRODUCTION), and adds tables for:
 * - charger_connectors
 * - charger_commands_audit
 * - charger_integration_configs
 * - integration_logs
 */

exports.up = async function (knex) {
  // ── 1. Enhance Payments Table ──────────────────────────
  const paymentsHasBooking = await knex.schema.hasColumn('payments', 'booking_id');
  if (!paymentsHasBooking) {
    await knex.schema.alterTable('payments', (t) => {
      t.integer('booking_id').unsigned().nullable();
      t.integer('session_id').unsigned().nullable();
      t.string('transaction_reference', 100).nullable();
      t.string('order_reference', 100).nullable();
      t.string('currency', 10).notNullable().defaultTo('INR');
      t.boolean('is_test').notNullable().defaultTo(true);
      t.string('gateway_provider', 50).notNullable().defaultTo('razorpay');
      t.string('refund_status', 30).notNullable().defaultTo('none'); // 'none', 'requested', 'processed', 'failed'
      t.decimal('refund_amount', 10, 2).notNullable().defaultTo(0);
      t.string('refund_id', 100).nullable();
      t.text('failure_reason').nullable();
      t.text('metadata').nullable(); // JSON stringified extra details
    });
  }

  // ── 2. Enhance Chargers Table ──────────────────────────
  const chargersHasVendor = await knex.schema.hasColumn('chargers', 'vendor');
  if (!chargersHasVendor) {
    await knex.schema.alterTable('chargers', (t) => {
      t.string('vendor', 100).nullable().defaultTo('EcoVoltX');
      t.string('model', 100).nullable().defaultTo('EVX-Smart-7');
      t.string('ocpp_version', 20).notNullable().defaultTo('1.6J');
      t.string('integration_mode', 20).notNullable().defaultTo('DEMO'); // 'DEMO' or 'PRODUCTION'
      t.integer('connector_count').notNullable().defaultTo(1);
      t.string('parking_location', 150).nullable();
      t.string('connectivity_status', 30).notNullable().defaultTo('unknown'); // 'online', 'offline', 'unknown'
      t.string('auth_key', 255).nullable(); // Charger connection authentication key
      t.decimal('meter_reading_wh', 14, 2).notNullable().defaultTo(0);
      t.string('firmware_version', 50).nullable();
      t.string('error_code', 50).nullable();
    });
  }

  // ── 3. Charger Connectors Table ────────────────────────
  const hasConnectors = await knex.schema.hasTable('charger_connectors');
  if (!hasConnectors) {
    await knex.schema.createTable('charger_connectors', (t) => {
      t.increments('id').primary();
      t.integer('charger_id').unsigned().notNullable()
        .references('id').inTable('chargers').onDelete('CASCADE');
      t.integer('connector_id').notNullable().defaultTo(1); // 1, 2...
      t.string('connector_type', 50).notNullable().defaultTo('Type2');
      t.string('status', 30).notNullable().defaultTo('Available'); // Available, Preparing, Charging, Faulted, Unavailable, Reserved
      t.integer('current_session_id').unsigned().nullable();
      t.decimal('meter_reading_wh', 14, 2).notNullable().defaultTo(0);
      t.timestamp('last_status_time').nullable().defaultTo(knex.fn.now());
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.unique(['charger_id', 'connector_id']);
      t.index('charger_id');
      t.index('status');
    });
  }

  // ── 4. Charger Commands Audit Table ────────────────────
  const hasAudit = await knex.schema.hasTable('charger_commands_audit');
  if (!hasAudit) {
    await knex.schema.createTable('charger_commands_audit', (t) => {
      t.increments('id').primary();
      t.integer('charger_id').unsigned().notNullable()
        .references('id').inTable('chargers').onDelete('CASCADE');
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.integer('user_id').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      t.string('command', 50).notNullable(); // RemoteStartTransaction, RemoteStopTransaction, Reset, UnlockConnector
      t.integer('connector_id').nullable().defaultTo(1);
      t.text('payload').nullable(); // JSON
      t.string('status', 30).notNullable().defaultTo('pending'); // pending, accepted, rejected, timeout, failed
      t.text('response').nullable(); // JSON
      t.timestamp('sent_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('completed_at').nullable();

      t.index('charger_id');
      t.index('society_id');
      t.index('status');
    });
  }

  // ── 5. Charger Integration Configs Table ───────────────
  const hasConfigs = await knex.schema.hasTable('charger_integration_configs');
  if (!hasConfigs) {
    await knex.schema.createTable('charger_integration_configs', (t) => {
      t.increments('id').primary();
      t.integer('society_id').unsigned().notNullable().unique()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.string('ocpp_server_ws_url', 255).nullable();
      t.integer('heartbeat_interval_seconds').notNullable().defaultTo(60);
      t.integer('connection_timeout_seconds').notNullable().defaultTo(30);
      t.string('default_mode', 20).notNullable().defaultTo('DEMO'); // 'DEMO' or 'PRODUCTION'
      t.boolean('auth_required').notNullable().defaultTo(false);
      t.text('notes').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.index('society_id');
    });
  }

  // ── 6. Integration Logs Table ──────────────────────────
  const hasLogs = await knex.schema.hasTable('integration_logs');
  if (!hasLogs) {
    await knex.schema.createTable('integration_logs', (t) => {
      t.increments('id').primary();
      t.integer('society_id').unsigned().nullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.integer('charger_id').unsigned().nullable()
        .references('id').inTable('chargers').onDelete('SET NULL');
      t.string('type', 50).notNullable(); // ocpp_event, ocpp_error, payment_webhook, payment_error, command
      t.string('level', 20).notNullable().defaultTo('info'); // info, warn, error
      t.string('source', 50).notNullable().defaultTo('ocpp_server'); // ocpp_server, payment_gateway, simulator
      t.text('message').notNullable();
      t.text('details').nullable(); // JSON
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      t.index('society_id');
      t.index('charger_id');
      t.index('type');
      t.index('level');
      t.index('created_at');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('integration_logs');
  await knex.schema.dropTableIfExists('charger_integration_configs');
  await knex.schema.dropTableIfExists('charger_commands_audit');
  await knex.schema.dropTableIfExists('charger_connectors');

  // Reverse chargers columns
  const chargersHasVendor = await knex.schema.hasColumn('chargers', 'vendor');
  if (chargersHasVendor) {
    await knex.schema.alterTable('chargers', (t) => {
      t.dropColumn('vendor');
      t.dropColumn('model');
      t.dropColumn('ocpp_version');
      t.dropColumn('integration_mode');
      t.dropColumn('connector_count');
      t.dropColumn('parking_location');
      t.dropColumn('connectivity_status');
      t.dropColumn('auth_key');
      t.dropColumn('meter_reading_wh');
      t.dropColumn('firmware_version');
      t.dropColumn('error_code');
    });
  }

  // Reverse payments columns
  const paymentsHasBooking = await knex.schema.hasColumn('payments', 'booking_id');
  if (paymentsHasBooking) {
    await knex.schema.alterTable('payments', (t) => {
      t.dropColumn('booking_id');
      t.dropColumn('session_id');
      t.dropColumn('transaction_reference');
      t.dropColumn('order_reference');
      t.dropColumn('currency');
      t.dropColumn('is_test');
      t.dropColumn('gateway_provider');
      t.dropColumn('refund_status');
      t.dropColumn('refund_amount');
      t.dropColumn('refund_id');
      t.dropColumn('failure_reason');
      t.dropColumn('metadata');
    });
  }
};

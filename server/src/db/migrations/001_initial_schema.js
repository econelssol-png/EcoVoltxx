/**
 * SocietyCharge — Complete Database Schema
 * 
 * Multi-tenant EV charging platform.
 * Every society-scoped table includes society_id for tenant isolation.
 */

exports.up = function (knex) {
  return knex.schema

    // ── Users ──────────────────────────────────────────────
    .createTable('users', (t) => {
      t.increments('id').primary();
      t.string('email', 255).notNullable().unique();
      t.string('phone', 20).nullable();
      t.string('password_hash', 255).notNullable();
      t.string('name', 255).notNullable();
      t.enum('role', ['super_admin', 'user']).notNullable().defaultTo('user');
      t.string('avatar_url', 500).nullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })

    // ── Societies ──────────────────────────────────────────
    .createTable('societies', (t) => {
      t.increments('id').primary();
      t.string('name', 255).notNullable();
      t.string('code', 20).notNullable().unique();
      t.string('address', 500).nullable();
      t.string('city', 100).nullable();
      t.string('state', 100).nullable();
      t.string('pincode', 10).nullable();
      t.text('description').nullable();
      t.enum('status', ['active', 'inactive']).notNullable().defaultTo('active');
      t.integer('max_chargers').notNullable().defaultTo(50);
      t.decimal('default_price_per_kwh', 10, 2).notNullable().defaultTo(8.0);
      t.json('settings').nullable(); // flexible JSON settings
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    })

    // ── Society Members (join table with role + status) ───
    .createTable('society_members', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.string('flat_number', 20).nullable();
      t.enum('role', ['resident', 'admin']).notNullable().defaultTo('resident');
      t.enum('status', ['pending', 'approved', 'rejected', 'disabled']).notNullable().defaultTo('pending');
      t.timestamp('joined_at').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.unique(['user_id', 'society_id']);
      t.index('society_id');
    })

    // ── Vehicles ───────────────────────────────────────────
    .createTable('vehicles', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      t.string('make', 100).notNullable();       // e.g. Tata
      t.string('model', 100).notNullable();       // e.g. Nexon EV
      t.integer('year').nullable();
      t.string('registration_number', 20).nullable();
      t.decimal('battery_capacity_kwh', 10, 2).nullable();
      t.string('connector_type', 50).nullable();  // Type2, CCS, CHAdeMO
      t.string('color', 30).nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.index('user_id');
    })

    // ── Chargers ───────────────────────────────────────────
    .createTable('chargers', (t) => {
      t.increments('id').primary();
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.string('charger_number', 20).notNullable(); // C-01, C-02
      t.string('name', 100).nullable();
      t.string('location_description', 255).nullable();
      t.decimal('latitude', 10, 7).nullable();
      t.decimal('longitude', 10, 7).nullable();
      t.string('connector_type', 50).notNullable().defaultTo('Type2');
      t.decimal('power_rating_kw', 10, 2).notNullable().defaultTo(7.4);
      t.decimal('price_per_kwh', 10, 2).notNullable().defaultTo(8.0);
      t.enum('status', ['available', 'charging', 'maintenance', 'offline'])
        .notNullable().defaultTo('available');
      t.string('manufacturer', 100).nullable();
      t.string('serial_number', 100).nullable();
      t.string('ocpp_id', 100).nullable(); // for future OCPP integration
      t.boolean('is_simulated').notNullable().defaultTo(true);
      t.timestamp('last_heartbeat').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.unique(['society_id', 'charger_number']);
      t.index('society_id');
      t.index('status');
    })

    // ── Bookings ───────────────────────────────────────────
    .createTable('bookings', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.integer('charger_id').unsigned().notNullable()
        .references('id').inTable('chargers').onDelete('CASCADE');
      t.date('booking_date').notNullable();
      t.string('start_time', 5).notNullable(); // HH:MM
      t.string('end_time', 5).notNullable();   // HH:MM
      t.enum('status', ['upcoming', 'active', 'completed', 'cancelled'])
        .notNullable().defaultTo('upcoming');
      t.text('notes').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.index('society_id');
      t.index('charger_id');
      t.index('user_id');
      t.index(['charger_id', 'booking_date', 'status']);
    })

    // ── Charging Sessions ──────────────────────────────────
    .createTable('charging_sessions', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.integer('charger_id').unsigned().notNullable()
        .references('id').inTable('chargers').onDelete('CASCADE');
      t.integer('booking_id').unsigned().nullable()
        .references('id').inTable('bookings').onDelete('SET NULL');
      t.timestamp('start_time').notNullable();
      t.timestamp('end_time').nullable();
      t.decimal('energy_kwh', 10, 3).notNullable().defaultTo(0);
      t.decimal('cost', 10, 2).notNullable().defaultTo(0);
      t.decimal('price_per_kwh_at_time', 10, 2).notNullable(); // snapshot the rate
      t.decimal('power_rating_kw_at_time', 10, 2).notNullable();
      t.enum('status', ['active', 'completed', 'interrupted', 'error'])
        .notNullable().defaultTo('active');
      t.integer('duration_minutes').nullable();
      t.text('stop_reason').nullable();
      t.boolean('is_simulated').notNullable().defaultTo(true);
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.index('society_id');
      t.index('user_id');
      t.index('charger_id');
      t.index('status');
    })

    // ── Invoices ───────────────────────────────────────────
    .createTable('invoices', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.integer('month').notNullable();  // 1–12
      t.integer('year').notNullable();
      t.decimal('total_energy_kwh', 10, 3).notNullable().defaultTo(0);
      t.decimal('total_amount', 10, 2).notNullable().defaultTo(0);
      t.integer('session_count').notNullable().defaultTo(0);
      t.enum('status', ['pending', 'paid', 'overdue']).notNullable().defaultTo('pending');
      t.date('due_date').nullable();
      t.timestamp('paid_at').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.unique(['user_id', 'society_id', 'month', 'year']);
      t.index('society_id');
    })

    // ── Payments ───────────────────────────────────────────
    .createTable('payments', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      t.integer('invoice_id').unsigned().nullable()
        .references('id').inTable('invoices').onDelete('SET NULL');
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.decimal('amount', 10, 2).notNullable();
      t.string('method', 50).nullable();  // UPI, card, netbanking
      t.string('gateway_order_id', 255).nullable();
      t.string('gateway_payment_id', 255).nullable();
      t.string('gateway_signature', 500).nullable();
      t.enum('status', ['pending', 'success', 'failed', 'refunded'])
        .notNullable().defaultTo('pending');
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.index('society_id');
      t.index('user_id');
      t.index('invoice_id');
    })

    // ── Notifications ──────────────────────────────────────
    .createTable('notifications', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      t.integer('society_id').unsigned().nullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.string('title', 255).notNullable();
      t.text('message').notNullable();
      t.string('type', 50).notNullable(); // booking_reminder, charging_started, etc.
      t.boolean('read').notNullable().defaultTo(false);
      t.json('metadata').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      t.index('user_id');
      t.index('society_id');
    })

    // ── Complaints ─────────────────────────────────────────
    .createTable('complaints', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.integer('charger_id').unsigned().nullable()
        .references('id').inTable('chargers').onDelete('SET NULL');
      t.string('subject', 255).notNullable();
      t.text('description').notNullable();
      t.enum('status', ['open', 'in_progress', 'resolved', 'closed'])
        .notNullable().defaultTo('open');
      t.text('admin_response').nullable();
      t.timestamp('resolved_at').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.index('society_id');
      t.index('user_id');
    })

    // ── Maintenance Records ────────────────────────────────
    .createTable('maintenance_records', (t) => {
      t.increments('id').primary();
      t.integer('charger_id').unsigned().notNullable()
        .references('id').inTable('chargers').onDelete('CASCADE');
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.string('type', 50).notNullable(); // scheduled, emergency, repair
      t.text('description').nullable();
      t.timestamp('started_at').notNullable();
      t.timestamp('completed_at').nullable();
      t.enum('status', ['scheduled', 'in_progress', 'completed']).notNullable().defaultTo('scheduled');
      t.string('technician_name', 255).nullable();
      t.text('notes').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

      t.index('society_id');
      t.index('charger_id');
    })

    // ── Refresh Tokens ─────────────────────────────────────
    .createTable('refresh_tokens', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      t.string('token', 500).notNullable().unique();
      t.timestamp('expires_at').notNullable();
      t.boolean('revoked').notNullable().defaultTo(false);
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      t.index('user_id');
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('refresh_tokens')
    .dropTableIfExists('maintenance_records')
    .dropTableIfExists('complaints')
    .dropTableIfExists('notifications')
    .dropTableIfExists('payments')
    .dropTableIfExists('invoices')
    .dropTableIfExists('charging_sessions')
    .dropTableIfExists('bookings')
    .dropTableIfExists('chargers')
    .dropTableIfExists('vehicles')
    .dropTableIfExists('society_members')
    .dropTableIfExists('societies')
    .dropTableIfExists('users');
};

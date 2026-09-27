/**
 * Add Subscriptions Schema for EcoVoltX Admin Portal
 * Powered by EcoNelssol
 */

exports.up = async function (knex) {
  // Add subscription columns to societies table
  const hasCol = await knex.schema.hasColumn('societies', 'subscription_plan');
  if (!hasCol) {
    await knex.schema.alterTable('societies', (t) => {
      t.string('subscription_plan', 50).notNullable().defaultTo('pro');
      t.string('subscription_status', 50).notNullable().defaultTo('active');
      t.decimal('subscription_price_monthly', 10, 2).notNullable().defaultTo(4999.00);
      t.string('subscription_billing_cycle', 20).notNullable().defaultTo('monthly');
      t.timestamp('subscription_renews_at').nullable();
      t.integer('subscription_charger_limit').notNullable().defaultTo(10);
    });
  }

  // Create society subscription invoices table
  const hasInvoicesTable = await knex.schema.hasTable('society_subscription_invoices');
  if (!hasInvoicesTable) {
    await knex.schema.createTable('society_subscription_invoices', (t) => {
      t.increments('id').primary();
      t.integer('society_id').unsigned().notNullable()
        .references('id').inTable('societies').onDelete('CASCADE');
      t.string('invoice_number', 50).notNullable().unique();
      t.string('plan_name', 100).notNullable();
      t.decimal('amount', 10, 2).notNullable();
      t.string('billing_cycle', 20).notNullable().defaultTo('monthly');
      t.timestamp('period_start').notNullable();
      t.timestamp('period_end').notNullable();
      t.enum('status', ['paid', 'pending', 'failed']).notNullable().defaultTo('paid');
      t.timestamp('paid_at').nullable();
      t.string('payment_method', 50).nullable().defaultTo('Bank Transfer / UPI');
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      t.index('society_id');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('society_subscription_invoices');
  await knex.schema.alterTable('societies', (t) => {
    t.dropColumn('subscription_plan');
    t.dropColumn('subscription_status');
    t.dropColumn('subscription_price_monthly');
    t.dropColumn('subscription_billing_cycle');
    t.dropColumn('subscription_renews_at');
    t.dropColumn('subscription_charger_limit');
  });
};

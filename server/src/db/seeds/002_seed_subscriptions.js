/**
 * Seed Subscriptions for EcoVoltX Admin Portal
 * Powered by EcoNelssol
 */

exports.seed = async function (knex) {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  // Update Society 1 (Green Valley Residency)
  await knex('societies').where({ id: 1 }).update({
    subscription_plan: 'pro',
    subscription_status: 'active',
    subscription_price_monthly: 4999.00,
    subscription_billing_cycle: 'monthly',
    subscription_renews_at: nextMonth,
    subscription_charger_limit: 10,
  });

  // Update Society 2 (Sunrise Towers)
  await knex('societies').where({ id: 2 }).update({
    subscription_plan: 'starter',
    subscription_status: 'active',
    subscription_price_monthly: 1999.00,
    subscription_billing_cycle: 'monthly',
    subscription_renews_at: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000).toISOString(),
    subscription_charger_limit: 3,
  });

  // Clear existing subscription invoices
  await knex('society_subscription_invoices').del();

  // Insert sample past invoices
  await knex('society_subscription_invoices').insert([
    {
      society_id: 1,
      invoice_number: 'EVX-SUB-2026-001',
      plan_name: 'Pro Society Tier (Up to 10 Chargers)',
      amount: 4999.00,
      billing_cycle: 'monthly',
      period_start: twoMonthsAgo,
      period_end: lastMonth,
      status: 'paid',
      paid_at: twoMonthsAgo,
      payment_method: 'Corporate UPI / Auto-Debit',
    },
    {
      society_id: 1,
      invoice_number: 'EVX-SUB-2026-002',
      plan_name: 'Pro Society Tier (Up to 10 Chargers)',
      amount: 4999.00,
      billing_cycle: 'monthly',
      period_start: lastMonth,
      period_end: now.toISOString(),
      status: 'paid',
      paid_at: lastMonth,
      payment_method: 'Corporate UPI / Auto-Debit',
    },
    {
      society_id: 2,
      invoice_number: 'EVX-SUB-2026-003',
      plan_name: 'Starter Community Tier (Up to 3 Chargers)',
      amount: 1999.00,
      billing_cycle: 'monthly',
      period_start: lastMonth,
      period_end: now.toISOString(),
      status: 'paid',
      paid_at: lastMonth,
      payment_method: 'Net Banking HDFC',
    },
  ]);

  console.log('[Seed] Subscriptions seeded for EcoVoltX!');
};

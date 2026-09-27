/**
 * Subscription Management Routes for EcoVoltX Admin Portal
 * Powered by EcoNelssol
 * 
 * Multi-tier SaaS subscription plans for residential societies.
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireSocietyAdmin } = require('../middleware/rbac');
const { enforceTenantIsolation } = require('../middleware/tenantIsolation');

const router = express.Router({ mergeParams: true });

// Available EcoVoltX Subscription Plans
const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter Community',
    price_monthly: 1999,
    price_annual: 19190, // ~20% discount
    max_chargers: 3,
    description: 'Perfect for small gated communities starting their EV journey.',
    features: [
      'Up to 3 EV Chargers',
      'Resident Mobile App Access',
      'Real-Time Charger Availability',
      'Slot Booking System',
      'Standard Flat Electricity Tariff',
      'Community Email Support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro Society (Recommended)',
    price_monthly: 4999,
    price_annual: 47990,
    max_chargers: 10,
    popular: true,
    description: 'Advanced automation, dynamic tariffs, and load insights for thriving residential complexes.',
    features: [
      'Up to 10 EV Chargers',
      'All Starter Features',
      'TOD (Time-Of-Day) Dynamic Tariffs',
      'Automated Idle Penalty Fees',
      'Resident Push & In-App Announcements',
      'Monthly Auto-Invoicing & Billing Logs',
      'Priority Admin Phone & Chat Support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Grid',
    price_monthly: 9999,
    price_annual: 95990,
    max_chargers: 50,
    description: 'Complete EV charging infrastructure for mega-townships and commercial residential parks.',
    features: [
      'Up to 50 Chargers (Custom Scaling)',
      'All Pro Features',
      'Smart Grid Load Balancing & Peak Shaving',
      'RFID & OCPP 1.6J/2.0 Integration',
      'Custom ERP/Accounting Webhooks & API',
      'Dedicated Account Manager & 24/7 SLA',
      'Custom Society Co-Branding with EcoNelssol',
    ],
  },
};

// ── GET Society Subscription Details ──────────────────────
router.get('/', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const society = await db('societies').where({ id: req.societyId }).first();
    if (!society) {
      return res.status(404).json({ error: 'Society not found' });
    }

    const currentPlanId = society.subscription_plan || 'pro';
    const planInfo = PLANS[currentPlanId] || PLANS.pro;

    // Get live usage statistics
    const chargersCount = await db('chargers').where({ society_id: req.societyId }).count('id as count').first();
    const residentsCount = await db('society_members')
      .where({ society_id: req.societyId, status: 'approved' })
      .count('id as count').first();

    // Past subscription invoices
    const invoices = await db('society_subscription_invoices')
      .where({ society_id: req.societyId })
      .orderBy('created_at', 'desc');

    res.json({
      subscription: {
        plan_id: currentPlanId,
        plan_name: planInfo.name,
        status: society.subscription_status || 'active',
        billing_cycle: society.subscription_billing_cycle || 'monthly',
        price: parseFloat(society.subscription_price_monthly || planInfo.price_monthly),
        renews_at: society.subscription_renews_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        charger_limit: society.subscription_charger_limit || planInfo.max_chargers,
        features: planInfo.features,
      },
      usage: {
        active_chargers: chargersCount.count,
        max_chargers: society.subscription_charger_limit || planInfo.max_chargers,
        approved_residents: residentsCount.count,
      },
      available_plans: Object.values(PLANS),
      invoices,
    });
  } catch (err) {
    console.error('Subscription details error:', err);
    res.status(500).json({ error: 'Failed to get subscription details' });
  }
});

// ── POST Upgrade / Change Subscription Plan ───────────────
router.post('/upgrade', authenticate, enforceTenantIsolation, requireSocietyAdmin, async (req, res) => {
  try {
    const { plan_id, billing_cycle = 'monthly', payment_method = 'Corporate UPI' } = req.body;

    const targetPlan = PLANS[plan_id];
    if (!targetPlan) {
      return res.status(400).json({ error: 'Invalid subscription plan selected' });
    }

    const price = billing_cycle === 'annual' ? targetPlan.price_annual : targetPlan.price_monthly;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + (billing_cycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000);

    // Update society record
    await db('societies').where({ id: req.societyId }).update({
      subscription_plan: targetPlan.id,
      subscription_status: 'active',
      subscription_price_monthly: targetPlan.price_monthly,
      subscription_billing_cycle: billing_cycle,
      subscription_renews_at: periodEnd.toISOString(),
      subscription_charger_limit: targetPlan.max_chargers,
      updated_at: db.fn.now(),
    });

    // Generate subscription invoice
    const invCount = await db('society_subscription_invoices').count('id as count').first();
    const invoiceNumber = `EVX-SUB-${now.getFullYear()}-${String(invCount.count + 1).padStart(4, '0')}`;

    const [invoiceId] = await db('society_subscription_invoices').insert({
      society_id: req.societyId,
      invoice_number: invoiceNumber,
      plan_name: `${targetPlan.name} (${billing_cycle.toUpperCase()})`,
      amount: price,
      billing_cycle,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      status: 'paid',
      paid_at: now.toISOString(),
      payment_method,
    });

    const createdInvoice = await db('society_subscription_invoices').where({ id: invoiceId }).first();

    res.json({
      message: `Successfully upgraded to ${targetPlan.name}!`,
      subscription: {
        plan_id: targetPlan.id,
        plan_name: targetPlan.name,
        billing_cycle,
        price,
        renews_at: periodEnd.toISOString(),
      },
      invoice: createdInvoice,
    });
  } catch (err) {
    console.error('Subscription upgrade error:', err);
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

// ── GET Super Admin Global Subscription Overview ──────────
router.get('/platform/overview', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const societies = await db('societies').select('*');

    let totalMRR = 0;
    const planCounts = { starter: 0, pro: 0, enterprise: 0 };

    const enriched = await Promise.all(
      societies.map(async (s) => {
        const planId = s.subscription_plan || 'pro';
        const plan = PLANS[planId] || PLANS.pro;
        const monthlyAmount = parseFloat(s.subscription_price_monthly || plan.price_monthly);

        if (s.subscription_status === 'active') {
          totalMRR += monthlyAmount;
          planCounts[planId] = (planCounts[planId] || 0) + 1;
        }

        const chargers = await db('chargers').where({ society_id: s.id }).count('id as count').first();
        const members = await db('society_members').where({ society_id: s.id, status: 'approved' }).count('id as count').first();

        return {
          id: s.id,
          name: s.name,
          code: s.code,
          city: s.city,
          plan_id: planId,
          plan_name: plan.name,
          status: s.subscription_status || 'active',
          price_monthly: monthlyAmount,
          billing_cycle: s.subscription_billing_cycle || 'monthly',
          renews_at: s.subscription_renews_at,
          charger_limit: s.subscription_charger_limit || plan.max_chargers,
          chargers_count: chargers.count,
          members_count: members.count,
        };
      })
    );

    res.json({
      metrics: {
        total_mrr: totalMRR,
        total_arr: totalMRR * 12,
        active_subscriptions: societies.filter((s) => s.subscription_status === 'active').length,
        plan_breakdown: planCounts,
      },
      societies: enriched,
      plans: Object.values(PLANS),
    });
  } catch (err) {
    console.error('Super admin subscriptions error:', err);
    res.status(500).json({ error: 'Failed to get platform subscriptions' });
  }
});

module.exports = router;

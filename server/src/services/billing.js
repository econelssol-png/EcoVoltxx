/**
 * Billing Service
 * 
 * Generates monthly invoices from completed charging sessions.
 */

const db = require('../db/knex');

/**
 * Generate invoices for a society for a given month/year.
 * Creates one invoice per resident who had charging sessions.
 */
async function generateMonthlyInvoices(societyId, month, year) {
  // Get all completed sessions for this month that don't have an invoice yet
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

  const sessions = await db('charging_sessions')
    .where({ society_id: societyId, status: 'completed' })
    .whereBetween('start_time', [startDate, endDate])
    .select('*');

  // Group sessions by user
  const userSessions = {};
  for (const session of sessions) {
    if (!userSessions[session.user_id]) {
      userSessions[session.user_id] = [];
    }
    userSessions[session.user_id].push(session);
  }

  const invoices = [];

  for (const [userId, userSessionList] of Object.entries(userSessions)) {
    const totalEnergy = userSessionList.reduce((sum, s) => sum + parseFloat(s.energy_kwh), 0);
    const totalAmount = userSessionList.reduce((sum, s) => sum + parseFloat(s.cost), 0);

    // Check if invoice already exists
    const existing = await db('invoices')
      .where({ user_id: parseInt(userId), society_id: societyId, month, year })
      .first();

    if (existing) {
      // Update existing invoice
      await db('invoices')
        .where({ id: existing.id })
        .update({
          total_energy_kwh: parseFloat(totalEnergy.toFixed(3)),
          total_amount: parseFloat(totalAmount.toFixed(2)),
          session_count: userSessionList.length,
          updated_at: db.fn.now(),
        });
      invoices.push({ ...existing, total_energy_kwh: totalEnergy, total_amount: totalAmount });
    } else {
      // Create new invoice
      const dueDate = new Date(year, month, 15); // Due 15th of next month
      const [id] = await db('invoices').insert({
        user_id: parseInt(userId),
        society_id: societyId,
        month,
        year,
        total_energy_kwh: parseFloat(totalEnergy.toFixed(3)),
        total_amount: parseFloat(totalAmount.toFixed(2)),
        session_count: userSessionList.length,
        status: 'pending',
        due_date: dueDate.toISOString().split('T')[0],
      });

      invoices.push({
        id,
        user_id: parseInt(userId),
        total_energy_kwh: totalEnergy,
        total_amount: totalAmount,
        session_count: userSessionList.length,
      });
    }
  }

  return invoices;
}

/**
 * Get billing summary for a user in a society
 */
async function getUserBillingSummary(userId, societyId) {
  const invoices = await db('invoices')
    .where({ user_id: userId, society_id: societyId })
    .orderBy([{ column: 'year', order: 'desc' }, { column: 'month', order: 'desc' }])
    .select('*');

  // Get current month's active/completed sessions that may not be invoiced yet
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const currentSessions = await db('charging_sessions')
    .where({ user_id: userId, society_id: societyId })
    .where('start_time', '>=', monthStart)
    .whereIn('status', ['active', 'completed'])
    .select('*');

  const currentMonthEnergy = currentSessions.reduce((sum, s) => sum + parseFloat(s.energy_kwh), 0);
  const currentMonthCost = currentSessions.reduce((sum, s) => sum + parseFloat(s.cost), 0);

  return {
    invoices,
    currentMonth: {
      energy_kwh: parseFloat(currentMonthEnergy.toFixed(3)),
      amount: parseFloat(currentMonthCost.toFixed(2)),
      session_count: currentSessions.length,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    },
  };
}

module.exports = { generateMonthlyInvoices, getUserBillingSummary };

/**
 * Tenant Isolation Middleware
 * 
 * Ensures every society-scoped request is validated:
 * 1. The society exists and is active
 * 2. The requesting user belongs to (or administers) that society
 * 3. Attaches req.society for downstream use
 * 
 * Super admins bypass membership checks but still require valid society.
 */

const db = require('../db/knex');

/**
 * Validate society exists and is active, attach to req.society
 */
async function validateSociety(req, res, next) {
  const societyId = parseInt(req.params.societyId || req.params.id, 10);
  if (!societyId || isNaN(societyId)) {
    return res.status(400).json({ error: 'Valid society ID required' });
  }

  try {
    const society = await db('societies').where({ id: societyId }).first();

    if (!society) {
      return res.status(404).json({ error: 'Society not found' });
    }

    if (society.status !== 'active' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'This society is currently inactive' });
    }

    req.society = society;
    req.societyId = societyId;
    next();
  } catch (err) {
    console.error('Society validation error:', err);
    res.status(500).json({ error: 'Failed to validate society' });
  }
}

/**
 * Full tenant isolation: validate society + verify membership
 */
async function enforceTenantIsolation(req, res, next) {
  const societyId = parseInt(req.params.societyId || req.params.id, 10);
  if (!societyId || isNaN(societyId)) {
    return res.status(400).json({ error: 'Valid society ID required' });
  }

  try {
    const society = await db('societies').where({ id: societyId }).first();

    if (!society) {
      return res.status(404).json({ error: 'Society not found' });
    }

    if (society.status !== 'active' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'This society is currently inactive' });
    }

    req.society = society;
    req.societyId = societyId;

    // Super admins can access any society
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Verify the user is an approved member of this society
    const membership = await db('society_members')
      .where({ user_id: req.user.id, society_id: societyId, status: 'approved' })
      .first();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied: you are not a member of this society' });
    }

    req.societyMember = membership;
    next();
  } catch (err) {
    console.error('Tenant isolation error:', err);
    res.status(500).json({ error: 'Tenant validation failed' });
  }
}

module.exports = { validateSociety, enforceTenantIsolation };

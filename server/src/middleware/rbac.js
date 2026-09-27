/**
 * Role-Based Access Control Middleware
 * 
 * Restricts access based on user.role (super_admin, user)
 * and society membership role (admin, resident).
 */

const db = require('../db/knex');

/**
 * Require specific platform-level roles
 * Usage: requireRole('super_admin')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Require society admin role for the given society
 * Checks society_members table for admin role + approved status.
 * Also allows super_admin through.
 */
function requireSocietyAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Super admins can access any society's admin endpoints
  if (req.user.role === 'super_admin') {
    return next();
  }

  const societyId = parseInt(req.params.societyId || req.params.id, 10);
  if (!societyId) {
    return res.status(400).json({ error: 'Society ID required' });
  }

  db('society_members')
    .where({ user_id: req.user.id, society_id: societyId, role: 'admin', status: 'approved' })
    .first()
    .then((member) => {
      if (!member) {
        return res.status(403).json({ error: 'Society admin access required' });
      }
      req.societyMember = member;
      next();
    })
    .catch((err) => {
      console.error('RBAC error:', err);
      res.status(500).json({ error: 'Authorization check failed' });
    });
}

/**
 * Require at least society membership (resident or admin)
 * Also allows super_admin through.
 */
function requireSocietyMember(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role === 'super_admin') {
    return next();
  }

  const societyId = parseInt(req.params.societyId || req.params.id, 10);
  if (!societyId) {
    return res.status(400).json({ error: 'Society ID required' });
  }

  db('society_members')
    .where({ user_id: req.user.id, society_id: societyId, status: 'approved' })
    .first()
    .then((member) => {
      if (!member) {
        return res.status(403).json({ error: 'You are not a member of this society' });
      }
      req.societyMember = member;
      next();
    })
    .catch((err) => {
      console.error('RBAC error:', err);
      res.status(500).json({ error: 'Authorization check failed' });
    });
}

module.exports = { requireRole, requireSocietyAdmin, requireSocietyMember };

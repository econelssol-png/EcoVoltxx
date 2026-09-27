/**
 * Notification Routes
 * 
 * GET  /api/notifications           — list user notifications
 * PUT  /api/notifications/:id/read  — mark as read
 * PUT  /api/notifications/read-all  — mark all as read
 */

const express = require('express');
const db = require('../db/knex');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── List notifications ──────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const notifications = await db('notifications')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const unreadCount = await db('notifications')
      .where({ user_id: req.user.id, read: false })
      .count('id as count')
      .first();

    res.json({
      notifications,
      unread_count: unreadCount.count,
      page,
      limit,
    });
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

// ── Mark single notification as read ────────────────────
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await db('notifications')
      .where({ id: req.params.id, user_id: req.user.id })
      .update({ read: true });

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

// ── Mark all as read ────────────────────────────────────
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await db('notifications')
      .where({ user_id: req.user.id, read: false })
      .update({ read: true });

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark notifications' });
  }
});

module.exports = router;

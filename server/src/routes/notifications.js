import express from 'express';
import { getDb } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const notifications = db.all(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );
    res.json(notifications);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    db.run(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Read notification error:', err);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Read all error:', err);
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

export default router;

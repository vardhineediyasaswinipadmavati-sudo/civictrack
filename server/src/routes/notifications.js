import express from 'express';
import { Notification } from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ user_id: req.user.id })
      .sort({ created_at: -1 })
      .limit(30);

    const formatted = notifications.map((n) => ({
      ...n.toJSON(),
      id: n._id.toString()
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, user_id: req.user.id },
      { is_read: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Read notification error:', err);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany({ user_id: req.user.id }, { is_read: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Read all error:', err);
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

export default router;

import express from 'express';
import { getDb } from '../db/connection.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const departments = db.all(`
      SELECT d.*, 
        (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) as staff_count,
        (SELECT COUNT(*) FROM shared_issues s WHERE s.department_id = d.id AND s.is_merged_into_id IS NULL) as active_issues_count
      FROM departments d
      ORDER BY d.name ASC
    `);
    res.json(departments);
  } catch (err) {
    console.error('Fetch departments error:', err);
    res.status(500).json({ error: 'Failed to fetch departments.' });
  }
});

export default router;

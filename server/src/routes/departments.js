import express from 'express';
import { Department, User, SharedIssue } from '../models/index.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 });

    const result = await Promise.all(
      departments.map(async (d) => {
        const [staffCount, activeIssuesCount] = await Promise.all([
          User.countDocuments({ department_id: d._id }),
          SharedIssue.countDocuments({ department_id: d._id, is_merged_into_id: null })
        ]);

        const deptObj = d.toJSON();
        return {
          ...deptObj,
          id: d._id.toString(),
          staff_count: staffCount,
          active_issues_count: activeIssuesCount
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('Fetch departments error:', err);
    res.status(500).json({ error: 'Failed to fetch departments.' });
  }
});

export default router;

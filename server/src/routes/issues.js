import express from 'express';
import { getDb } from '../db/connection.js';
import { authenticateToken, requireRole, optionalAuth } from '../middleware/auth.js';
import { calculateDistanceMeters } from '../utils/duplicateDetector.js';
import { calculatePriorityScore } from '../utils/priorityScorer.js';

const router = express.Router();

// 1. List shared civic issues with filtering
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { category, status, department_id, search, priority, mineOnly } = req.query;

    let query = `
      SELECT s.*, 
        d.name as department_name, d.code as department_code,
        a.name as asset_name, a.asset_code,
        (SELECT COUNT(*) FROM citizen_reports r WHERE r.shared_issue_id = s.id) as citizen_reports_count,
        (SELECT image_url FROM report_images img WHERE img.shared_issue_id = s.id LIMIT 1) as primary_image
      FROM shared_issues s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN infrastructure_assets a ON s.infrastructure_id = a.id
      WHERE s.is_merged_into_id IS NULL
    `;
    const params = [];

    // Filter to issues belonging to or followed by the authenticated citizen
    if (mineOnly === 'true') {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required to view your issues.' });
      }
      query += ` AND (
        s.id IN (SELECT shared_issue_id FROM citizen_reports WHERE user_id = ?)
        OR s.id IN (SELECT shared_issue_id FROM issue_follows WHERE user_id = ?)
      )`;
      params.push(req.user.id, req.user.id);
    }

    if (category) {
      query += ' AND s.category = ?';
      params.push(category);
    }

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    if (department_id) {
      query += ' AND s.department_id = ?';
      params.push(department_id);
    }

    if (priority) {
      if (priority === 'Critical') query += ' AND (s.priority_score >= 80 OR s.is_safety_critical = 1)';
      else if (priority === 'High') query += ' AND (s.priority_score >= 60 AND s.priority_score < 80)';
      else if (priority === 'Medium') query += ' AND (s.priority_score >= 35 AND s.priority_score < 60)';
      else if (priority === 'Low') query += ' AND s.priority_score < 35';
    }

    if (search) {
      query += ' AND (s.title LIKE ? OR s.description LIKE ? OR s.address LIKE ? OR s.issue_code LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY s.is_safety_critical DESC, s.priority_score DESC, s.created_at DESC';

    const issues = db.all(query, params);
    res.json(issues);
  } catch (err) {
    console.error('Fetch issues error:', err);
    res.status(500).json({ error: 'Failed to fetch civic issues.' });
  }
});

// 2. Nearby issues by coordinates
router.get('/nearby', async (req, res) => {
  try {
    const db = await getDb();
    const { lat, lon, radiusMeters = 1000 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    const allIssues = db.all(`
      SELECT s.*, 
        d.name as department_name,
        (SELECT COUNT(*) FROM citizen_reports r WHERE r.shared_issue_id = s.id) as citizen_reports_count,
        (SELECT image_url FROM report_images img WHERE img.shared_issue_id = s.id LIMIT 1) as primary_image
      FROM shared_issues s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE s.is_merged_into_id IS NULL
    `);

    const nearby = [];
    for (const issue of allIssues) {
      const dist = calculateDistanceMeters(Number(lat), Number(lon), issue.latitude, issue.longitude);
      if (dist <= Number(radiusMeters)) {
        nearby.push({
          ...issue,
          distanceMeters: Math.round(dist)
        });
      }
    }

    nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
    res.json(nearby);
  } catch (err) {
    console.error('Fetch nearby issues error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby issues.' });
  }
});

// 3. Get single shared issue details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const db = await getDb();
    const issueId = req.params.id;

    const issue = db.get(`
      SELECT s.*, 
        d.name as department_name, d.code as department_code, d.sla_hours,
        a.name as asset_name, a.asset_code, a.current_health_status as asset_health, a.risk_score as asset_risk,
        u.name as assigned_staff_name
      FROM shared_issues s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN infrastructure_assets a ON s.infrastructure_id = a.id
      LEFT JOIN users u ON s.assigned_to_user_id = u.id
      WHERE s.id = ?
    `, [issueId]);

    if (!issue) {
      return res.status(404).json({ error: 'Shared issue not found.' });
    }

    // Citizen reports linked to this shared issue
    const citizenReports = db.all(`
      SELECT r.*, u.name as reporter_name, u.email as reporter_email,
        (SELECT image_url FROM report_images img WHERE img.report_id = r.id LIMIT 1) as evidence_image
      FROM citizen_reports r
      JOIN users u ON r.user_id = u.id
      WHERE r.shared_issue_id = ?
      ORDER BY r.created_at ASC
    `, [issueId]);

    // All evidence images
    const images = db.all(`
      SELECT img.*, r.report_code 
      FROM report_images img
      LEFT JOIN citizen_reports r ON img.report_id = r.id
      WHERE img.shared_issue_id = ?
      ORDER BY img.created_at DESC
    `, [issueId]);

    // Status audit timeline
    const history = db.all(`
      SELECT h.*, u.name as changed_by_name, u.role as changed_by_role
      FROM status_history h
      JOIN users u ON h.changed_by_user_id = u.id
      WHERE h.shared_issue_id = ?
      ORDER BY h.created_at ASC
    `, [issueId]);

    // Repair records associated with this issue or incident
    const repairs = db.all(`
      SELECT rep.*, u.name as repaired_by_name, d.name as department_name
      FROM repair_records rep
      JOIN users u ON rep.repaired_by_user_id = u.id
      JOIN departments d ON rep.department_id = d.id
      WHERE rep.shared_issue_id = ?
      ORDER BY rep.completed_at DESC
    `, [issueId]);

    // Citizen verifications
    const verifications = db.all(`
      SELECT v.*, u.name as user_name
      FROM citizen_verifications v
      JOIN users u ON v.user_id = u.id
      WHERE v.shared_issue_id = ?
      ORDER BY v.created_at DESC
    `, [issueId]);

    // Follower count & user follow state
    const followerCount = db.get('SELECT COUNT(*) as count FROM issue_follows WHERE shared_issue_id = ?', [issueId]);
    const isFollowing = req.user ? !!db.get('SELECT id FROM issue_follows WHERE shared_issue_id = ? AND user_id = ?', [issueId, req.user.id]) : false;

    res.json({
      issue,
      citizenReports,
      images,
      history,
      repairs,
      verifications,
      followersCount: followerCount ? followerCount.count : 0,
      isFollowing
    });
  } catch (err) {
    console.error('Fetch single issue error:', err);
    res.status(500).json({ error: 'Failed to fetch issue details.' });
  }
});

// 4. Update issue status (Admin or Department Staff)
router.patch('/:id/status', authenticateToken, requireRole('admin', 'department_staff'), async (req, res) => {
  try {
    const db = await getDb();
    const issueId = req.params.id;
    const { status, comments, resolutionType } = req.body;

    const validStatuses = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Reopened', 'Escalated'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const currentIssue = db.get('SELECT * FROM shared_issues WHERE id = ?', [issueId]);
    if (!currentIssue) {
      return res.status(404).json({ error: 'Shared issue not found.' });
    }

    // Role check: Department staff can only update issues belonging to their assigned department
    if (req.user.role === 'department_staff') {
      if (currentIssue.department_id && req.user.department_id && currentIssue.department_id !== req.user.department_id) {
        return res.status(403).json({
          error: 'Access denied. You can only update work orders assigned to your municipal department.'
        });
      }
    }

    const now = new Date().toISOString();
    const resolvedAt = status === 'Resolved' ? now : null;

    db.run(
      `UPDATE shared_issues 
       SET status = ?, resolved_at = COALESCE(?, resolved_at), 
           resolution_type = COALESCE(?, resolution_type), updated_at = ?
       WHERE id = ?`,
      [status, resolvedAt, resolutionType || null, now, issueId]
    );

    // Update status on all linked citizen reports
    db.run('UPDATE citizen_reports SET status = ? WHERE shared_issue_id = ?', [status, issueId]);

    // Add status history record
    db.run(
      `INSERT INTO status_history (shared_issue_id, old_status, new_status, changed_by_user_id, comments, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [issueId, currentIssue.status, status, req.user.id, comments || `Status transitioned to ${status}`, now]
    );

    // Notify all linked citizens & followers
    const linkedUsers = db.all(`
      SELECT DISTINCT user_id FROM (
        SELECT user_id FROM citizen_reports WHERE shared_issue_id = ?
        UNION
        SELECT user_id FROM issue_follows WHERE shared_issue_id = ?
      )
    `, [issueId, issueId]);

    for (const u of linkedUsers) {
      db.run(
        `INSERT INTO notifications (user_id, title, message, link_url, is_read, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [
          u.user_id,
          `Status Update: Issue ${currentIssue.issue_code}`,
          `The status of civic issue "${currentIssue.title}" has been updated to ${status}.`,
          `/issues/${issueId}`,
          now
        ]
      );
    }

    res.json({ message: `Status updated to ${status} successfully.`, newStatus: status });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update issue status.' });
  }
});

// 5. Assign issue to department / staff user (Admin only)
router.post('/:id/assign', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDb();
    const issueId = req.params.id;
    const { department_id, assigned_to_user_id, comments } = req.body;

    const currentIssue = db.get('SELECT * FROM shared_issues WHERE id = ?', [issueId]);
    if (!currentIssue) {
      return res.status(404).json({ error: 'Shared issue not found.' });
    }

    if (department_id) {
      const targetDept = db.get('SELECT id FROM departments WHERE id = ?', [department_id]);
      if (!targetDept) {
        return res.status(400).json({ error: 'Selected department does not exist.' });
      }
    }

    if (assigned_to_user_id) {
      const targetUser = db.get('SELECT id FROM users WHERE id = ?', [assigned_to_user_id]);
      if (!targetUser) {
        return res.status(400).json({ error: 'Assigned staff user does not exist.' });
      }
    }

    const now = new Date().toISOString();
    const newStatus = currentIssue.status === 'Pending' ? 'Assigned' : currentIssue.status;

    db.run(
      `UPDATE shared_issues 
       SET department_id = ?, assigned_to_user_id = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [department_id || currentIssue.department_id, assigned_to_user_id || null, newStatus, now, issueId]
    );

    // Log history
    db.run(
      `INSERT INTO status_history (shared_issue_id, old_status, new_status, changed_by_user_id, comments, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        issueId,
        currentIssue.status,
        newStatus,
        req.user.id,
        comments || `Assigned to department ID ${department_id || currentIssue.department_id}`,
        now
      ]
    );

    res.json({ message: 'Issue assigned successfully.' });
  } catch (err) {
    console.error('Assign issue error:', err);
    res.status(500).json({ error: 'Failed to assign issue.' });
  }
});

// 6. Reopen issue (Citizen or Staff)
router.post('/:id/reopen', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const issueId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'A specific explanation is required to reopen an issue.' });
    }

    const issue = db.get('SELECT * FROM shared_issues WHERE id = ?', [issueId]);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    if (issue.status !== 'Resolved') {
      return res.status(400).json({ error: 'Only resolved issues can be reopened.' });
    }

    const now = new Date().toISOString();

    db.run(
      `UPDATE shared_issues 
       SET status = 'Reopened', resolved_at = NULL, updated_at = ?
       WHERE id = ?`,
      [now, issueId]
    );

    db.run('UPDATE citizen_reports SET status = "Reopened" WHERE shared_issue_id = ?', [issueId]);

    db.run(
      `INSERT INTO status_history (shared_issue_id, old_status, new_status, changed_by_user_id, comments, created_at)
       VALUES (?, 'Resolved', 'Reopened', ?, ?, ?)`,
      [issueId, req.user.id, `Reopened: ${reason.trim()}`, now]
    );

    // If linked to infrastructure, log recurrence observation
    if (issue.infrastructure_id) {
      db.run(
        `UPDATE repair_records 
         SET recurrence_observed = 1 
         WHERE shared_issue_id = ?`,
        [issueId]
      );
    }

    res.json({ message: 'Civic issue reopened for further remediation.', status: 'Reopened' });
  } catch (err) {
    console.error('Reopen error:', err);
    res.status(500).json({ error: 'Failed to reopen issue.' });
  }
});

// 7. Citizen verification: verify whether repair held up
router.post('/:id/verify-resolution', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const issueId = req.params.id;
    const { is_effective, feedback } = req.body;

    if (is_effective === undefined) {
      return res.status(400).json({ error: 'is_effective (1 or 0) is required.' });
    }

    const now = new Date().toISOString();

    db.run(
      `INSERT INTO citizen_verifications (shared_issue_id, user_id, is_effective, feedback, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [issueId, req.user.id, is_effective ? 1 : 0, feedback || null, now]
    );

    res.json({ message: 'Verification recorded. Thank you for helping verify community repairs!' });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Failed to record verification.' });
  }
});

// 8. Follow / Unfollow issue
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const issueId = req.params.id;
    const userId = req.user.id;

    const existing = db.get('SELECT id FROM issue_follows WHERE shared_issue_id = ? AND user_id = ?', [issueId, userId]);

    if (existing) {
      db.run('DELETE FROM issue_follows WHERE id = ?', [existing.id]);
      return res.json({ following: false, message: 'Unfollowed issue updates.' });
    } else {
      const now = new Date().toISOString();
      db.run('INSERT INTO issue_follows (shared_issue_id, user_id, created_at) VALUES (?, ?, ?)', [issueId, userId, now]);
      return res.json({ following: true, message: 'You are now following this issue for updates.' });
    }
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ error: 'Failed to toggle follow status.' });
  }
});

// 9. Merge two shared issues (ADMIN ONLY - Feature 1D)
router.post('/:id/merge', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDb();
    const targetIssueId = Number(req.params.id);
    const { sourceIssueId, reason } = req.body;

    if (!sourceIssueId || targetIssueId === Number(sourceIssueId)) {
      return res.status(400).json({ error: 'A valid distinct source issue ID to merge is required.' });
    }

    const targetIssue = db.get('SELECT * FROM shared_issues WHERE id = ?', [targetIssueId]);
    const sourceIssue = db.get('SELECT * FROM shared_issues WHERE id = ?', [sourceIssueId]);

    if (!targetIssue || !sourceIssue) {
      return res.status(404).json({ error: 'Target or source shared issue not found.' });
    }

    const now = new Date().toISOString();

    // 1. Move all citizen reports from source issue to target issue
    db.run(
      `UPDATE citizen_reports 
       SET shared_issue_id = ?, link_type = 'admin_merged'
       WHERE shared_issue_id = ?`,
      [targetIssueId, sourceIssueId]
    );

    // 2. Move images
    db.run(
      `UPDATE report_images 
       SET shared_issue_id = ?
       WHERE shared_issue_id = ?`,
      [targetIssueId, sourceIssueId]
    );

    // 3. Mark source issue as merged
    db.run(
      `UPDATE shared_issues 
       SET is_merged_into_id = ?, status = 'Resolved', 
           resolution_notes = ?, updated_at = ?
       WHERE id = ?`,
      [targetIssueId, `Merged into issue ${targetIssue.issue_code}: ${reason || 'Duplicate physical problem'}`, now, sourceIssueId]
    );

    // 4. Update target issue latest reported at & citizen report count
    const totalReportsRow = db.get('SELECT COUNT(*) as count FROM citizen_reports WHERE shared_issue_id = ?', [targetIssueId]);
    const totalReports = totalReportsRow ? totalReportsRow.count : 1;

    db.run(
      `UPDATE shared_issues 
       SET latest_reported_at = ?, updated_at = ?
       WHERE id = ?`,
      [now, now, targetIssueId]
    );

    // 5. Create audit log entry
    db.run(
      `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
       VALUES ('MERGE_ISSUES', 'shared_issue', ?, ?, ?, ?)`,
      [
        targetIssueId,
        req.user.id,
        JSON.stringify({
          sourceIssueId,
          sourceCode: sourceIssue.issue_code,
          targetIssueId,
          targetCode: targetIssue.issue_code,
          reason: reason || 'Consolidated duplicate complaints into single physical master issue'
        }),
        now
      ]
    );

    // 6. Notify reporters from both issues
    const affectedUsers = db.all(`
      SELECT DISTINCT user_id FROM citizen_reports WHERE shared_issue_id = ?
    `, [targetIssueId]);

    for (const u of affectedUsers) {
      db.run(
        `INSERT INTO notifications (user_id, title, message, link_url, is_read, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [
          u.user_id,
          'Issues Consolidated',
          `Your reported issue was consolidated into master civic issue ${targetIssue.issue_code} for synchronized municipal repair tracking.`,
          `/issues/${targetIssueId}`,
          now
        ]
      );
    }

    res.json({
      message: `Successfully merged issue ${sourceIssue.issue_code} into ${targetIssue.issue_code}.`,
      targetIssueId,
      totalLinkedReports: totalReports
    });
  } catch (err) {
    console.error('Merge error:', err);
    res.status(500).json({ error: 'Failed to merge issues.' });
  }
});

// 10. Separate an incorrectly linked citizen report into an independent issue (ADMIN ONLY)
router.post('/:id/separate', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDb();
    const sharedIssueId = Number(req.params.id);
    const { reportId, reason } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required to separate.' });
    }

    const report = db.get('SELECT * FROM citizen_reports WHERE id = ? AND shared_issue_id = ?', [reportId, sharedIssueId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found or not linked to this shared issue.' });
    }

    const now = new Date().toISOString();
    const newIssueCode = `CT-${Math.floor(200 + Math.random() * 800)}`;

    // Create new independent shared issue
    const newIssueResult = db.run(
      `INSERT INTO shared_issues (
        issue_code, title, category, description, severity, priority_score,
        is_safety_critical, status, latitude, longitude, address,
        first_reported_at, latest_reported_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 40, 0, 'Pending', ?, ?, ?, ?, ?, ?, ?)`,
      [
        newIssueCode,
        report.title,
        report.category,
        report.description,
        report.severity,
        report.latitude,
        report.longitude,
        report.address,
        report.created_at,
        now,
        now,
        now
      ]
    );

    const newIssueId = newIssueResult.lastInsertRowid;

    // Update report
    db.run(
      `UPDATE citizen_reports 
       SET shared_issue_id = ?, link_type = 'original'
       WHERE id = ?`,
      [newIssueId, reportId]
    );

    // Update images associated with this report
    db.run(
      `UPDATE report_images 
       SET shared_issue_id = ?
       WHERE report_id = ?`,
      [newIssueId, reportId]
    );

    // Audit log
    db.run(
      `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at)
       VALUES ('SEPARATE_REPORT', 'citizen_report', ?, ?, ?, ?)`,
      [
        reportId,
        req.user.id,
        JSON.stringify({
          originalSharedIssueId: sharedIssueId,
          newSharedIssueId: newIssueId,
          newIssueCode,
          reason: reason || 'Determined to represent distinct physical infrastructure fault'
        }),
        now
      ]
    );

    res.json({
      message: `Report ${report.report_code} successfully separated into new issue ${newIssueCode}.`,
      newIssueId,
      newIssueCode
    });
  } catch (err) {
    console.error('Separate error:', err);
    res.status(500).json({ error: 'Failed to separate report.' });
  }
});

export default router;

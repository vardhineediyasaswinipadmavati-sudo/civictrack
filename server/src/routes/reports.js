import express from 'express';
import { getDb } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { findNearbyDuplicates, calculateDistanceMeters } from '../utils/duplicateDetector.js';
import { calculatePriorityScore } from '../utils/priorityScorer.js';
import { calculateInfrastructureRisk } from '../utils/riskPredictor.js';

const router = express.Router();

// Helper to map category to department code
function getDepartmentCodeForCategory(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('road') || cat.includes('pothole')) return 'ROADS';
  if (cat.includes('light') || cat.includes('electr')) return 'ELECTRICAL';
  if (cat.includes('water')) return 'WATER';
  if (cat.includes('drain') || cat.includes('sewag')) return 'WATER';
  if (cat.includes('garb') || cat.includes('sanit')) return 'SANITATION';
  if (cat.includes('build') || cat.includes('facil')) return 'FACILITIES';
  return 'ROADS';
}

// 1. Check for duplicates before submitting (Feature 1B: Existing Issue Suggestion Screen)
router.post('/check-duplicate', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const { category, latitude, longitude, title, description } = req.body;

    if (!latitude || !longitude || !category) {
      return res.status(400).json({ error: 'Latitude, longitude, and category are required.' });
    }

    const openIssues = db.all(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM citizen_reports r WHERE r.shared_issue_id = s.id) as report_count,
        (SELECT image_url FROM report_images img WHERE img.shared_issue_id = s.id LIMIT 1) as preview_image
      FROM shared_issues s
      WHERE s.is_merged_into_id IS NULL
    `);

    const candidate = {
      category,
      latitude: Number(latitude),
      longitude: Number(longitude),
      title: title || '',
      description: description || ''
    };

    const duplicateMatches = findNearbyDuplicates(candidate, openIssues);

    res.json({
      hasDuplicates: duplicateMatches.length > 0,
      matches: duplicateMatches.slice(0, 5) // Top 5 potential matches
    });
  } catch (err) {
    console.error('Duplicate check error:', err);
    res.status(500).json({ error: 'Failed to check for duplicate issues.' });
  }
});

// 2. Submit a new citizen report
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const {
      title,
      category,
      description,
      severity = 'Medium',
      latitude,
      longitude,
      address,
      confirmedExistingIssueId, // If citizen confirmed joining an existing shared issue
      isSafetyCritical = 0,
      imageUrls = [] // Pre-uploaded or provided image URLs
    } = req.body;

    if (!title || !category || !description || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Title, category, description, latitude, and longitude are required.' });
    }

    const now = new Date().toISOString();
    const userId = req.user.id;
    const reportCode = `REP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    let sharedIssueId = confirmedExistingIssueId || null;
    let linkType = confirmedExistingIssueId ? 'confirmed_duplicate' : 'original';

    // SCENARIO 1: Citizen joins an existing shared issue
    if (sharedIssueId) {
      const existingIssue = db.get('SELECT * FROM shared_issues WHERE id = ?', [sharedIssueId]);
      if (!existingIssue) {
        return res.status(404).json({ error: 'The selected shared issue does not exist.' });
      }

      // Insert citizen report preserving individual reporter and evidence
      const reportResult = db.run(
        `INSERT INTO citizen_reports (
          report_code, user_id, shared_issue_id, title, category, description,
          severity, latitude, longitude, address, status, similarity_match_score,
          link_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportCode,
          userId,
          sharedIssueId,
          title.trim(),
          category,
          description.trim(),
          severity,
          Number(latitude),
          Number(longitude),
          address || existingIssue.address,
          existingIssue.status,
          95, // Confirmed match
          linkType,
          now
        ]
      );
      const reportId = reportResult.lastInsertRowid;

      // Attach images to this report and to the shared issue gallery
      for (const url of imageUrls) {
        db.run(
          `INSERT INTO report_images (report_id, shared_issue_id, image_url, image_type, created_at)
           VALUES (?, ?, ?, 'evidence', ?)`,
          [reportId, sharedIssueId, url, now]
        );
      }

      // Update shared issue latest report timestamp & recalculate priority
      const reportsCountRow = db.get('SELECT COUNT(*) as count FROM citizen_reports WHERE shared_issue_id = ?', [sharedIssueId]);
      const totalReports = reportsCountRow ? reportsCountRow.count : 1;

      // Recalculate priority
      const dept = existingIssue.department_id ? db.get('SELECT sla_hours FROM departments WHERE id = ?', [existingIssue.department_id]) : null;
      const hoursUnresolved = (new Date() - new Date(existingIssue.first_reported_at)) / (1000 * 60 * 60);

      const newPriority = calculatePriorityScore({
        severity: existingIssue.severity,
        isSafetyCritical: existingIssue.is_safety_critical,
        reportCount: totalReports,
        recurrenceCount: 0,
        hoursUnresolved,
        slaHours: dept ? dept.sla_hours : 72
      });

      // Update estimated affected population (base + unique reports * 8)
      const estimatedPop = 15 + totalReports * 8;

      db.run(
        `UPDATE shared_issues 
         SET latest_reported_at = ?, priority_score = ?, estimated_affected_population = ?, updated_at = ?
         WHERE id = ?`,
        [now, newPriority.score, estimatedPop, now, sharedIssueId]
      );

      // Auto-follow the issue
      try {
        db.run('INSERT OR IGNORE INTO issue_follows (shared_issue_id, user_id, created_at) VALUES (?, ?, ?)', [sharedIssueId, userId, now]);
      } catch (e) {}

      // Notify the user
      db.run(
        `INSERT INTO notifications (user_id, title, message, link_url, is_read, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [
          userId,
          'Report Connected to Shared Civic Issue',
          `Your observation has been linked to Master Issue ${existingIssue.issue_code}. You will receive automatic status alerts as repairs progress.`,
          `/issues/${sharedIssueId}`,
          now
        ]
      );

      return res.status(201).json({
        message: 'Report successfully linked to existing civic issue.',
        reportId,
        sharedIssueId,
        issueCode: existingIssue.issue_code,
        isNewSharedIssue: false
      });
    }

    // SCENARIO 2: Create a brand new Shared Civic Issue
    // Find matching infrastructure asset or locate nearest asset of this category
    const allAssets = db.all('SELECT * FROM infrastructure_assets WHERE category = ?', [category]);
    let matchedAsset = null;
    let minDistance = 150; // Within 150 meters

    for (const asset of allAssets) {
      const dist = calculateDistanceMeters(Number(latitude), Number(longitude), asset.latitude, asset.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        matchedAsset = asset;
      }
    }

    // Auto-assign department based on category
    const deptCode = getDepartmentCodeForCategory(category);
    const department = db.get('SELECT id, sla_hours FROM departments WHERE code = ?', [deptCode]);
    const departmentId = department ? department.id : 1;
    const slaHours = department ? department.sla_hours : 72;

    const issueCode = `CT-${Math.floor(100 + Math.random() * 900)}`;

    // Initial priority
    const priority = calculatePriorityScore({
      severity,
      isSafetyCritical: Boolean(isSafetyCritical),
      reportCount: 1,
      recurrenceCount: matchedAsset ? 1 : 0,
      hoursUnresolved: 0,
      slaHours
    });

    const initialAffectedPop = isSafetyCritical ? 85 : 25;
    const popDetails = `Estimated based on community facility proximity and preliminary reporting volume`;

    const issueResult = db.run(
      `INSERT INTO shared_issues (
        issue_code, title, category, description, severity, priority_score,
        is_safety_critical, status, latitude, longitude, address,
        department_id, infrastructure_id, estimated_affected_population,
        affected_population_details, first_reported_at, latest_reported_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issueCode,
        title.trim(),
        category,
        description.trim(),
        severity,
        priority.score,
        isSafetyCritical ? 1 : 0,
        Number(latitude),
        Number(longitude),
        address || 'Recorded Coordinates',
        departmentId,
        matchedAsset ? matchedAsset.id : null,
        initialAffectedPop,
        popDetails,
        now,
        now,
        now,
        now
      ]
    );

    sharedIssueId = issueResult.lastInsertRowid;

    // Create incident record if matched to infrastructure
    let incidentId = null;
    if (matchedAsset) {
      const priorIncidents = db.all('SELECT id FROM infrastructure_incidents WHERE infrastructure_id = ?', [matchedAsset.id]);
      const recurrenceSeq = priorIncidents.length + 1;
      const incCode = `INC-${matchedAsset.asset_code}-${recurrenceSeq}`;

      const incResult = db.run(
        `INSERT INTO infrastructure_incidents (
          incident_code, infrastructure_id, shared_issue_id, incident_type,
          description, started_at, recurrence_sequence, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          incCode,
          matchedAsset.id,
          sharedIssueId,
          title.trim(),
          description.trim(),
          now,
          recurrenceSeq,
          now
        ]
      );
      incidentId = incResult.lastInsertRowid;

      // Link incident to shared issue
      db.run('UPDATE shared_issues SET incident_id = ? WHERE id = ?', [incidentId, sharedIssueId]);

      // Re-evaluate infrastructure asset risk score
      const allIncidents = db.all('SELECT * FROM infrastructure_incidents WHERE infrastructure_id = ?', [matchedAsset.id]);
      const allRepairs = db.all('SELECT * FROM repair_records WHERE infrastructure_id = ?', [matchedAsset.id]);
      const openCount = db.get('SELECT COUNT(*) as count FROM shared_issues WHERE infrastructure_id = ? AND status != "Resolved"', [matchedAsset.id]);

      const riskCalc = calculateInfrastructureRisk({
        asset: matchedAsset,
        distinctIncidents: allIncidents,
        repairRecords: allRepairs,
        unresolvedIssuesCount: openCount ? openCount.count : 1
      });

      db.run(
        `UPDATE infrastructure_assets
         SET current_health_status = ?, risk_score = ?, risk_level = ?, risk_reasons = ?
         WHERE id = ?`,
        [riskCalc.healthStatus, riskCalc.riskScore, riskCalc.riskLevel, JSON.stringify(riskCalc.reasons), matchedAsset.id]
      );
    }

    // Insert Citizen Report
    const reportResult = db.run(
      `INSERT INTO citizen_reports (
        report_code, user_id, shared_issue_id, title, category, description,
        severity, latitude, longitude, address, status, similarity_match_score,
        link_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 100, 'original', ?)`,
      [
        reportCode,
        userId,
        sharedIssueId,
        title.trim(),
        category,
        description.trim(),
        severity,
        Number(latitude),
        Number(longitude),
        address || 'Recorded Coordinates',
        now
      ]
    );

    const reportId = reportResult.lastInsertRowid;

    // Attach images
    for (const url of imageUrls) {
      db.run(
        `INSERT INTO report_images (report_id, shared_issue_id, image_url, image_type, created_at)
         VALUES (?, ?, ?, 'evidence', ?)`,
        [reportId, sharedIssueId, url, now]
      );
    }

    // Initial status history entry
    db.run(
      `INSERT INTO status_history (shared_issue_id, old_status, new_status, changed_by_user_id, comments, created_at)
       VALUES (?, 'None', 'Pending', ?, 'Complaint submitted and verified by citizen', ?)`,
      [sharedIssueId, userId, now]
    );

    // Auto follow
    try {
      db.run('INSERT OR IGNORE INTO issue_follows (shared_issue_id, user_id, created_at) VALUES (?, ?, ?)', [sharedIssueId, userId, now]);
    } catch (e) {}

    // Notification to citizen
    db.run(
      `INSERT INTO notifications (user_id, title, message, link_url, is_read, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [
        userId,
        'Civic Complaint Registered',
        `Your complaint has been assigned issue code ${issueCode}. Municipal authorities have been notified.`,
        `/issues/${sharedIssueId}`,
        now
      ]
    );

    res.status(201).json({
      message: 'Civic issue registered successfully.',
      reportId,
      sharedIssueId,
      issueCode,
      isNewSharedIssue: true
    });
  } catch (err) {
    console.error('Report submission error:', err);
    res.status(500).json({ error: 'Server error while submitting report.' });
  }
});

// 3. Upload image for a report
router.post('/upload-image', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// 4. List citizen reports with filtering & search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const { category, status, search, mineOnly } = req.query;

    let query = `
      SELECT r.*, u.name as reporter_name, s.issue_code, s.status as shared_status,
        s.title as shared_title, s.address as shared_address, s.category as shared_category,
        (SELECT image_url FROM report_images img WHERE img.report_id = r.id LIMIT 1) as primary_image
      FROM citizen_reports r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN shared_issues s ON r.shared_issue_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (mineOnly === 'true' || req.user.role === 'citizen') {
      query += ' AND r.user_id = ?';
      params.push(req.user.id);
    }

    if (category) {
      query += ' AND r.category = ?';
      params.push(category);
    }

    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (r.title LIKE ? OR r.description LIKE ? OR r.address LIKE ? OR r.report_code LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY r.created_at DESC';

    const reports = db.all(query, params);
    res.json(reports);
  } catch (err) {
    console.error('Reports fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

// 5. Get single citizen report details (preserves original evidence)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const report = db.get(
      `SELECT r.*, u.name as reporter_name, u.email as reporter_email,
        s.issue_code, s.status as shared_status, s.department_id, s.priority_score
       FROM citizen_reports r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN shared_issues s ON r.shared_issue_id = s.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    // Role check: Citizens can only inspect their own complaint submissions
    if (req.user.role === 'citizen' && report.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You can only view your own report submissions.' });
    }

    const images = db.all('SELECT * FROM report_images WHERE report_id = ?', [report.id]);
    res.json({ ...report, images });
  } catch (err) {
    console.error('Single report fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch report details.' });
  }
});

export default router;

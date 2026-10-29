import express from 'express';
import { getDb } from '../db/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { calculateInfrastructureRisk } from '../utils/riskPredictor.js';

const router = express.Router();

// 1. List all infrastructure assets
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const { category, health_status, risk_level, search } = req.query;

    let query = `
      SELECT a.*,
        (SELECT COUNT(DISTINCT r.id) 
         FROM citizen_reports r 
         JOIN shared_issues s ON r.shared_issue_id = s.id 
         WHERE s.infrastructure_id = a.id) as total_citizen_reports,
        (SELECT COUNT(*) FROM infrastructure_incidents inc WHERE inc.infrastructure_id = a.id) as unique_incidents_count,
        (SELECT COUNT(*) FROM repair_records rep WHERE rep.infrastructure_id = a.id) as repair_attempts_count,
        (SELECT MAX(completed_at) FROM repair_records rep WHERE rep.infrastructure_id = a.id) as last_repair_date
      FROM infrastructure_assets a
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND a.category = ?';
      params.push(category);
    }

    if (health_status) {
      query += ' AND a.current_health_status = ?';
      params.push(health_status);
    }

    if (risk_level) {
      query += ' AND a.risk_level = ?';
      params.push(risk_level);
    }

    if (search) {
      query += ' AND (a.name LIKE ? OR a.asset_code LIKE ? OR a.address LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY a.risk_score DESC, a.name ASC';

    const assets = db.all(query, params);

    // Parse risk_reasons JSON if present
    const formatted = assets.map((asset) => {
      let reasons = [];
      try {
        reasons = asset.risk_reasons ? JSON.parse(asset.risk_reasons) : [];
      } catch (e) {
        reasons = [asset.risk_reasons];
      }
      return { ...asset, risk_reasons: reasons };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Fetch assets error:', err);
    res.status(500).json({ error: 'Failed to fetch infrastructure assets.' });
  }
});

// 2. Create new infrastructure asset (Admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDb();
    const { asset_code, name, category, latitude, longitude, address, installation_date } = req.body;

    if (!asset_code || !name || !category || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Asset code, name, category, latitude, and longitude are required.' });
    }

    const existing = db.get('SELECT id FROM infrastructure_assets WHERE asset_code = ?', [asset_code.trim().toUpperCase()]);
    if (existing) {
      return res.status(409).json({ error: 'An asset with this code already exists.' });
    }

    const now = new Date().toISOString();
    const result = db.run(
      `INSERT INTO infrastructure_assets (
        asset_code, name, category, latitude, longitude, address,
        installation_date, current_health_status, risk_score, risk_level,
        risk_reasons, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'good', 10, 'Low', '["Newly commissioned infrastructure asset"]', ?)`,
      [
        asset_code.trim().toUpperCase(),
        name.trim(),
        category,
        Number(latitude),
        Number(longitude),
        address || 'Recorded Location',
        installation_date || now.split('T')[0],
        now
      ]
    );

    res.status(201).json({ message: 'Infrastructure asset created.', assetId: result.lastInsertRowid });
  } catch (err) {
    console.error('Create asset error:', err);
    res.status(500).json({ error: 'Failed to create infrastructure asset.' });
  }
});

// 3. Dedicated Infrastructure Profile (Feature 3: Infrastructure Failure History)
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const assetId = req.params.id;

    const asset = db.get('SELECT * FROM infrastructure_assets WHERE id = ?', [assetId]);
    if (!asset) {
      return res.status(404).json({ error: 'Infrastructure asset not found.' });
    }

    // Parse risk reasons
    let riskReasons = [];
    try {
      riskReasons = asset.risk_reasons ? JSON.parse(asset.risk_reasons) : [];
    } catch (e) {
      riskReasons = [];
    }

    // Incidents
    const incidents = db.all(`
      SELECT inc.*, s.issue_code, s.status as issue_status,
        (SELECT COUNT(*) FROM citizen_reports r WHERE r.shared_issue_id = s.id) as report_count
      FROM infrastructure_incidents inc
      LEFT JOIN shared_issues s ON inc.shared_issue_id = s.id
      WHERE inc.infrastructure_id = ?
      ORDER BY inc.started_at DESC
    `, [assetId]);

    // Repairs
    const repairs = db.all(`
      SELECT rep.*, u.name as repaired_by_name, d.name as department_name,
        (SELECT image_url FROM report_images img WHERE img.repair_id = rep.id AND img.image_type = 'before_repair' LIMIT 1) as before_image,
        (SELECT image_url FROM report_images img WHERE img.repair_id = rep.id AND img.image_type = 'after_repair' LIMIT 1) as after_image
      FROM repair_records rep
      JOIN users u ON rep.repaired_by_user_id = u.id
      JOIN departments d ON rep.department_id = d.id
      WHERE rep.infrastructure_id = ?
      ORDER BY rep.completed_at DESC
    `, [assetId]);

    // Total citizen reports across all issues linked to this asset
    const reportsSummary = db.get(`
      SELECT COUNT(DISTINCT r.id) as total_reports
      FROM citizen_reports r
      JOIN shared_issues s ON r.shared_issue_id = s.id
      WHERE s.infrastructure_id = ?
    `, [assetId]);

    // Cost summary
    const costSummary = db.get(`
      SELECT 
        SUM(CASE WHEN cost_amount IS NOT NULL THEN cost_amount ELSE 0 END) as total_repair_cost,
        COUNT(CASE WHEN cost_unavailable = 1 THEN 1 END) as unrecorded_cost_count
      FROM repair_records
      WHERE infrastructure_id = ?
    `, [assetId]);

    // Calculate MTBF (Mean Time Between Failures in days)
    let mtbfDays = null;
    if (incidents.length >= 2) {
      const sortedIncidents = [...incidents].sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
      let totalDays = 0;
      for (let i = 1; i < sortedIncidents.length; i++) {
        const prev = new Date(sortedIncidents[i - 1].started_at);
        const curr = new Date(sortedIncidents[i].started_at);
        totalDays += (curr - prev) / (1000 * 60 * 60 * 24);
      }
      mtbfDays = Math.round(totalDays / (sortedIncidents.length - 1));
    }

    // Active issues currently open
    const activeIssues = db.all(`
      SELECT s.*, (SELECT COUNT(*) FROM citizen_reports r WHERE r.shared_issue_id = s.id) as report_count
      FROM shared_issues s
      WHERE s.infrastructure_id = ? AND s.status != 'Resolved'
    `, [assetId]);

    // Combined Chronological Timeline (Unified view of incidents and repairs)
    const timeline = [];
    for (const inc of incidents) {
      timeline.push({
        type: 'incident',
        date: inc.started_at,
        title: `Failure: ${inc.incident_type}`,
        description: inc.description,
        code: inc.incident_code,
        sequence: inc.recurrence_sequence,
        id: inc.id
      });
    }
    for (const rep of repairs) {
      timeline.push({
        type: 'repair',
        date: rep.completed_at,
        title: `Maintenance: ${rep.repair_type.toUpperCase()} repair`,
        description: rep.work_summary,
        code: rep.repair_code,
        cost: rep.cost_amount,
        costUnavailable: rep.cost_unavailable,
        department: rep.department_name,
        materials: rep.materials_used,
        recurrenceObserved: rep.recurrence_observed,
        daysUntilNextIncident: rep.days_until_next_incident,
        id: rep.id
      });
    }
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      asset: {
        ...asset,
        risk_reasons: riskReasons
      },
      stats: {
        totalCitizenReports: reportsSummary ? reportsSummary.total_reports : 0,
        uniqueIncidentsCount: incidents.length,
        repairAttemptsCount: repairs.length,
        mtbfDays,
        totalRepairCost: costSummary ? Math.round(costSummary.total_repair_cost) : 0,
        unrecordedCostCount: costSummary ? costSummary.unrecorded_cost_count : 0
      },
      incidents,
      repairs,
      activeIssues,
      timeline
    });
  } catch (err) {
    console.error('Fetch single asset error:', err);
    res.status(500).json({ error: 'Failed to fetch infrastructure asset profile.' });
  }
});

// 4. Record a Repair (Staff or Admin - Feature 4)
router.post('/:id/repairs', authenticateToken, requireRole('admin', 'department_staff'), async (req, res) => {
  try {
    const db = await getDb();
    const assetId = req.params.id;
    const {
      shared_issue_id,
      incident_id,
      department_id,
      repair_type, // 'temporary', 'permanent', 'inspection_only', 'no_fault'
      cost_amount,
      cost_unavailable = false,
      materials_used,
      work_summary,
      before_image_url,
      after_image_url
    } = req.body;

    const validRepairTypes = ['temporary', 'permanent', 'inspection_only', 'no_fault'];
    if (!repair_type || !validRepairTypes.includes(repair_type)) {
      return res.status(400).json({ error: `Invalid repair type. Must be one of: ${validRepairTypes.join(', ')}` });
    }

    if (!work_summary || work_summary.trim().length < 5) {
      return res.status(400).json({ error: 'A clear work summary is required.' });
    }

    const asset = db.get('SELECT * FROM infrastructure_assets WHERE id = ?', [assetId]);
    if (!asset) {
      return res.status(404).json({ error: 'Infrastructure asset not found.' });
    }

    const now = new Date().toISOString();
    const repairCode = `REP-REC-${Math.floor(1000 + Math.random() * 9000)}`;

    const userDept = req.user.department_id || department_id || 1;

    const repairResult = db.run(
      `INSERT INTO repair_records (
        repair_code, infrastructure_id, incident_id, shared_issue_id,
        repaired_by_user_id, department_id, repair_type, cost_amount,
        cost_unavailable, materials_used, work_summary, completed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        repairCode,
        assetId,
        incident_id || null,
        shared_issue_id || null,
        req.user.id,
        userDept,
        repair_type,
        cost_unavailable ? null : (cost_amount ? Number(cost_amount) : null),
        cost_unavailable ? 1 : 0,
        materials_used || null,
        work_summary.trim(),
        now,
        now
      ]
    );

    const repairId = repairResult.lastInsertRowid;

    // Attach before & after images
    if (before_image_url) {
      db.run(
        `INSERT INTO report_images (shared_issue_id, repair_id, image_url, image_type, created_at)
         VALUES (?, ?, ?, 'before_repair', ?)`,
        [shared_issue_id || null, repairId, before_image_url, now]
      );
    }
    if (after_image_url) {
      db.run(
        `INSERT INTO report_images (shared_issue_id, repair_id, image_url, image_type, created_at)
         VALUES (?, ?, ?, 'after_repair', ?)`,
        [shared_issue_id || null, repairId, after_image_url, now]
      );
    }

    // If linked to shared issue, transition issue to Resolved with resolutionType
    if (shared_issue_id) {
      db.run(
        `UPDATE shared_issues 
         SET status = 'Resolved', resolved_at = ?, resolution_type = ?, 
             resolution_notes = ?, updated_at = ?
         WHERE id = ?`,
        [now, repair_type, work_summary.trim(), now, shared_issue_id]
      );

      db.run('UPDATE citizen_reports SET status = "Resolved" WHERE shared_issue_id = ?', [shared_issue_id]);

      db.run(
        `INSERT INTO status_history (shared_issue_id, old_status, new_status, changed_by_user_id, comments, created_at)
         VALUES (?, 'In Progress', 'Resolved', ?, ?, ?)`,
        [shared_issue_id, req.user.id, `Repair completed (${repair_type}): ${work_summary.trim()}`, now]
      );

      // Notify linked citizens
      const reporters = db.all('SELECT DISTINCT user_id FROM citizen_reports WHERE shared_issue_id = ?', [shared_issue_id]);
      for (const r of reporters) {
        db.run(
          `INSERT INTO notifications (user_id, title, message, link_url, is_read, created_at)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [
            r.user_id,
            'Repair Completed',
            `Work has been completed on your reported issue (${repair_type}). Please help verify if the repair is effective!`,
            `/issues/${shared_issue_id}`,
            now
          ]
        );
      }
    }

    // Recalculate asset risk score & health status
    const allIncidents = db.all('SELECT * FROM infrastructure_incidents WHERE infrastructure_id = ?', [assetId]);
    const allRepairs = db.all('SELECT * FROM repair_records WHERE infrastructure_id = ?', [assetId]);
    const openCount = db.get('SELECT COUNT(*) as count FROM shared_issues WHERE infrastructure_id = ? AND status != "Resolved"', [assetId]);

    const updatedRisk = calculateInfrastructureRisk({
      asset,
      distinctIncidents: allIncidents,
      repairRecords: allRepairs,
      unresolvedIssuesCount: openCount ? openCount.count : 0
    });

    db.run(
      `UPDATE infrastructure_assets 
       SET current_health_status = ?, risk_score = ?, risk_level = ?, 
           risk_reasons = ?, last_inspected_at = ?
       WHERE id = ?`,
      [
        updatedRisk.healthStatus,
        updatedRisk.riskScore,
        updatedRisk.riskLevel,
        JSON.stringify(updatedRisk.reasons),
        now,
        assetId
      ]
    );

    res.status(201).json({
      message: 'Repair record logged successfully.',
      repairId,
      repairCode,
      updatedHealthStatus: updatedRisk.healthStatus,
      updatedRiskScore: updatedRisk.riskScore
    });
  } catch (err) {
    console.error('Record repair error:', err);
    res.status(500).json({ error: 'Failed to record repair.' });
  }
});

export default router;

import express from 'express';
import { getDb } from '../db/connection.js';
import {
  computeRepairEffectiveness,
  computeMaintenanceWaste,
  computeSeasonalAnalysis,
  computeDepartmentPerformance
} from '../utils/analyticsEngine.js';

const router = express.Router();

// 1. Overview KPIs
router.get('/overview', async (req, res) => {
  try {
    const db = await getDb();

    // Total citizen reports
    const totalReportsRow = db.get('SELECT COUNT(*) as count FROM citizen_reports');
    const totalReports = totalReportsRow ? totalReportsRow.count : 0;

    // Total unique civic issues (excluding merged)
    const uniqueIssuesRow = db.get('SELECT COUNT(*) as count FROM shared_issues WHERE is_merged_into_id IS NULL');
    const uniqueIssues = uniqueIssuesRow ? uniqueIssuesRow.count : 0;

    // Unique infrastructure assets
    const totalAssetsRow = db.get('SELECT COUNT(*) as count FROM infrastructure_assets');
    const totalAssets = totalAssetsRow ? totalAssetsRow.count : 0;

    // Recurring incidents
    const recurringIncidentsRow = db.get('SELECT COUNT(*) as count FROM infrastructure_incidents WHERE recurrence_sequence > 1');
    const recurringIncidents = recurringIncidentsRow ? recurringIncidentsRow.count : 0;

    // Repair attempts
    const totalRepairsRow = db.get('SELECT COUNT(*) as count FROM repair_records');
    const totalRepairs = totalRepairsRow ? totalRepairsRow.count : 0;

    // Open & Overdue issues
    const openIssuesRow = db.get(`
      SELECT 
        COUNT(CASE WHEN status IN ('Pending', 'Assigned', 'In Progress') THEN 1 END) as open_count,
        COUNT(CASE WHEN status = 'Escalated' THEN 1 END) as escalated_count,
        COUNT(CASE WHEN status = 'Resolved' THEN 1 END) as resolved_count
      FROM shared_issues
      WHERE is_merged_into_id IS NULL
    `);

    // High & Critical Risk Assets
    const riskAssetsRow = db.get(`
      SELECT 
        COUNT(CASE WHEN risk_level IN ('High', 'Critical') THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN current_health_status = 'critical' THEN 1 END) as critical_health_count
      FROM infrastructure_assets
    `);

    // Category breakdown
    const categoryBreakdown = db.all(`
      SELECT category, COUNT(id) as count
      FROM shared_issues
      WHERE is_merged_into_id IS NULL
      GROUP BY category
      ORDER BY count DESC
    `);

    // Consolidation ratio
    const consolidationRatio = uniqueIssues > 0 ? (totalReports / uniqueIssues).toFixed(2) : 1;

    res.json({
      totalCitizenReports: totalReports,
      uniqueCivicIssues: uniqueIssues,
      totalInfrastructureAssets: totalAssets,
      recurringIncidentsCount: recurringIncidents,
      totalRepairAttempts: totalRepairs,
      consolidationRatio: Number(consolidationRatio),
      openIssues: openIssuesRow ? openIssuesRow.open_count : 0,
      escalatedIssues: openIssuesRow ? openIssuesRow.escalated_count : 0,
      resolvedIssues: openIssuesRow ? openIssuesRow.resolved_count : 0,
      highRiskAssets: riskAssetsRow ? riskAssetsRow.high_risk_count : 0,
      criticalAssets: riskAssetsRow ? riskAssetsRow.critical_health_count : 0,
      categoryBreakdown
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: 'Failed to fetch overview analytics.' });
  }
});

// 2. Repair Effectiveness (Feature 5)
router.get('/repair-effectiveness', async (req, res) => {
  try {
    const db = await getDb();
    const effectiveness = computeRepairEffectiveness(db);
    res.json(effectiveness);
  } catch (err) {
    console.error('Repair effectiveness error:', err);
    res.status(500).json({ error: 'Failed to compute repair effectiveness.' });
  }
});

// 3. Maintenance Waste Indicator (Feature 8)
router.get('/maintenance-waste', async (req, res) => {
  try {
    const db = await getDb();
    const waste = computeMaintenanceWaste(db);
    res.json(waste);
  } catch (err) {
    console.error('Maintenance waste error:', err);
    res.status(500).json({ error: 'Failed to compute maintenance waste analytics.' });
  }
});

// 4. Seasonal Problem Analysis (Feature 10)
router.get('/seasonal-trends', async (req, res) => {
  try {
    const db = await getDb();
    const seasonal = computeSeasonalAnalysis(db);
    res.json(seasonal);
  } catch (err) {
    console.error('Seasonal trends error:', err);
    res.status(500).json({ error: 'Failed to compute seasonal trend analysis.' });
  }
});

// 5. Long-Term Authority / Department Performance (Feature 11)
router.get('/department-performance', async (req, res) => {
  try {
    const db = await getDb();
    const performance = computeDepartmentPerformance(db);
    res.json(performance);
  } catch (err) {
    console.error('Department performance error:', err);
    res.status(500).json({ error: 'Failed to compute department performance.' });
  }
});

// 6. Infrastructure Risk Breakdown (Feature 6)
router.get('/infrastructure-risk', async (req, res) => {
  try {
    const db = await getDb();
    const riskGroups = db.all(`
      SELECT risk_level, COUNT(id) as count
      FROM infrastructure_assets
      GROUP BY risk_level
    `);

    const topAtRiskAssets = db.all(`
      SELECT id, asset_code, name, category, address, risk_score, risk_level, current_health_status, risk_reasons,
        (SELECT COUNT(*) FROM infrastructure_incidents inc WHERE inc.infrastructure_id = a.id) as incident_count
      FROM infrastructure_assets a
      ORDER BY risk_score DESC
      LIMIT 8
    `);

    const formattedTopAssets = topAtRiskAssets.map((asset) => {
      let reasons = [];
      try {
        reasons = asset.risk_reasons ? JSON.parse(asset.risk_reasons) : [];
      } catch (e) {
        reasons = [asset.risk_reasons];
      }
      return { ...asset, risk_reasons: reasons };
    });

    res.json({
      riskGroups,
      topAtRiskAssets: formattedTopAssets
    });
  } catch (err) {
    console.error('Risk analytics error:', err);
    res.status(500).json({ error: 'Failed to compute risk analytics.' });
  }
});

export default router;

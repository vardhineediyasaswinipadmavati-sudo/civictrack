import express from 'express';
import {
  CitizenReport,
  SharedIssue,
  InfrastructureAsset,
  InfrastructureIncident,
  RepairRecord
} from '../models/index.js';
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
    const [
      totalReports,
      uniqueIssues,
      totalAssets,
      recurringIncidents,
      totalRepairs,
      openIssuesCount,
      escalatedIssuesCount,
      resolvedIssuesCount,
      highRiskCount,
      criticalHealthCount,
      categoryAgg
    ] = await Promise.all([
      CitizenReport.countDocuments(),
      SharedIssue.countDocuments({ is_merged_into_id: null }),
      InfrastructureAsset.countDocuments(),
      InfrastructureIncident.countDocuments({ recurrence_sequence: { $gt: 1 } }),
      RepairRecord.countDocuments(),
      SharedIssue.countDocuments({
        status: { $in: ['Pending', 'Assigned', 'In Progress'] },
        is_merged_into_id: null
      }),
      SharedIssue.countDocuments({ status: 'Escalated', is_merged_into_id: null }),
      SharedIssue.countDocuments({ status: 'Resolved', is_merged_into_id: null }),
      InfrastructureAsset.countDocuments({ risk_level: { $in: ['High', 'Critical'] } }),
      InfrastructureAsset.countDocuments({ current_health_status: 'critical' }),
      SharedIssue.aggregate([
        { $match: { is_merged_into_id: null } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    const categoryBreakdown = categoryAgg.map((c) => ({
      category: c._id,
      count: c.count
    }));

    const consolidationRatio = uniqueIssues > 0 ? (totalReports / uniqueIssues).toFixed(2) : '1.00';

    res.json({
      totalCitizenReports: totalReports,
      uniqueCivicIssues: uniqueIssues,
      totalInfrastructureAssets: totalAssets,
      recurringIncidentsCount: recurringIncidents,
      totalRepairAttempts: totalRepairs,
      consolidationRatio: Number(consolidationRatio),
      openIssues: openIssuesCount,
      escalatedIssues: escalatedIssuesCount,
      resolvedIssues: resolvedIssuesCount,
      highRiskAssets: highRiskCount,
      criticalAssets: criticalHealthCount,
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
    const effectiveness = await computeRepairEffectiveness();
    res.json(effectiveness);
  } catch (err) {
    console.error('Repair effectiveness error:', err);
    res.status(500).json({ error: 'Failed to compute repair effectiveness.' });
  }
});

// 3. Maintenance Waste Indicator (Feature 8)
router.get('/maintenance-waste', async (req, res) => {
  try {
    const waste = await computeMaintenanceWaste();
    res.json(waste);
  } catch (err) {
    console.error('Maintenance waste error:', err);
    res.status(500).json({ error: 'Failed to compute maintenance waste analytics.' });
  }
});

// 4. Seasonal Problem Analysis (Feature 10)
router.get('/seasonal-trends', async (req, res) => {
  try {
    const seasonal = await computeSeasonalAnalysis();
    res.json(seasonal);
  } catch (err) {
    console.error('Seasonal trends error:', err);
    res.status(500).json({ error: 'Failed to compute seasonal trend analysis.' });
  }
});

// 5. Long-Term Authority / Department Performance (Feature 11)
router.get('/department-performance', async (req, res) => {
  try {
    const performance = await computeDepartmentPerformance();
    res.json(performance);
  } catch (err) {
    console.error('Department performance error:', err);
    res.status(500).json({ error: 'Failed to compute department performance.' });
  }
});

// 6. Infrastructure Risk Breakdown (Feature 6)
router.get('/infrastructure-risk', async (req, res) => {
  try {
    const riskGroupsAgg = await InfrastructureAsset.aggregate([
      { $group: { _id: '$risk_level', count: { $sum: 1 } } }
    ]);

    const riskGroups = riskGroupsAgg.map((rg) => ({
      risk_level: rg._id,
      count: rg.count
    }));

    const topAssets = await InfrastructureAsset.find()
      .sort({ risk_score: -1 })
      .limit(8);

    const formattedTopAssets = await Promise.all(
      topAssets.map(async (asset) => {
        const incidentCount = await InfrastructureIncident.countDocuments({ infrastructure_id: asset._id });
        return {
          ...asset.toJSON(),
          id: asset._id.toString(),
          incident_count: incidentCount
        };
      })
    );

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

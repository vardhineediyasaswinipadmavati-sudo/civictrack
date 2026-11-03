import express from 'express';
import mongoose from 'mongoose';
import {
  InfrastructureAsset,
  InfrastructureIncident,
  RepairRecord,
  SharedIssue,
  CitizenReport,
  ReportImage,
  StatusHistory,
  Notification,
  Department
} from '../models/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { calculateInfrastructureRisk } from '../utils/riskPredictor.js';

const router = express.Router();

// Helper to resolve asset by ObjectId or legacy_id
async function findAsset(idOrLegacy) {
  if (mongoose.Types.ObjectId.isValid(idOrLegacy)) {
    return InfrastructureAsset.findById(idOrLegacy);
  }
  return InfrastructureAsset.findOne({ legacy_id: Number(idOrLegacy) });
}

// 1. List all infrastructure assets
router.get('/', async (req, res) => {
  try {
    const { category, health_status, risk_level, search } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (health_status) filter.current_health_status = health_status;
    if (risk_level) filter.risk_level = risk_level;

    if (search) {
      const reg = new RegExp(search, 'i');
      filter.$or = [
        { name: reg },
        { asset_code: reg },
        { address: reg }
      ];
    }

    const assets = await InfrastructureAsset.find(filter).sort({ risk_score: -1, name: 1 });

    const formatted = await Promise.all(
      assets.map(async (a) => {
        const assetId = a._id;
        const [linkedIssues, incidentsCount, repairs] = await Promise.all([
          SharedIssue.find({ infrastructure_id: assetId }).distinct('_id'),
          InfrastructureIncident.countDocuments({ infrastructure_id: assetId }),
          RepairRecord.find({ infrastructure_id: assetId }).sort({ completed_at: -1 })
        ]);

        const totalReports = await CitizenReport.countDocuments({ shared_issue_id: { $in: linkedIssues } });
        const lastRepair = repairs.length > 0 ? repairs[0].completed_at : null;

        return {
          ...a.toJSON(),
          id: a._id.toString(),
          total_citizen_reports: totalReports,
          unique_incidents_count: incidentsCount,
          repair_attempts_count: repairs.length,
          last_repair_date: lastRepair
        };
      })
    );

    res.json(formatted);
  } catch (err) {
    console.error('Fetch assets error:', err);
    res.status(500).json({ error: 'Failed to fetch infrastructure assets.' });
  }
});

// 2. Create new infrastructure asset (Admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { asset_code, name, category, latitude, longitude, address, installation_date } = req.body;

    if (!asset_code || !name || !category || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Asset code, name, category, latitude, and longitude are required.' });
    }

    const trimmedCode = asset_code.trim().toUpperCase();
    const existing = await InfrastructureAsset.findOne({ asset_code: trimmedCode });
    if (existing) {
      return res.status(409).json({ error: 'An asset with this code already exists.' });
    }

    const newAsset = await InfrastructureAsset.create({
      asset_code: trimmedCode,
      name: name.trim(),
      category,
      latitude: Number(latitude),
      longitude: Number(longitude),
      address: address || 'Recorded Location',
      installation_date: installation_date || new Date().toISOString().split('T')[0],
      current_health_status: 'good',
      risk_score: 10,
      risk_level: 'Low',
      risk_reasons: ['Newly commissioned infrastructure asset']
    });

    res.status(201).json({ message: 'Infrastructure asset created.', assetId: newAsset._id.toString() });
  } catch (err) {
    console.error('Create asset error:', err);
    res.status(500).json({ error: 'Failed to create infrastructure asset.' });
  }
});

// 3. Dedicated Infrastructure Profile (Feature 3: Infrastructure Failure History)
router.get('/:id', async (req, res) => {
  try {
    const asset = await findAsset(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Infrastructure asset not found.' });
    }

    const assetId = asset._id;

    // Incidents
    const incidents = await InfrastructureIncident.find({ infrastructure_id: assetId })
      .populate('shared_issue_id', 'issue_code status')
      .sort({ started_at: -1 });

    const formattedIncidents = await Promise.all(
      incidents.map(async (inc) => {
        const issue = inc.shared_issue_id;
        const reportCount = issue
          ? await CitizenReport.countDocuments({ shared_issue_id: issue._id })
          : 0;

        return {
          ...inc.toJSON(),
          id: inc._id.toString(),
          issue_code: issue ? issue.issue_code : null,
          issue_status: issue ? issue.status : null,
          report_count: reportCount
        };
      })
    );

    // Repairs
    const repairs = await RepairRecord.find({ infrastructure_id: assetId })
      .populate('repaired_by_user_id', 'name')
      .populate('department_id', 'name')
      .sort({ completed_at: -1 });

    const formattedRepairs = await Promise.all(
      repairs.map(async (rep) => {
        const [beforeImg, afterImg] = await Promise.all([
          ReportImage.findOne({ repair_id: rep._id, image_type: 'before_repair' }),
          ReportImage.findOne({ repair_id: rep._id, image_type: 'after_repair' })
        ]);

        return {
          ...rep.toJSON(),
          id: rep._id.toString(),
          repaired_by_name: rep.repaired_by_user_id ? rep.repaired_by_user_id.name : 'Crew',
          department_name: rep.department_id ? rep.department_id.name : 'Municipal Works',
          before_image: beforeImg ? beforeImg.image_url : null,
          after_image: afterImg ? afterImg.image_url : null
        };
      })
    );

    // Total citizen reports across all issues linked to this asset
    const linkedIssueIds = await SharedIssue.find({ infrastructure_id: assetId }).distinct('_id');
    const totalReports = await CitizenReport.countDocuments({ shared_issue_id: { $in: linkedIssueIds } });

    // Cost summary
    let totalRepairCost = 0;
    let unrecordedCostCount = 0;
    for (const r of repairs) {
      if (r.cost_unavailable) {
        unrecordedCostCount++;
      } else if (r.cost_amount !== null && !isNaN(r.cost_amount)) {
        totalRepairCost += Number(r.cost_amount);
      }
    }

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
    const activeIssues = await SharedIssue.find({
      infrastructure_id: assetId,
      status: { $ne: 'Resolved' }
    });

    const formattedActiveIssues = await Promise.all(
      activeIssues.map(async (s) => {
        const count = await CitizenReport.countDocuments({ shared_issue_id: s._id });
        return {
          ...s.toJSON(),
          id: s._id.toString(),
          report_count: count
        };
      })
    );

    // Combined Chronological Timeline
    const timeline = [];
    for (const inc of incidents) {
      timeline.push({
        type: 'incident',
        date: inc.started_at,
        title: `Failure: ${inc.incident_type}`,
        description: inc.description,
        code: inc.incident_code,
        sequence: inc.recurrence_sequence,
        id: inc._id.toString()
      });
    }

    for (const rep of formattedRepairs) {
      timeline.push({
        type: 'repair',
        date: rep.completed_at,
        title: `Maintenance: ${(rep.repair_type || 'STANDARD').toUpperCase()} repair`,
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
        ...asset.toJSON(),
        id: asset._id.toString()
      },
      stats: {
        totalCitizenReports: totalReports,
        uniqueIncidentsCount: incidents.length,
        repairAttemptsCount: repairs.length,
        mtbfDays,
        totalRepairCost: Math.round(totalRepairCost),
        unrecordedCostCount
      },
      incidents: formattedIncidents,
      repairs: formattedRepairs,
      activeIssues: formattedActiveIssues,
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
    const asset = await findAsset(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Infrastructure asset not found.' });
    }

    const {
      shared_issue_id,
      incident_id,
      department_id,
      repair_type,
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

    let resolvedDeptId = req.user.department_id || department_id;
    if (!resolvedDeptId) {
      const firstDept = await Department.findOne();
      resolvedDeptId = firstDept ? firstDept._id : null;
    }

    let resolvedIssueId = null;
    if (shared_issue_id) {
      if (mongoose.Types.ObjectId.isValid(shared_issue_id)) {
        resolvedIssueId = shared_issue_id;
      } else {
        const issueDoc = await SharedIssue.findOne({ legacy_id: Number(shared_issue_id) });
        if (issueDoc) resolvedIssueId = issueDoc._id;
      }
    }

    const repairCode = `REP-REC-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();

    const newRepair = await RepairRecord.create({
      repair_code: repairCode,
      infrastructure_id: asset._id,
      incident_id: incident_id || null,
      shared_issue_id: resolvedIssueId,
      repaired_by_user_id: req.user.id,
      department_id: resolvedDeptId,
      repair_type,
      cost_amount: cost_unavailable ? null : (cost_amount !== undefined && cost_amount !== null ? Number(cost_amount) : null),
      cost_unavailable: Boolean(cost_unavailable),
      materials_used: materials_used || null,
      work_summary: work_summary.trim(),
      completed_at: now
    });

    // Attach before & after images
    if (before_image_url) {
      await ReportImage.create({
        shared_issue_id: resolvedIssueId,
        repair_id: newRepair._id,
        image_url: before_image_url,
        image_type: 'before_repair'
      });
    }

    if (after_image_url) {
      await ReportImage.create({
        shared_issue_id: resolvedIssueId,
        repair_id: newRepair._id,
        image_url: after_image_url,
        image_type: 'after_repair'
      });
    }

    // If linked to shared issue, transition issue to Resolved with resolutionType
    if (resolvedIssueId) {
      const issue = await SharedIssue.findById(resolvedIssueId);
      if (issue) {
        issue.status = 'Resolved';
        issue.resolved_at = now;
        issue.resolution_type = repair_type;
        issue.resolution_notes = work_summary.trim();
        issue.updated_at = now;
        await issue.save();

        await CitizenReport.updateMany({ shared_issue_id: resolvedIssueId }, { status: 'Resolved' });

        await StatusHistory.create({
          shared_issue_id: resolvedIssueId,
          old_status: 'In Progress',
          new_status: 'Resolved',
          changed_by_user_id: req.user.id,
          comments: `Repair completed (${repair_type}): ${work_summary.trim()}`
        });

        // Notify linked citizens
        const reporters = await CitizenReport.find({ shared_issue_id: resolvedIssueId }).distinct('user_id');
        for (const uId of reporters) {
          await Notification.create({
            user_id: uId,
            title: 'Repair Completed',
            message: `Work has been completed on your reported issue (${repair_type}). Please help verify if the repair is effective!`,
            link_url: `/issues/${resolvedIssueId.toString()}`,
            is_read: false
          });
        }
      }
    }

    // Recalculate asset risk score & health status
    const allIncidents = await InfrastructureIncident.find({ infrastructure_id: asset._id });
    const allRepairs = await RepairRecord.find({ infrastructure_id: asset._id });
    const openCount = await SharedIssue.countDocuments({
      infrastructure_id: asset._id,
      status: { $ne: 'Resolved' }
    });

    const updatedRisk = calculateInfrastructureRisk({
      asset,
      distinctIncidents: allIncidents,
      repairRecords: allRepairs,
      unresolvedIssuesCount: openCount
    });

    asset.current_health_status = updatedRisk.healthStatus;
    asset.risk_score = updatedRisk.riskScore;
    asset.risk_level = updatedRisk.riskLevel;
    asset.risk_reasons = updatedRisk.reasons;
    asset.last_inspected_at = now;
    await asset.save();

    res.status(201).json({
      message: 'Repair record logged successfully.',
      repairId: newRepair._id.toString(),
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

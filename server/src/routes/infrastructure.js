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
import { seedDemoInfrastructureAssets } from '../db/demoAssets.js';

const router = express.Router();

// Helper to resolve asset by ObjectId or legacy_id
async function findAsset(idOrLegacy) {
  if (mongoose.Types.ObjectId.isValid(idOrLegacy)) {
    return InfrastructureAsset.findById(idOrLegacy).populate('department_id', 'name code');
  }
  return InfrastructureAsset.findOne({ legacy_id: Number(idOrLegacy) }).populate('department_id', 'name code');
}

// 1. List all infrastructure assets
router.get('/', async (req, res) => {
  try {
    // If the database has 0 assets, auto-seed realistic Bhimavaram demonstration assets
    const totalAssets = await InfrastructureAsset.countDocuments();
    if (totalAssets === 0) {
      try {
        await seedDemoInfrastructureAssets();
      } catch (seedErr) {
        console.warn('Auto-seed demo assets warning:', seedErr.message);
      }
    }

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
        { address: reg },
        { category: reg }
      ];
    }

    const assets = await InfrastructureAsset.find(filter)
      .populate('department_id', 'name code')
      .sort({ risk_score: -1, name: 1 });

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
        const dept = a.department_id;

        return {
          ...a.toJSON(),
          id: a._id.toString(),
          department_name: dept && dept.name ? dept.name : null,
          department_code: dept && dept.code ? dept.code : null,
          is_demo: !!a.is_demo,
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

function getAssetCodePrefix(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('road') || cat.includes('pothole')) return 'AST-RD-';
  if (cat.includes('light') || cat.includes('electr')) return 'AST-SL-';
  if (cat.includes('drain') || cat.includes('sewag')) return 'AST-DR-';
  if (cat.includes('water')) return 'AST-WS-';
  if (cat.includes('build') || cat.includes('facil') || cat.includes('struct')) return 'AST-PB-';
  if (cat.includes('garb') || cat.includes('sanit') || cat.includes('waste')) return 'AST-SN-';
  if (cat.includes('park')) return 'AST-PK-';
  return 'AST-GEN-';
}

function getDeptCodeForCategory(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('road') || cat.includes('pothole')) return 'ROADS';
  if (cat.includes('light') || cat.includes('electr')) return 'ELECTRICAL';
  if (cat.includes('water') || cat.includes('drain') || cat.includes('sewag')) return 'WATER';
  if (cat.includes('garb') || cat.includes('sanit')) return 'SANITATION';
  if (cat.includes('build') || cat.includes('facil')) return 'FACILITIES';
  return 'ROADS';
}

async function generateUniqueAssetCode(category) {
  const prefix = getAssetCodePrefix(category);
  let isUnique = false;
  let code = '';
  let attempt = 0;
  while (!isUnique && attempt < 50) {
    attempt++;
    const num = Math.floor(100 + Math.random() * 900);
    code = `${prefix}${num}`;
    const existing = await InfrastructureAsset.findOne({ asset_code: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
}

// 2. Create new infrastructure asset (Admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { asset_code, name, category, latitude, longitude, address, department_id, installation_date, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Asset name is required.' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Asset category is required.' });
    }
    if (latitude === undefined || latitude === null || isNaN(Number(latitude))) {
      return res.status(400).json({ error: 'Valid latitude coordinate is required.' });
    }
    if (longitude === undefined || longitude === null || isNaN(Number(longitude))) {
      return res.status(400).json({ error: 'Valid longitude coordinate is required.' });
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ error: 'Address/location is required.' });
    }

    const trimmedName = name.trim();

    // Prevent accidental duplicate assets with the same name in the same category
    const duplicateAsset = await InfrastructureAsset.findOne({
      name: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      category: category.trim()
    });
    if (duplicateAsset) {
      return res.status(409).json({
        error: `An asset named "${duplicateAsset.name}" is already registered in category "${duplicateAsset.category}" (${duplicateAsset.asset_code}).`
      });
    }

    // Resolve or generate unique asset code
    let finalCode = '';
    if (asset_code && asset_code.trim()) {
      finalCode = asset_code.trim().toUpperCase();
      const existingCode = await InfrastructureAsset.findOne({ asset_code: finalCode });
      if (existingCode) {
        return res.status(409).json({ error: `An asset with code "${finalCode}" already exists.` });
      }
    } else {
      finalCode = await generateUniqueAssetCode(category.trim());
    }

    // Resolve responsible department
    let resolvedDeptId = null;
    if (department_id) {
      if (mongoose.Types.ObjectId.isValid(department_id)) {
        const dept = await Department.findById(department_id);
        if (dept) resolvedDeptId = dept._id;
      }
    }
    if (!resolvedDeptId) {
      const targetDeptCode = getDeptCodeForCategory(category.trim());
      const defaultDept = (await Department.findOne({ code: targetDeptCode })) || (await Department.findOne());
      if (defaultDept) resolvedDeptId = defaultDept._id;
    }

    const reasons = [];
    if (description && description.trim()) {
      reasons.push(description.trim());
    } else {
      reasons.push('Newly registered municipal infrastructure asset');
    }

    const newAsset = await InfrastructureAsset.create({
      asset_code: finalCode,
      name: trimmedName,
      category: category.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      address: address.trim(),
      department_id: resolvedDeptId,
      installation_date: installation_date || new Date().toISOString().split('T')[0],
      current_health_status: 'good',
      risk_score: 10,
      risk_level: 'Low',
      risk_reasons: reasons,
      is_demo: false
    });

    res.status(201).json({
      message: 'Infrastructure asset created successfully.',
      assetId: newAsset._id.toString(),
      asset_code: newAsset.asset_code,
      asset: newAsset
    });
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
// Optional infrastructure asset association: If unlinked or asset missing, saves against the complaint itself
async function handleRecordRepair(req, res) {
  try {
    const assetParam = req.params.id;
    let asset = null;
    const isSpecialParam = !assetParam || assetParam === 'none' || assetParam === 'unlinked' || assetParam === 'null' || assetParam === 'undefined';

    if (!isSpecialParam) {
      asset = await findAsset(assetParam);
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

    let resolvedIssue = null;
    let resolvedIssueId = null;
    if (shared_issue_id) {
      if (mongoose.Types.ObjectId.isValid(shared_issue_id)) {
        resolvedIssue = await SharedIssue.findById(shared_issue_id);
      } else {
        resolvedIssue = await SharedIssue.findOne({ legacy_id: Number(shared_issue_id) });
      }
      if (resolvedIssue) {
        resolvedIssueId = resolvedIssue._id;
        // If asset was not resolved from URL parameter, check if the issue itself has a linked asset
        if (!asset && resolvedIssue.infrastructure_id) {
          asset = await InfrastructureAsset.findById(resolvedIssue.infrastructure_id);
        }
      }
    }

    // Require at least a valid complaint issue or infrastructure asset to anchor the repair
    if (!asset && !resolvedIssue) {
      return res.status(400).json({ error: 'A valid complaint issue or infrastructure asset is required to record a repair.' });
    }

    const validRepairTypes = ['temporary', 'permanent', 'inspection_only', 'no_fault'];
    if (!repair_type || !validRepairTypes.includes(repair_type)) {
      return res.status(400).json({ error: `Invalid repair type. Must be one of: ${validRepairTypes.join(', ')}` });
    }

    if (!work_summary || work_summary.trim().length < 5) {
      return res.status(400).json({ error: 'A clear work summary (at least 5 characters) is required.' });
    }

    let resolvedDeptId = req.user.department_id || department_id || (resolvedIssue ? resolvedIssue.department_id : null);
    if (!resolvedDeptId) {
      const firstDept = await Department.findOne();
      resolvedDeptId = firstDept ? firstDept._id : null;
    }

    const repairCode = `REP-REC-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();

    const newRepair = await RepairRecord.create({
      repair_code: repairCode,
      infrastructure_id: asset ? asset._id : null,
      incident_id: incident_id || (resolvedIssue ? resolvedIssue.incident_id : null) || null,
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
    if (resolvedIssue) {
      resolvedIssue.status = 'Resolved';
      resolvedIssue.resolved_at = now;
      resolvedIssue.resolution_type = repair_type;
      resolvedIssue.resolution_notes = work_summary.trim();
      resolvedIssue.updated_at = now;
      await resolvedIssue.save();

      await CitizenReport.updateMany({ shared_issue_id: resolvedIssue._id }, { status: 'Resolved' });

      await StatusHistory.create({
        shared_issue_id: resolvedIssue._id,
        old_status: 'In Progress',
        new_status: 'Resolved',
        changed_by_user_id: req.user.id,
        comments: `Repair completed (${repair_type}): ${work_summary.trim()}`
      });

      // Notify linked citizens
      const reporters = await CitizenReport.find({ shared_issue_id: resolvedIssue._id }).distinct('user_id');
      for (const uId of reporters) {
        await Notification.create({
          user_id: uId,
          title: 'Repair Completed',
          message: `Work has been completed on your reported issue (${repair_type}). Please help verify if the repair is effective!`,
          link_url: `/issues/${resolvedIssue._id.toString()}`,
          is_read: false
        });
      }
    }

    // Recalculate asset risk score & health status only if an asset is associated
    let updatedHealthStatus = null;
    let updatedRiskScore = null;
    if (asset) {
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

      updatedHealthStatus = updatedRisk.healthStatus;
      updatedRiskScore = updatedRisk.riskScore;
    }

    res.status(201).json({
      message: 'Repair record logged successfully.',
      repairId: newRepair._id.toString(),
      repairCode,
      assetLinked: Boolean(asset),
      updatedHealthStatus,
      updatedRiskScore
    });
  } catch (err) {
    console.error('Record repair error:', err);
    res.status(500).json({ error: 'Failed to record repair.' });
  }
}

router.post('/repairs', authenticateToken, requireRole('admin', 'department_staff'), handleRecordRepair);
router.post('/:id/repairs', authenticateToken, requireRole('admin', 'department_staff'), handleRecordRepair);

export default router;

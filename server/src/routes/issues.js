import express from 'express';
import mongoose from 'mongoose';
import {
  SharedIssue,
  Department,
  InfrastructureAsset,
  User,
  CitizenReport,
  ReportImage,
  StatusHistory,
  RepairRecord,
  CitizenVerification,
  IssueFollow,
  Notification,
  AuditLog
} from '../models/index.js';
import { authenticateToken, requireRole, optionalAuth } from '../middleware/auth.js';
import { calculateDistanceMeters } from '../utils/duplicateDetector.js';

const router = express.Router();

// Helper to resolve issue by ObjectId or legacy_id
async function findIssue(idOrLegacy) {
  if (mongoose.Types.ObjectId.isValid(idOrLegacy)) {
    return SharedIssue.findById(idOrLegacy);
  }
  return SharedIssue.findOne({ legacy_id: Number(idOrLegacy) });
}

// 1. List shared civic issues with filtering
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, status, department_id, search, priority, mineOnly } = req.query;
    const filter = { is_merged_into_id: null };

    // Filter to issues belonging to or followed by the authenticated citizen
    if (mineOnly === 'true') {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required to view your issues.' });
      }

      const [myReportIssueIds, myFollowedIssueIds] = await Promise.all([
        CitizenReport.find({ user_id: req.user.id }).distinct('shared_issue_id'),
        IssueFollow.find({ user_id: req.user.id }).distinct('shared_issue_id')
      ]);

      const combinedIds = [
        ...myReportIssueIds.filter(Boolean),
        ...myFollowedIssueIds.filter(Boolean)
      ];

      filter._id = { $in: combinedIds };
    }

    if (category) {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    }

    if (department_id) {
      if (mongoose.Types.ObjectId.isValid(department_id)) {
        filter.department_id = department_id;
      } else {
        const deptDoc = await Department.findOne({ legacy_id: Number(department_id) });
        if (deptDoc) {
          filter.department_id = deptDoc._id;
        }
      }
    }

    if (priority) {
      if (priority === 'Critical') {
        filter.$or = [{ priority_score: { $gte: 80 } }, { is_safety_critical: true }];
      } else if (priority === 'High') {
        filter.priority_score = { $gte: 60, $lt: 80 };
      } else if (priority === 'Medium') {
        filter.priority_score = { $gte: 35, $lt: 60 };
      } else if (priority === 'Low') {
        filter.priority_score = { $lt: 35 };
      }
    }

    if (search) {
      const reg = new RegExp(search, 'i');
      filter.$or = [
        { title: reg },
        { description: reg },
        { address: reg },
        { issue_code: reg }
      ];
    }

    const issues = await SharedIssue.find(filter)
      .populate('department_id', 'name code')
      .populate('infrastructure_id', 'name asset_code current_health_status risk_score')
      .sort({ is_safety_critical: -1, priority_score: -1, created_at: -1 });

    const formatted = await Promise.all(
      issues.map(async (s) => {
        const [reportCount, primaryImg] = await Promise.all([
          CitizenReport.countDocuments({ shared_issue_id: s._id }),
          ReportImage.findOne({ shared_issue_id: s._id, image_type: 'evidence' })
        ]);

        const dept = s.department_id;
        const asset = s.infrastructure_id;

        return {
          ...s.toJSON(),
          id: s._id.toString(),
          department_id: dept ? (dept._id || dept).toString() : null,
          department_name: dept ? dept.name : null,
          department_code: dept ? dept.code : null,
          infrastructure_id: asset ? (asset._id || asset).toString() : null,
          asset_name: asset ? asset.name : null,
          asset_code: asset ? asset.asset_code : null,
          citizen_reports_count: reportCount,
          primary_image: primaryImg ? primaryImg.image_url : null
        };
      })
    );

    res.json(formatted);
  } catch (err) {
    console.error('Fetch issues error:', err);
    res.status(500).json({ error: 'Failed to fetch civic issues.' });
  }
});

// 2. Nearby issues by coordinates
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lon, radiusMeters = 1000 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    const allIssues = await SharedIssue.find({ is_merged_into_id: null })
      .populate('department_id', 'name');

    const nearby = [];
    for (const issue of allIssues) {
      const dist = calculateDistanceMeters(Number(lat), Number(lon), issue.latitude, issue.longitude);
      if (dist <= Number(radiusMeters)) {
        const [reportCount, primaryImg] = await Promise.all([
          CitizenReport.countDocuments({ shared_issue_id: issue._id }),
          ReportImage.findOne({ shared_issue_id: issue._id })
        ]);

        const dept = issue.department_id;
        nearby.push({
          ...issue.toJSON(),
          id: issue._id.toString(),
          department_name: dept ? dept.name : null,
          citizen_reports_count: reportCount,
          primary_image: primaryImg ? primaryImg.image_url : null,
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
    const issue = await findIssue(req.params.id);

    if (!issue) {
      return res.status(404).json({ error: 'Shared issue not found.' });
    }

    await issue.populate('department_id', 'name code sla_hours');
    await issue.populate('infrastructure_id', 'name asset_code current_health_status risk_score');
    await issue.populate('assigned_to_user_id', 'name email');

    const issueId = issue._id;

    // Citizen reports linked to this shared issue
    const citizenReports = await CitizenReport.find({ shared_issue_id: issueId })
      .populate('user_id', 'name email')
      .sort({ created_at: 1 });

    const formattedReports = await Promise.all(
      citizenReports.map(async (r) => {
        const evidenceImg = await ReportImage.findOne({ report_id: r._id, image_type: 'evidence' });
        const user = r.user_id;
        return {
          ...r.toJSON(),
          id: r._id.toString(),
          reporter_name: user ? user.name : 'Citizen',
          reporter_email: user ? user.email : null,
          evidence_image: evidenceImg ? evidenceImg.image_url : null
        };
      })
    );

    // All evidence images
    const images = await ReportImage.find({ shared_issue_id: issueId }).sort({ created_at: -1 });

    // Status audit timeline
    const history = await StatusHistory.find({ shared_issue_id: issueId })
      .populate('changed_by_user_id', 'name role')
      .sort({ created_at: 1 });

    const formattedHistory = history.map((h) => {
      const u = h.changed_by_user_id;
      return {
        ...h.toJSON(),
        id: h._id.toString(),
        changed_by_name: u ? u.name : 'System User',
        changed_by_role: u ? u.role : 'staff'
      };
    });

    // Repair records associated with this issue
    const repairs = await RepairRecord.find({ shared_issue_id: issueId })
      .populate('repaired_by_user_id', 'name')
      .populate('department_id', 'name')
      .sort({ completed_at: -1 });

    const formattedRepairs = repairs.map((rep) => ({
      ...rep.toJSON(),
      id: rep._id.toString(),
      repaired_by_name: rep.repaired_by_user_id ? rep.repaired_by_user_id.name : 'Maintenance Crew',
      department_name: rep.department_id ? rep.department_id.name : 'Municipal Works'
    }));

    // Citizen verifications
    const verifications = await CitizenVerification.find({ shared_issue_id: issueId })
      .populate('user_id', 'name')
      .sort({ created_at: -1 });

    const formattedVerifications = verifications.map((v) => ({
      ...v.toJSON(),
      id: v._id.toString(),
      user_name: v.user_id ? v.user_id.name : 'Citizen'
    }));

    // Follower count & user follow state
    const followerCount = await IssueFollow.countDocuments({ shared_issue_id: issueId });
    const isFollowing = req.user
      ? !!(await IssueFollow.findOne({ shared_issue_id: issueId, user_id: req.user.id }))
      : false;

    const dept = issue.department_id;
    const asset = issue.infrastructure_id;
    const staff = issue.assigned_to_user_id;

    const formattedIssue = {
      ...issue.toJSON(),
      id: issue._id.toString(),
      department_id: dept ? (dept._id || dept).toString() : null,
      department_name: dept ? dept.name : null,
      department_code: dept ? dept.code : null,
      sla_hours: dept ? dept.sla_hours : 72,
      infrastructure_id: asset ? (asset._id || asset).toString() : null,
      asset_name: asset ? asset.name : null,
      asset_code: asset ? asset.asset_code : null,
      asset_health: asset ? asset.current_health_status : null,
      asset_risk: asset ? asset.risk_score : null,
      assigned_to_user_id: staff ? (staff._id || staff).toString() : null,
      assigned_staff_name: staff ? staff.name : null
    };

    res.json({
      issue: formattedIssue,
      citizenReports: formattedReports,
      images: images.map((img) => ({ ...img.toJSON(), id: img._id.toString() })),
      history: formattedHistory,
      repairs: formattedRepairs,
      verifications: formattedVerifications,
      followersCount: followerCount,
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
    const { status, comments, resolutionType } = req.body;
    const validStatuses = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Reopened', 'Escalated'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const currentIssue = await findIssue(req.params.id);
    if (!currentIssue) {
      return res.status(404).json({ error: 'Shared issue not found.' });
    }

    // Role check: Department staff can only update issues belonging to their assigned department
    if (req.user.role === 'department_staff') {
      const issueDeptId = currentIssue.department_id ? currentIssue.department_id.toString() : null;
      const userDeptId = req.user.department_id ? req.user.department_id.toString() : null;

      if (issueDeptId && userDeptId && issueDeptId !== userDeptId) {
        return res.status(403).json({
          error: 'Access denied. You can only update work orders assigned to your municipal department.'
        });
      }
    }

    const now = new Date();
    currentIssue.status = status;
    if (status === 'Resolved' && !currentIssue.resolved_at) {
      currentIssue.resolved_at = now;
    }
    if (resolutionType) {
      currentIssue.resolution_type = resolutionType;
    }
    currentIssue.updated_at = now;
    await currentIssue.save();

    // Update status on all linked citizen reports
    await CitizenReport.updateMany(
      { shared_issue_id: currentIssue._id },
      { status }
    );

    // Add status history record
    await StatusHistory.create({
      shared_issue_id: currentIssue._id,
      old_status: currentIssue.status,
      new_status: status,
      changed_by_user_id: req.user.id,
      comments: comments || `Status transitioned to ${status}`
    });

    // Notify all linked citizens & followers
    const [reporters, followers] = await Promise.all([
      CitizenReport.find({ shared_issue_id: currentIssue._id }).distinct('user_id'),
      IssueFollow.find({ shared_issue_id: currentIssue._id }).distinct('user_id')
    ]);

    const linkedUserIds = new Set([...reporters, ...followers].map((id) => id.toString()));

    for (const uId of linkedUserIds) {
      await Notification.create({
        user_id: uId,
        title: `Status Update: Issue ${currentIssue.issue_code}`,
        message: `The status of civic issue "${currentIssue.title}" has been updated to ${status}.`,
        link_url: `/issues/${currentIssue._id.toString()}`,
        is_read: false
      });
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
    const { department_id, assigned_to_user_id, comments } = req.body;
    const currentIssue = await findIssue(req.params.id);

    if (!currentIssue) {
      return res.status(404).json({ error: 'Shared issue not found.' });
    }

    let resolvedDeptId = currentIssue.department_id;
    if (department_id) {
      let dept;
      if (mongoose.Types.ObjectId.isValid(department_id)) {
        dept = await Department.findById(department_id);
      } else {
        dept = await Department.findOne({ legacy_id: Number(department_id) });
      }

      if (!dept) {
        return res.status(400).json({ error: 'Selected department does not exist.' });
      }
      resolvedDeptId = dept._id;
    }

    let resolvedStaffId = currentIssue.assigned_to_user_id;
    if (assigned_to_user_id) {
      let staff;
      if (mongoose.Types.ObjectId.isValid(assigned_to_user_id)) {
        staff = await User.findById(assigned_to_user_id);
      } else {
        staff = await User.findOne({ legacy_id: Number(assigned_to_user_id) });
      }

      if (!staff) {
        return res.status(400).json({ error: 'Assigned staff user does not exist.' });
      }
      resolvedStaffId = staff._id;
    }

    const newStatus = currentIssue.status === 'Pending' ? 'Assigned' : currentIssue.status;
    const oldStatus = currentIssue.status;

    currentIssue.department_id = resolvedDeptId;
    currentIssue.assigned_to_user_id = resolvedStaffId;
    currentIssue.status = newStatus;
    currentIssue.updated_at = new Date();
    await currentIssue.save();

    // Log history
    await StatusHistory.create({
      shared_issue_id: currentIssue._id,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by_user_id: req.user.id,
      comments: comments || `Assigned department and staff crew.`
    });

    res.json({ message: 'Issue assigned successfully.' });
  } catch (err) {
    console.error('Assign issue error:', err);
    res.status(500).json({ error: 'Failed to assign issue.' });
  }
});

// 6. Reopen issue (Citizen or Staff)
router.post('/:id/reopen', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'A specific explanation is required to reopen an issue.' });
    }

    const issue = await findIssue(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    if (issue.status !== 'Resolved') {
      return res.status(400).json({ error: 'Only resolved issues can be reopened.' });
    }

    const now = new Date();
    issue.status = 'Reopened';
    issue.resolved_at = null;
    issue.updated_at = now;
    await issue.save();

    await CitizenReport.updateMany({ shared_issue_id: issue._id }, { status: 'Reopened' });

    await StatusHistory.create({
      shared_issue_id: issue._id,
      old_status: 'Resolved',
      new_status: 'Reopened',
      changed_by_user_id: req.user.id,
      comments: `Reopened: ${reason.trim()}`
    });

    if (issue.infrastructure_id) {
      await RepairRecord.updateMany(
        { shared_issue_id: issue._id },
        { recurrence_observed: true }
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
    const { is_effective, feedback } = req.body;
    if (is_effective === undefined) {
      return res.status(400).json({ error: 'is_effective (true or false) is required.' });
    }

    const issue = await findIssue(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    await CitizenVerification.create({
      shared_issue_id: issue._id,
      user_id: req.user.id,
      is_effective: Boolean(is_effective),
      feedback: feedback || null
    });

    res.json({ message: 'Verification recorded. Thank you for helping verify community repairs!' });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Failed to record verification.' });
  }
});

// 8. Follow / Unfollow issue
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const issue = await findIssue(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found.' });
    }

    const existing = await IssueFollow.findOne({ shared_issue_id: issue._id, user_id: req.user.id });

    if (existing) {
      await IssueFollow.deleteOne({ _id: existing._id });
      return res.json({ following: false, message: 'Unfollowed issue updates.' });
    } else {
      await IssueFollow.create({ shared_issue_id: issue._id, user_id: req.user.id });
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
    const { sourceIssueId, reason } = req.body;

    const targetIssue = await findIssue(req.params.id);
    const sourceIssue = await findIssue(sourceIssueId);

    if (!targetIssue || !sourceIssue) {
      return res.status(404).json({ error: 'Target or source shared issue not found.' });
    }

    if (targetIssue._id.toString() === sourceIssue._id.toString()) {
      return res.status(400).json({ error: 'Cannot merge an issue into itself.' });
    }

    const now = new Date();

    // 1. Move all citizen reports from source issue to target issue
    await CitizenReport.updateMany(
      { shared_issue_id: sourceIssue._id },
      { shared_issue_id: targetIssue._id, link_type: 'admin_merged' }
    );

    // 2. Move images
    await ReportImage.updateMany(
      { shared_issue_id: sourceIssue._id },
      { shared_issue_id: targetIssue._id }
    );

    // 3. Mark source issue as merged
    sourceIssue.is_merged_into_id = targetIssue._id;
    sourceIssue.status = 'Resolved';
    sourceIssue.resolution_notes = `Merged into issue ${targetIssue.issue_code}: ${reason || 'Duplicate physical problem'}`;
    sourceIssue.updated_at = now;
    await sourceIssue.save();

    // 4. Update target issue latest reported at
    targetIssue.latest_reported_at = now;
    targetIssue.updated_at = now;
    await targetIssue.save();

    const totalReports = await CitizenReport.countDocuments({ shared_issue_id: targetIssue._id });

    // 5. Create audit log entry
    await AuditLog.create({
      action: 'MERGE_ISSUES',
      entity_type: 'shared_issue',
      entity_id: targetIssue._id,
      user_id: req.user.id,
      details: JSON.stringify({
        sourceIssueId: sourceIssue._id.toString(),
        sourceCode: sourceIssue.issue_code,
        targetIssueId: targetIssue._id.toString(),
        targetCode: targetIssue.issue_code,
        reason: reason || 'Consolidated duplicate complaints into single physical master issue'
      })
    });

    // 6. Notify reporters from target issue
    const affectedUserIds = await CitizenReport.find({ shared_issue_id: targetIssue._id }).distinct('user_id');

    for (const uId of affectedUserIds) {
      await Notification.create({
        user_id: uId,
        title: 'Issues Consolidated',
        message: `Your reported issue was consolidated into master civic issue ${targetIssue.issue_code} for synchronized municipal repair tracking.`,
        link_url: `/issues/${targetIssue._id.toString()}`,
        is_read: false
      });
    }

    res.json({
      message: `Successfully merged issue ${sourceIssue.issue_code} into ${targetIssue.issue_code}.`,
      targetIssueId: targetIssue._id.toString(),
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
    const { reportId, reason } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required to separate.' });
    }

    let report;
    if (mongoose.Types.ObjectId.isValid(reportId)) {
      report = await CitizenReport.findById(reportId);
    } else {
      report = await CitizenReport.findOne({ legacy_id: Number(reportId) });
    }

    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const now = new Date();
    const newIssueCode = `CT-${Math.floor(200 + Math.random() * 800)}`;

    // Create new independent shared issue
    const newIssue = await SharedIssue.create({
      issue_code: newIssueCode,
      title: report.title,
      category: report.category,
      description: report.description,
      severity: report.severity,
      priority_score: 40,
      is_safety_critical: false,
      status: 'Pending',
      latitude: report.latitude,
      longitude: report.longitude,
      address: report.address,
      first_reported_at: report.created_at,
      latest_reported_at: now
    });

    // Update report
    const originalSharedIssueId = report.shared_issue_id;
    report.shared_issue_id = newIssue._id;
    report.link_type = 'original';
    await report.save();

    // Update images associated with this report
    await ReportImage.updateMany(
      { report_id: report._id },
      { shared_issue_id: newIssue._id }
    );

    // Audit log
    await AuditLog.create({
      action: 'SEPARATE_REPORT',
      entity_type: 'citizen_report',
      entity_id: report._id,
      user_id: req.user.id,
      details: JSON.stringify({
        originalSharedIssueId: originalSharedIssueId ? originalSharedIssueId.toString() : null,
        newSharedIssueId: newIssue._id.toString(),
        newIssueCode,
        reason: reason || 'Determined to represent distinct physical infrastructure fault'
      })
    });

    res.json({
      message: `Report ${report.report_code} successfully separated into new issue ${newIssueCode}.`,
      newIssueId: newIssue._id.toString(),
      newIssueCode
    });
  } catch (err) {
    console.error('Separate error:', err);
    res.status(500).json({ error: 'Failed to separate report.' });
  }
});

export default router;

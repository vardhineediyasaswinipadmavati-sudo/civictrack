import express from 'express';
import mongoose from 'mongoose';
import {
  CitizenReport,
  SharedIssue,
  InfrastructureAsset,
  InfrastructureIncident,
  ReportImage,
  StatusHistory,
  IssueFollow,
  Notification,
  Department,
  User,
  RepairRecord
} from '../models/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { uploadImageToStorage } from '../utils/cloudinary.js';
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
    const { category, latitude, longitude, title, description } = req.body;

    if (!latitude || !longitude || !category) {
      return res.status(400).json({ error: 'Latitude, longitude, and category are required.' });
    }

    const openIssues = await SharedIssue.find({ is_merged_into_id: null });

    const issuesWithDetails = await Promise.all(
      openIssues.map(async (s) => {
        const [reportCount, previewImg] = await Promise.all([
          CitizenReport.countDocuments({ shared_issue_id: s._id }),
          ReportImage.findOne({ shared_issue_id: s._id })
        ]);
        const obj = s.toJSON();
        return {
          ...obj,
          id: s._id.toString(),
          report_count: reportCount,
          preview_image: previewImg ? previewImg.image_url : null
        };
      })
    );

    const candidate = {
      category,
      latitude: Number(latitude),
      longitude: Number(longitude),
      title: title || '',
      description: description || ''
    };

    const duplicateMatches = findNearbyDuplicates(candidate, issuesWithDetails);

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
    const {
      title,
      category,
      description,
      severity = 'Medium',
      latitude,
      longitude,
      address,
      confirmedExistingIssueId,
      isSafetyCritical = 0,
      imageUrls = []
    } = req.body;

    if (!title || !category || !description || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Title, category, description, latitude, and longitude are required.' });
    }

    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required. No valid user ID found in session.' });
    }

    const userRecord = await User.findById(userId);
    if (!userRecord) {
      return res.status(401).json({ error: 'Authenticated user account was not found in the database. Please log in again.' });
    }

    const reportCode = `REP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const now = new Date();

    let sharedIssue = null;
    let linkType = 'original';

    if (confirmedExistingIssueId !== undefined && confirmedExistingIssueId !== null && confirmedExistingIssueId !== '') {
      let queryFilter;
      if (mongoose.Types.ObjectId.isValid(confirmedExistingIssueId)) {
        queryFilter = { _id: confirmedExistingIssueId };
      } else {
        queryFilter = { legacy_id: Number(confirmedExistingIssueId) };
      }

      sharedIssue = await SharedIssue.findOne(queryFilter);
      if (!sharedIssue) {
        return res.status(404).json({ error: 'The selected shared issue does not exist.' });
      }
      linkType = 'confirmed_duplicate';
    }

    // SCENARIO 1: Citizen joins an existing shared issue
    if (sharedIssue) {
      const newReport = await CitizenReport.create({
        report_code: reportCode,
        user_id: userRecord._id,
        shared_issue_id: sharedIssue._id,
        title: title.trim(),
        category,
        description: description.trim(),
        severity,
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: address || sharedIssue.address,
        status: sharedIssue.status,
        similarity_match_score: 95,
        link_type: linkType
      });

      // Attach images to this report and to the shared issue gallery
      for (const url of imageUrls) {
        await ReportImage.create({
          report_id: newReport._id,
          shared_issue_id: sharedIssue._id,
          image_url: url,
          image_type: 'evidence'
        });
      }

      // Update shared issue latest report timestamp & recalculate priority
      const totalReports = await CitizenReport.countDocuments({ shared_issue_id: sharedIssue._id });
      const dept = sharedIssue.department_id ? await Department.findById(sharedIssue.department_id) : null;
      const hoursUnresolved = (now - new Date(sharedIssue.first_reported_at)) / (1000 * 60 * 60);

      const newPriority = calculatePriorityScore({
        severity: sharedIssue.severity,
        isSafetyCritical: sharedIssue.is_safety_critical,
        reportCount: totalReports,
        recurrenceCount: 0,
        hoursUnresolved,
        slaHours: dept ? dept.sla_hours : 72
      });

      const estimatedPop = 15 + totalReports * 8;

      sharedIssue.latest_reported_at = now;
      sharedIssue.priority_score = newPriority.score;
      sharedIssue.estimated_affected_population = estimatedPop;
      await sharedIssue.save();

      // Auto-follow the issue
      try {
        await IssueFollow.updateOne(
          { shared_issue_id: sharedIssue._id, user_id: userRecord._id },
          { shared_issue_id: sharedIssue._id, user_id: userRecord._id },
          { upsert: true }
        );
      } catch (_) {}

      // Notify the user
      await Notification.create({
        user_id: userRecord._id,
        title: 'Report Connected to Shared Civic Issue',
        message: `Your observation has been linked to Master Issue ${sharedIssue.issue_code}. You will receive automatic status alerts as repairs progress.`,
        link_url: `/issues/${sharedIssue._id.toString()}`,
        is_read: false
      });

      return res.status(201).json({
        message: 'Report successfully linked to existing civic issue.',
        reportId: newReport._id.toString(),
        sharedIssueId: sharedIssue._id.toString(),
        issueCode: sharedIssue.issue_code,
        isNewSharedIssue: false
      });
    }

    // SCENARIO 2: Create a brand new Shared Civic Issue
    const allAssets = await InfrastructureAsset.find({ category });
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
    let department = await Department.findOne({ code: deptCode });
    if (!department) {
      department = await Department.findOne().sort({ _id: 1 });
    }

    const departmentId = department ? department._id : null;
    const slaHours = department ? department.sla_hours : 72;
    const issueCode = `CT-${Math.floor(100 + Math.random() * 900)}`;

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

    const newSharedIssue = await SharedIssue.create({
      issue_code: issueCode,
      title: title.trim(),
      category,
      description: description.trim(),
      severity,
      priority_score: priority.score,
      is_safety_critical: Boolean(isSafetyCritical),
      status: 'Pending',
      latitude: Number(latitude),
      longitude: Number(longitude),
      address: address || 'Recorded Coordinates',
      department_id: departmentId,
      infrastructure_id: matchedAsset ? matchedAsset._id : null,
      estimated_affected_population: initialAffectedPop,
      affected_population_details: popDetails,
      first_reported_at: now,
      latest_reported_at: now
    });

    // Create incident record if matched to infrastructure
    if (matchedAsset) {
      const priorIncidents = await InfrastructureIncident.find({ infrastructure_id: matchedAsset._id });
      const recurrenceSeq = priorIncidents.length + 1;
      const incCode = `INC-${matchedAsset.asset_code}-${recurrenceSeq}`;

      const newIncident = await InfrastructureIncident.create({
        incident_code: incCode,
        infrastructure_id: matchedAsset._id,
        shared_issue_id: newSharedIssue._id,
        incident_type: title.trim(),
        description: description.trim(),
        started_at: now,
        recurrence_sequence: recurrenceSeq
      });

      newSharedIssue.incident_id = newIncident._id;
      await newSharedIssue.save();

      // Re-evaluate infrastructure asset risk score
      const allIncidents = await InfrastructureIncident.find({ infrastructure_id: matchedAsset._id });
      const allRepairs = await RepairRecord.find({ infrastructure_id: matchedAsset._id });
      const openCount = await SharedIssue.countDocuments({
        infrastructure_id: matchedAsset._id,
        status: { $ne: 'Resolved' }
      });

      const riskCalc = calculateInfrastructureRisk({
        asset: matchedAsset,
        distinctIncidents: allIncidents,
        repairRecords: allRepairs,
        unresolvedIssuesCount: openCount
      });

      matchedAsset.current_health_status = riskCalc.healthStatus;
      matchedAsset.risk_score = riskCalc.riskScore;
      matchedAsset.risk_level = riskCalc.riskLevel;
      matchedAsset.risk_reasons = riskCalc.reasons;
      await matchedAsset.save();
    }

    // Insert Citizen Report
    const reportResult = await CitizenReport.create({
      report_code: reportCode,
      user_id: userRecord._id,
      shared_issue_id: newSharedIssue._id,
      title: title.trim(),
      category,
      description: description.trim(),
      severity,
      latitude: Number(latitude),
      longitude: Number(longitude),
      address: address || 'Recorded Coordinates',
      status: 'Pending',
      similarity_match_score: 100,
      link_type: 'original'
    });

    // Attach images
    for (const url of imageUrls) {
      await ReportImage.create({
        report_id: reportResult._id,
        shared_issue_id: newSharedIssue._id,
        image_url: url,
        image_type: 'evidence'
      });
    }

    // Initial status history entry
    await StatusHistory.create({
      shared_issue_id: newSharedIssue._id,
      old_status: 'None',
      new_status: 'Pending',
      changed_by_user_id: userRecord._id,
      comments: 'Complaint submitted and verified by citizen'
    });

    // Auto follow
    try {
      await IssueFollow.updateOne(
        { shared_issue_id: newSharedIssue._id, user_id: userRecord._id },
        { shared_issue_id: newSharedIssue._id, user_id: userRecord._id },
        { upsert: true }
      );
    } catch (_) {}

    // Notification to citizen
    await Notification.create({
      user_id: userRecord._id,
      title: 'Civic Complaint Registered',
      message: `Your complaint has been assigned issue code ${issueCode}. Municipal authorities have been notified.`,
      link_url: `/issues/${newSharedIssue._id.toString()}`,
      is_read: false
    });

    res.status(201).json({
      message: 'Civic issue registered successfully.',
      reportId: reportResult._id.toString(),
      sharedIssueId: newSharedIssue._id.toString(),
      issueCode,
      isNewSharedIssue: true
    });
  } catch (err) {
    console.error('Report submission error:', err);
    res.status(500).json({ error: 'Server error while submitting report.' });
  }
});

// 3. Upload image for a report
router.post('/upload-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const result = await uploadImageToStorage(req.file.buffer, req.file.originalname, 'civictrack/reports');
    return res.json({
      imageUrl: result.url,
      provider: result.provider,
      message: 'Image uploaded successfully.'
    });
  } catch (err) {
    console.error('Image upload failed:', err.message || err);
    return res.status(500).json({
      error: err.message || 'Image upload failed. Please verify cloud storage configuration.'
    });
  }
});

// 4. List citizen reports with filtering & search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, status, search, mineOnly } = req.query;
    const filter = {};

    if (mineOnly === 'true' || req.user.role === 'citizen') {
      filter.user_id = req.user.id;
    }

    if (category) {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      const reg = new RegExp(search, 'i');
      filter.$or = [
        { title: reg },
        { description: reg },
        { address: reg },
        { report_code: reg }
      ];
    }

    const reports = await CitizenReport.find(filter)
      .populate('user_id', 'name email')
      .populate('shared_issue_id', 'issue_code status title address category')
      .sort({ created_at: -1 });

    const formatted = await Promise.all(
      reports.map(async (r) => {
        const primaryImg = await ReportImage.findOne({ report_id: r._id, image_type: 'evidence' });
        const user = r.user_id;
        const shared = r.shared_issue_id;

        return {
          id: r._id.toString(),
          report_code: r.report_code,
          user_id: user ? (user._id || user).toString() : null,
          reporter_name: user ? user.name : 'Citizen',
          shared_issue_id: shared ? (shared._id || shared).toString() : null,
          issue_code: shared ? shared.issue_code : null,
          shared_status: shared ? shared.status : r.status,
          shared_title: shared ? shared.title : r.title,
          shared_address: shared ? shared.address : r.address,
          shared_category: shared ? shared.category : r.category,
          title: r.title,
          category: r.category,
          description: r.description,
          severity: r.severity,
          latitude: r.latitude,
          longitude: r.longitude,
          address: r.address,
          status: r.status,
          similarity_match_score: r.similarity_match_score,
          link_type: r.link_type,
          primary_image: primaryImg ? primaryImg.image_url : null,
          evidence_image: primaryImg ? primaryImg.image_url : null,
          created_at: r.created_at
        };
      })
    );

    res.json(formatted);
  } catch (err) {
    console.error('Reports fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch reports.' });
  }
});

// 5. Get single citizen report details (preserves original evidence)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    let reportDoc;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      reportDoc = await CitizenReport.findById(req.params.id)
        .populate('user_id', 'name email')
        .populate('shared_issue_id');
    } else {
      reportDoc = await CitizenReport.findOne({ legacy_id: Number(req.params.id) })
        .populate('user_id', 'name email')
        .populate('shared_issue_id');
    }

    if (!reportDoc) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const reporterId = reportDoc.user_id ? (reportDoc.user_id._id || reportDoc.user_id).toString() : null;

    // Role check: Citizens can only inspect their own complaint submissions
    if (req.user.role === 'citizen' && reporterId !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only view your own report submissions.' });
    }

    const images = await ReportImage.find({ report_id: reportDoc._id });
    const shared = reportDoc.shared_issue_id;

    const formatted = {
      id: reportDoc._id.toString(),
      report_code: reportDoc.report_code,
      user_id: reporterId,
      reporter_name: reportDoc.user_id ? reportDoc.user_id.name : 'Citizen',
      reporter_email: reportDoc.user_id ? reportDoc.user_id.email : null,
      shared_issue_id: shared ? (shared._id || shared).toString() : null,
      issue_code: shared ? shared.issue_code : null,
      shared_status: shared ? shared.status : reportDoc.status,
      department_id: shared ? (shared.department_id ? shared.department_id.toString() : null) : null,
      priority_score: shared ? shared.priority_score : 50,
      title: reportDoc.title,
      category: reportDoc.category,
      description: reportDoc.description,
      severity: reportDoc.severity,
      latitude: reportDoc.latitude,
      longitude: reportDoc.longitude,
      address: reportDoc.address,
      status: reportDoc.status,
      similarity_match_score: reportDoc.similarity_match_score,
      link_type: reportDoc.link_type,
      created_at: reportDoc.created_at,
      primary_image: images.length > 0 ? images[0].image_url : null,
      evidence_image: images.length > 0 ? images[0].image_url : null,
      images: images.map((img) => ({
        id: img._id.toString(),
        image_url: img.image_url,
        caption: img.caption,
        image_type: img.image_type
      }))
    };

    res.json(formatted);
  } catch (err) {
    console.error('Single report fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch report details.' });
  }
});

export default router;

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  isPlaceholderText,
  validateRepairSubmission,
  validateRepairForApproval
} from '../src/utils/repairValidator.js';
import {
  SharedIssue,
  CitizenReport,
  RepairRecord,
  ReportImage,
  StatusHistory,
  AuditLog
} from '../src/models/index.js';

test('CivicTrack Mandatory Repair Details & Admin Approval Validation Suite', async (t) => {
  const dummyAdminId = new mongoose.Types.ObjectId();
  const dummyStaffId = new mongoose.Types.ObjectId();
  const dummyCitizenId = new mongoose.Types.ObjectId();
  const dummyIssueId = new mongoose.Types.ObjectId();
  const dummyDeptId = new mongoose.Types.ObjectId();

  const citizenEvidenceUrl = 'https://res.cloudinary.com/civictrack/image/upload/v1/citizen_pothole_evidence.jpg';
  const validBeforePhoto = 'https://res.cloudinary.com/civictrack/image/upload/v1/staff_before_repair.jpg';
  const validAfterPhoto = 'https://res.cloudinary.com/civictrack/image/upload/v1/staff_after_repair.jpg';

  // Scenario 1: Submission without before-repair photo
  await t.test('Scenario 1: Repair submission without before-repair photo is rejected', () => {
    const payload = {
      repair_type: 'permanent',
      work_summary: 'Excavated 50mm base course, laid bitumen binder, and compacted with 2-ton roller',
      materials_used: '50kg Asphalt binder, aggregate grade 2, tack coat emulsion',
      cost_amount: 3200,
      before_image_url: '', // Missing
      after_image_url: validAfterPhoto
    };

    const result = validateRepairSubmission(payload, [citizenEvidenceUrl]);
    assert.strictEqual(result.isValid, false);
    assert.match(result.error, /before-repair photograph is mandatory/i);
  });

  // Scenario 2: Submission without after-repair photo
  await t.test('Scenario 2: Repair submission without after-repair photo is rejected', () => {
    const payload = {
      repair_type: 'permanent',
      work_summary: 'Excavated 50mm base course, laid bitumen binder, and compacted with 2-ton roller',
      materials_used: '50kg Asphalt binder, aggregate grade 2, tack coat emulsion',
      cost_amount: 3200,
      before_image_url: validBeforePhoto,
      after_image_url: '   ' // Missing / whitespace
    };

    const result = validateRepairSubmission(payload, [citizenEvidenceUrl]);
    assert.strictEqual(result.isValid, false);
    assert.match(result.error, /after-repair photograph is mandatory/i);
  });

  // Scenario 2b: Photo distinctness & citizen evidence reuse
  await t.test('Scenario 2b: After-repair photo reusing before photo or citizen evidence is rejected', () => {
    // Reusing before photo
    const duplicatePhotoPayload = {
      repair_type: 'permanent',
      work_summary: 'Excavated 50mm base course, laid bitumen binder, and compacted with 2-ton roller',
      materials_used: '50kg Asphalt binder, aggregate grade 2, tack coat emulsion',
      cost_amount: 3200,
      before_image_url: validBeforePhoto,
      after_image_url: validBeforePhoto // Identical
    };
    const dupResult = validateRepairSubmission(duplicatePhotoPayload, [citizenEvidenceUrl]);
    assert.strictEqual(dupResult.isValid, false);
    assert.match(dupResult.error, /distinct from the before-repair photograph/i);

    // Reusing citizen evidence photo
    const reuseCitizenPhotoPayload = {
      repair_type: 'permanent',
      work_summary: 'Excavated 50mm base course, laid bitumen binder, and compacted with 2-ton roller',
      materials_used: '50kg Asphalt binder, aggregate grade 2, tack coat emulsion',
      cost_amount: 3200,
      before_image_url: validBeforePhoto,
      after_image_url: citizenEvidenceUrl // Reused citizen photo!
    };
    const reuseResult = validateRepairSubmission(reuseCitizenPhotoPayload, [citizenEvidenceUrl]);
    assert.strictEqual(reuseResult.isValid, false);
    assert.match(reuseResult.error, /cannot reuse the original citizen complaint/i);
  });

  // Scenario 3: Submission without work description or with placeholder description
  await t.test('Scenario 3: Repair submission without work description or with placeholder text is rejected', () => {
    // Empty description
    const emptyDesc = validateRepairSubmission({
      repair_type: 'permanent',
      work_summary: '  ',
      materials_used: '50kg Bitumen mix',
      cost_amount: 2500,
      before_image_url: validBeforePhoto,
      after_image_url: validAfterPhoto
    });
    assert.strictEqual(emptyDesc.isValid, false);
    assert.match(emptyDesc.error, /work description.*mandatory/i);

    // Placeholder descriptions
    const placeholders = ['done', 'fixed', 'test', 'repaired', 'ok', 'work done', 'n/a', 'asdf'];
    for (const ph of placeholders) {
      const res = validateRepairSubmission({
        repair_type: 'permanent',
        work_summary: ph,
        materials_used: '50kg Bitumen mix',
        cost_amount: 2500,
        before_image_url: validBeforePhoto,
        after_image_url: validAfterPhoto
      });
      assert.strictEqual(res.isValid, false, `Expected placeholder "${ph}" to be rejected`);
      assert.match(res.error, /placeholder text is not accepted/i);
    }
  });

  // Scenario 4: Submission without materials
  await t.test('Scenario 4: Repair submission without materials or with placeholder materials is rejected', () => {
    // Empty materials
    const emptyMat = validateRepairSubmission({
      repair_type: 'temporary',
      work_summary: 'Temporary cold patch placed over roadway pothole pending final resurfacing',
      materials_used: '',
      cost_amount: 1500,
      before_image_url: validBeforePhoto,
      after_image_url: validAfterPhoto
    });
    assert.strictEqual(emptyMat.isValid, false);
    assert.match(emptyMat.error, /materials used.*mandatory/i);

    // Placeholder materials
    const phMat = validateRepairSubmission({
      repair_type: 'temporary',
      work_summary: 'Temporary cold patch placed over roadway pothole pending final resurfacing',
      materials_used: 'none',
      cost_amount: 1500,
      before_image_url: validBeforePhoto,
      after_image_url: validAfterPhoto
    });
    assert.strictEqual(phMat.isValid, false);
    assert.match(phMat.error, /placeholder text is not accepted/i);
  });

  // Scenario 5: Submission without explicitly entering repair cost
  await t.test('Scenario 5: Repair submission without explicitly entering repair cost is rejected', () => {
    // Missing cost_amount
    const missingCost = validateRepairSubmission({
      repair_type: 'permanent',
      work_summary: 'Complete trench reinstatement with subbase stone, base asphalt, and wearing course',
      materials_used: 'Crushed gravel, VG30 bitumen, tack coat',
      before_image_url: validBeforePhoto,
      after_image_url: validAfterPhoto
    });
    assert.strictEqual(missingCost.isValid, false);
    assert.match(missingCost.error, /repair cost must be explicitly entered/i);

    // Negative cost
    const negativeCost = validateRepairSubmission({
      repair_type: 'permanent',
      work_summary: 'Complete trench reinstatement with subbase stone, base asphalt, and wearing course',
      materials_used: 'Crushed gravel, VG30 bitumen, tack coat',
      cost_amount: -500,
      before_image_url: validBeforePhoto,
      after_image_url: validAfterPhoto
    });
    assert.strictEqual(negativeCost.isValid, false);
    assert.match(negativeCost.error, /non-negative number/i);
  });

  // Scenario 6: Submission with valid complete details
  await t.test('Scenario 6: Repair submission with complete valid details succeeds and normalizes payload', () => {
    const validPayload = {
      repair_type: 'Permanent',
      work_summary: 'Milled surface to 40mm depth, sprayed CRS-2 bitumen emulsion, laid and compacted hot asphalt mix to grade',
      materials_used: '120kg Bituminous concrete grade II, CRS-2 rapid-setting emulsion, stone dust sealant',
      cost_amount: '4850.50',
      before_image_url: `  ${validBeforePhoto}  `,
      after_image_url: `  ${validAfterPhoto}  `
    };

    const res = validateRepairSubmission(validPayload, [citizenEvidenceUrl]);
    assert.strictEqual(res.isValid, true);
    assert.ok(res.normalizedData);
    assert.strictEqual(res.normalizedData.repair_type, 'permanent');
    assert.strictEqual(res.normalizedData.cost_amount, 4850.5);
    assert.strictEqual(res.normalizedData.before_image_url, validBeforePhoto);
    assert.strictEqual(res.normalizedData.after_image_url, validAfterPhoto);
    assert.strictEqual(res.normalizedData.work_summary, validPayload.work_summary);
  });

  // Scenario 7: Admin attempting to approve without a repair record
  await t.test('Scenario 7: Admin attempting to approve without a repair record is blocked with clear error', async () => {
    const issueWithoutRepair = new SharedIssue({
      _id: dummyIssueId,
      issue_code: 'CT-NO-REP',
      title: 'Open Trench On Main Street',
      category: 'Roads and potholes',
      description: 'Hazardous utility trench left open',
      severity: 'Critical',
      priority_score: 90,
      is_safety_critical: true,
      status: 'Resolved',
      latitude: 16.545,
      longitude: 81.523,
      address: 'Main Street, Bhimavaram',
      department_id: dummyDeptId
    });

    // Mock query so RepairRecord.findOne returns null
    const originalFindOne = RepairRecord.findOne;
    RepairRecord.findOne = () => ({
      sort: () => Promise.resolve(null)
    });

    try {
      const approvalCheck = await validateRepairForApproval(issueWithoutRepair);
      assert.strictEqual(approvalCheck.isValid, false);
      assert.ok(approvalCheck.missingFields.length > 0);
      assert.match(approvalCheck.message, /no repair record exists/i);
    } finally {
      RepairRecord.findOne = originalFindOne;
    }
  });

  // Scenario 8: Admin attempting to approve an incomplete repair record
  await t.test('Scenario 8: Admin attempting to approve an incomplete repair is rejected and returns missingFields', async () => {
    const issue = new SharedIssue({
      _id: dummyIssueId,
      issue_code: 'CT-INCOMP-REP',
      title: 'Water valve leak',
      category: 'Water supply and leakage',
      description: 'Leaking water valve on sidewalk',
      severity: 'Medium',
      priority_score: 50,
      is_safety_critical: false,
      status: 'Resolved',
      latitude: 16.541,
      longitude: 81.525,
      address: 'Bhimavaram West',
      department_id: dummyDeptId
    });

    // Incomplete repair: placeholder description, cost unavailable, missing photos
    const incompleteRepair = {
      _id: new mongoose.Types.ObjectId(),
      shared_issue_id: dummyIssueId,
      repair_type: 'permanent',
      work_summary: 'fixed', // Placeholder
      materials_used: 'none', // Placeholder
      cost_amount: null, // Missing explicit cost
      cost_unavailable: true,
      before_image: null,
      after_image: null
    };

    const originalFindOneRepair = RepairRecord.findOne;
    const originalFindOneImage = ReportImage.findOne;
    const originalFindImage = ReportImage.find;

    RepairRecord.findOne = () => ({
      sort: () => Promise.resolve(incompleteRepair)
    });
    ReportImage.findOne = () => Promise.resolve(null);
    ReportImage.find = () => ({
      distinct: () => Promise.resolve([])
    });

    try {
      const approvalCheck = await validateRepairForApproval(issue);
      assert.strictEqual(approvalCheck.isValid, false);
      assert.ok(approvalCheck.missingFields.length >= 4);

      // Verify each missing item is identified
      const missingText = approvalCheck.missingFields.join('; ');
      assert.match(missingText, /work description/i);
      assert.match(missingText, /materials used/i);
      assert.match(missingText, /explicit repair cost/i);
      assert.match(missingText, /before-repair photograph/i);
      assert.match(missingText, /after-repair photograph/i);
    } finally {
      RepairRecord.findOne = originalFindOneRepair;
      ReportImage.findOne = originalFindOneImage;
      ReportImage.find = originalFindImage;
    }
  });

  // Scenario 9: Admin successfully approving a complete repair
  await t.test('Scenario 9: Admin successfully approving a complete repair transitions status and records metadata', async () => {
    const issue = new SharedIssue({
      _id: dummyIssueId,
      issue_code: 'CT-COMPLETE-REP',
      title: 'Deep pothole repair',
      category: 'Roads and potholes',
      description: 'Pothole front of hospital',
      severity: 'High',
      priority_score: 80,
      is_safety_critical: true,
      status: 'Resolved',
      latitude: 16.546,
      longitude: 81.522,
      address: 'Hospital Road, Bhimavaram',
      department_id: dummyDeptId,
      resolved_at: new Date(Date.now() - 3600000)
    });

    const completeRepair = {
      _id: new mongoose.Types.ObjectId(),
      shared_issue_id: dummyIssueId,
      repair_type: 'permanent',
      work_summary: 'Excavated 80mm failed foundation, placed geotextile, 100mm wet mix macadam, 40mm bituminous asphalt, and compacted to 98% Proctor density',
      materials_used: 'WMM aggregate, VG30 hot asphalt, non-woven geotextile membrane, tack coat',
      cost_amount: 5400,
      cost_unavailable: false,
      before_image: validBeforePhoto,
      after_image: validAfterPhoto
    };

    const originalFindOneRepair = RepairRecord.findOne;
    const originalFindOneImage = ReportImage.findOne;
    const originalFindImage = ReportImage.find;

    RepairRecord.findOne = () => ({
      sort: () => Promise.resolve(completeRepair)
    });
    ReportImage.findOne = (query) => {
      if (query && query.image_type === 'before_repair') {
        return Promise.resolve({ image_url: validBeforePhoto });
      }
      if (query && query.image_type === 'after_repair') {
        return Promise.resolve({ image_url: validAfterPhoto });
      }
      return Promise.resolve(null);
    };
    ReportImage.find = () => ({
      distinct: () => Promise.resolve([citizenEvidenceUrl])
    });

    try {
      const approvalCheck = await validateRepairForApproval(issue);
      assert.strictEqual(approvalCheck.isValid, true);
      assert.strictEqual(approvalCheck.missingFields.length, 0);

      // Perform admin approval transition
      const approvedAt = new Date();
      issue.status = 'Approved';
      issue.approved_at = approvedAt;
      issue.approved_by_user_id = dummyAdminId;
      issue.approval_notes = 'Verified road surface smoothness and compaction test certificate. Standard met.';

      assert.strictEqual(issue.status, 'Approved');
      assert.strictEqual(issue.approved_by_user_id, dummyAdminId);
      assert.strictEqual(issue.approved_at, approvedAt);
      assert.ok(issue.approval_notes.includes('Verified road surface'));
    } finally {
      RepairRecord.findOne = originalFindOneRepair;
      ReportImage.findOne = originalFindOneImage;
      ReportImage.find = originalFindImage;
    }
  });

  // Scenario 10: Existing repair evidence and history remaining intact
  await t.test('Scenario 10: Existing repair evidence, before/after images, and audit logs remain intact through approval', () => {
    const historicalRepair = new RepairRecord({
      repair_code: 'REP-REC-7788',
      shared_issue_id: dummyIssueId,
      repaired_by_user_id: dummyStaffId,
      department_id: dummyDeptId,
      repair_type: 'permanent',
      work_summary: 'Bitumen surface patch completed with mechanical roller',
      materials_used: '60kg Hot mix asphalt, tack coat',
      cost_amount: 3400,
      cost_unavailable: false,
      completed_at: new Date(Date.now() - 7200000)
    });

    const beforeImage = new ReportImage({
      shared_issue_id: dummyIssueId,
      repair_id: historicalRepair._id,
      image_url: validBeforePhoto,
      image_type: 'before_repair'
    });

    const afterImage = new ReportImage({
      shared_issue_id: dummyIssueId,
      repair_id: historicalRepair._id,
      image_url: validAfterPhoto,
      image_type: 'after_repair'
    });

    const statusHistory = new StatusHistory({
      shared_issue_id: dummyIssueId,
      old_status: 'Resolved',
      new_status: 'Approved',
      changed_by_user_id: dummyAdminId,
      comments: 'Administrator verified repair and approved complaint closure.'
    });

    const auditLog = new AuditLog({
      action: 'ISSUE_APPROVED',
      entity_type: 'shared_issue',
      entity_id: dummyIssueId,
      user_id: dummyAdminId,
      details: JSON.stringify({
        repair_code: historicalRepair.repair_code,
        approved_at: new Date(),
        cost_amount: historicalRepair.cost_amount
      })
    });

    // Verify all historical data remains intact
    assert.strictEqual(historicalRepair.repair_code, 'REP-REC-7788');
    assert.strictEqual(historicalRepair.cost_amount, 3400);
    assert.strictEqual(beforeImage.image_url, validBeforePhoto);
    assert.strictEqual(beforeImage.image_type, 'before_repair');
    assert.strictEqual(afterImage.image_url, validAfterPhoto);
    assert.strictEqual(afterImage.image_type, 'after_repair');
    assert.strictEqual(statusHistory.old_status, 'Resolved');
    assert.strictEqual(statusHistory.new_status, 'Approved');
    assert.strictEqual(auditLog.action, 'ISSUE_APPROVED');
    assert.ok(auditLog.details.includes('REP-REC-7788'));
  });
});

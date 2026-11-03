process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  User,
  Department,
  InfrastructureAsset,
  SharedIssue,
  CitizenReport,
  ReportImage,
  InfrastructureIncident,
  RepairRecord,
  StatusHistory,
  CitizenVerification,
  IssueFollow,
  Notification,
  AuditLog,
  PasswordReset
} from '../src/models/index.js';
import { computeRepairEffectiveness, computeMaintenanceWaste } from '../src/utils/analyticsEngine.js';

test('CivicTrack MongoDB Integration & Relational Architecture Test Suite', async (t) => {
  const testUri = process.env.MONGODB_TEST_URI;
  let isLiveConnected = false;

  if (testUri) {
    try {
      await mongoose.connect(testUri, { serverSelectionTimeoutMS: 3000 });
      isLiveConnected = mongoose.connection.readyState === 1;
      console.log('✓ Connected to live test MongoDB database:', mongoose.connection.name);
    } catch (err) {
      console.warn('ℹ Live test MongoDB connection unavailable; executing in-memory schema integration suite.');
    }
  }

  await t.test('1. Entity Relationships: Department & User Population Reference', async () => {
    const deptId = new mongoose.Types.ObjectId();
    const dept = new Department({
      _id: deptId,
      name: 'Roads and Infrastructure',
      code: 'ROADS',
      sla_hours: 48
    });

    const user = new User({
      name: 'Ramesh Naidu',
      email: 'ramesh.engineer@bhimavaram.gov.in',
      password_hash: await bcrypt.hash('secret123', 10),
      role: 'department_staff',
      department_id: dept._id
    });

    assert.strictEqual(user.validateSync(), undefined, 'User with valid department reference passes validation');
    assert.strictEqual(user.department_id.toString(), deptId.toString(), 'Referenced department ID matches');
  });

  await t.test('2. Complaint Submission & Multi-Model Relational Linking', async () => {
    const citizenId = new mongoose.Types.ObjectId();
    const assetId = new mongoose.Types.ObjectId();
    const issueId = new mongoose.Types.ObjectId();
    const now = new Date();

    // 1. Master Issue
    const issue = new SharedIssue({
      _id: issueId,
      issue_code: 'CT-901',
      title: 'Water Main Rupture on Canal Road',
      category: 'Water supply and leakage',
      description: 'Pipeline rupture flooding street',
      severity: 'Critical',
      priority_score: 90,
      is_safety_critical: true,
      status: 'Pending',
      latitude: 16.5412,
      longitude: 81.5234,
      address: 'Somavaram Canal Road, Bhimavaram',
      infrastructure_id: assetId
    });
    assert.strictEqual(issue.validateSync(), undefined, 'SharedIssue validates');

    // 2. Citizen Report linked to Master Issue
    const report = new CitizenReport({
      report_code: 'REP-901-001',
      user_id: citizenId,
      shared_issue_id: issue._id,
      title: 'Water Main Rupture on Canal Road',
      category: 'Water supply and leakage',
      description: 'Severe water gushing across road',
      severity: 'Critical',
      latitude: 16.5412,
      longitude: 81.5234,
      address: 'Somavaram Canal Road, Bhimavaram',
      link_type: 'original'
    });
    assert.strictEqual(report.validateSync(), undefined, 'CitizenReport validates');

    // 3. Evidence Image linked to both Report and Issue
    const image = new ReportImage({
      report_id: report._id,
      shared_issue_id: issue._id,
      image_url: 'https://res.cloudinary.com/civictrack/image/upload/v1234/pipe-burst.jpg',
      image_type: 'evidence'
    });
    assert.strictEqual(image.validateSync(), undefined, 'ReportImage validates');
    assert.strictEqual(image.shared_issue_id.toString(), issue._id.toString());
    assert.strictEqual(image.report_id.toString(), report._id.toString());

    // 4. Initial Status History Entry
    const history = new StatusHistory({
      shared_issue_id: issue._id,
      old_status: 'None',
      new_status: 'Pending',
      changed_by_user_id: citizenId,
      comments: 'Citizen submitted initial complaint'
    });
    assert.strictEqual(history.validateSync(), undefined, 'StatusHistory validates');

    // 5. Notification to user
    const notification = new Notification({
      user_id: citizenId,
      title: 'Complaint Registered',
      message: 'Complaint CT-901 registered successfully.',
      link_url: `/issues/${issue._id.toString()}`
    });
    assert.strictEqual(notification.validateSync(), undefined, 'Notification validates');
  });

  await t.test('3. Compound Unique Index Verification: IssueFollow', async () => {
    const indexes = IssueFollow.schema.indexes();
    const compoundUnique = indexes.find(
      (idx) => idx[0].shared_issue_id === 1 && idx[0].user_id === 1 && idx[1].unique === true
    );
    assert.ok(compoundUnique, 'IssueFollow schema must define compound unique index on { shared_issue_id: 1, user_id: 1 }');
  });

  await t.test('4. Citizen Verification Model Validation & Resolution Audit', async () => {
    const verification = new CitizenVerification({
      shared_issue_id: new mongoose.Types.ObjectId(),
      user_id: new mongoose.Types.ObjectId(),
      is_effective: true,
      feedback: 'Pothole was completely filled with hot asphalt and compacted properly. Excellent work.'
    });

    assert.strictEqual(verification.validateSync(), undefined, 'CitizenVerification model validates correctly');
    assert.strictEqual(verification.is_effective, true, 'is_effective correctly captures resolution audit outcome');
  });

  await t.test('5. Analytics Engine Integration: Maintenance Waste & Effectiveness', async () => {
    const testAssetId = new mongoose.Types.ObjectId();
    const mockAssets = [
      {
        _id: testAssetId,
        id: testAssetId.toString(),
        name: 'Somavaram Canal Bridge',
        asset_code: 'BRI-BHM-001',
        category: 'Roads and potholes'
      }
    ];

    const mockRepairs = [
      {
        _id: new mongoose.Types.ObjectId(),
        infrastructure_id: testAssetId,
        repair_type: 'temporary',
        cost_amount: 8500,
        cost_unavailable: false,
        recurrence_observed: true,
        days_until_next_incident: 18,
        toJSON: () => ({ id: '1' })
      },
      {
        _id: new mongoose.Types.ObjectId(),
        infrastructure_id: testAssetId,
        repair_type: 'permanent',
        cost_amount: 85000,
        cost_unavailable: false,
        recurrence_observed: false,
        toJSON: () => ({ id: '2' })
      }
    ];

    const effectiveness = await computeRepairEffectiveness(mockRepairs);
    assert.strictEqual(effectiveness.totalRepairs, 2);
    assert.strictEqual(effectiveness.temporaryVsPermanent.temporary.count, 1);
    assert.strictEqual(effectiveness.temporaryVsPermanent.permanent.count, 1);
    assert.strictEqual(effectiveness.temporaryVsPermanent.temporary.recurred, 1);
    assert.strictEqual(effectiveness.temporaryVsPermanent.temporary.recurrenceRate, 100);

    const waste = await computeMaintenanceWaste(mockAssets, mockRepairs);
    assert.strictEqual(waste.totalExpenditure, 93500);
    assert.strictEqual(waste.recurringExpenditure, 8500);
  });

  await t.test('6. Migration Idempotency Logic Verification', async () => {
    // Verify that all 14 models define legacy_id for idempotent tracking
    const models = [
      Department,
      User,
      InfrastructureAsset,
      SharedIssue,
      CitizenReport,
      ReportImage,
      InfrastructureIncident,
      RepairRecord,
      StatusHistory,
      CitizenVerification,
      IssueFollow,
      Notification,
      AuditLog,
      PasswordReset
    ];

    for (const m of models) {
      const path = m.schema.path('legacy_id');
      assert.ok(path, `Model ${m.modelName} must have a legacy_id field for migration idempotency`);
      assert.strictEqual(path.instance, 'Number', `Model ${m.modelName} legacy_id must be a Number`);
    }
  });

  if (isLiveConnected) {
    await mongoose.disconnect();
  }
});

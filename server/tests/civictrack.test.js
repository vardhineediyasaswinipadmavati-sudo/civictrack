process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
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
import { evaluateDuplicateMatch } from '../src/utils/duplicateDetector.js';
import { calculateInfrastructureRisk } from '../src/utils/riskPredictor.js';
import { calculatePriorityScore } from '../src/utils/priorityScorer.js';
import { requireRole } from '../src/middleware/auth.js';
import { DEFAULT_DEPARTMENTS } from '../src/db/mongoInit.js';

test('CivicTrack Comprehensive Test Suite (Mongoose & FSD-2 Architecture)', async (t) => {

  await t.test('1. All 14 Mongoose Models Loaded and Defined Correctly', async () => {
    const models = [
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
    ];

    assert.strictEqual(models.length, 14, 'Exactly 14 Mongoose models must be exported');
    for (const model of models) {
      assert.ok(model.modelName, `Model must have a valid modelName: ${model.modelName}`);
      assert.ok(model.schema, `Model ${model.modelName} must have a compiled schema`);
    }
  });

  await t.test('2. User Model: Schema Validation & Role Constraints', async () => {
    // Valid citizen creation
    const validUser = new User({
      name: 'Venkata Satyanarayana',
      email: 'venkata@example.com',
      password_hash: await bcrypt.hash('secret123', 10),
      role: 'citizen',
      phone: '+91 98765 43210'
    });
    const validErr = validUser.validateSync();
    assert.strictEqual(validErr, undefined, 'Valid user schema validation succeeds');
    assert.strictEqual(validUser.role, 'citizen', 'Default role is citizen');
    assert.strictEqual(validUser.is_active, true, 'Default is_active is true');

    // Invalid role rejection
    const invalidRoleUser = new User({
      name: 'Hacker User',
      email: 'hacker@example.com',
      password_hash: 'hash',
      role: 'super_god_mode'
    });
    const invalidErr = invalidRoleUser.validateSync();
    assert.ok(invalidErr, 'Invalid role must fail schema validation');
    assert.ok(invalidErr.errors.role, 'Role error must be flagged');

    // Missing email rejection
    const noEmailUser = new User({
      name: 'Nameless',
      password_hash: 'hash'
    });
    const noEmailErr = noEmailUser.validateSync();
    assert.ok(noEmailErr, 'Missing required email fails validation');
  });

  await t.test('3. InfrastructureAsset Model: Asset Constraints & Bounds', async () => {
    const validAsset = new InfrastructureAsset({
      asset_code: 'ROA-BHM-001',
      name: 'Bhimavaram Somavaram Canal Road',
      category: 'Roads and potholes',
      address: 'Somavaram Canal Road, Bhimavaram',
      current_health_status: 'good',
      risk_score: 45,
      risk_level: 'Medium',
      latitude: 16.5412,
      longitude: 81.5234
    });
    const validErr = validAsset.validateSync();
    assert.strictEqual(validErr, undefined, 'Valid asset schema validation passes');

    // Missing required category fails validation
    const missingCategoryAsset = new InfrastructureAsset({
      asset_code: 'ROA-ERR-001',
      name: 'Invalid Road',
      address: 'Somewhere',
      latitude: 16.54,
      longitude: 81.52
    });
    const boundsErr = missingCategoryAsset.validateSync();
    assert.ok(boundsErr, 'Missing required category fails validation');
  });

  await t.test('4. SharedIssue Model: Status Enums & Priority Validation', async () => {
    const validIssue = new SharedIssue({
      issue_code: 'CT-2026-001',
      title: 'Pothole near Prakasham Chowk',
      category: 'Roads and potholes',
      description: 'Dangerous pothole on bus route',
      severity: 'High',
      priority_score: 85,
      status: 'In Progress',
      latitude: 16.544,
      longitude: 81.525,
      address: 'Prakasham Chowk, Bhimavaram'
    });
    const validErr = validIssue.validateSync();
    assert.strictEqual(validErr, undefined, 'Valid shared issue passes validation');

    // Invalid status enum
    const badStatusIssue = new SharedIssue({
      issue_code: 'CT-2026-002',
      title: 'Invalid Status Test',
      category: 'Roads and potholes',
      description: 'Testing bad status',
      severity: 'Low',
      status: 'NonExistentStatus',
      latitude: 16.54,
      longitude: 81.52
    });
    const statusErr = badStatusIssue.validateSync();
    assert.ok(statusErr, 'Invalid status enum fails validation');
  });

  await t.test('5. Smart Duplicate Detection (Section 5 Feature 1D)', async () => {
    const existingIssue = {
      id: '65f123456789abcdef012345',
      category: 'Roads and potholes',
      latitude: 16.5420,
      longitude: 81.5230,
      title: 'Deep pothole on Main Road',
      description: 'Vehicle axle hazard near municipal market',
      status: 'Pending'
    };

    // Candidate 1: Same category, 25 meters away, matching description -> Should match as duplicate
    const candidateDuplicate = {
      category: 'Roads and potholes',
      latitude: 16.5422,
      longitude: 81.5231,
      title: 'Large crater pothole in street',
      description: 'Big pothole hazard near market road'
    };

    const duplicateMatch = evaluateDuplicateMatch(candidateDuplicate, existingIssue);
    assert.strictEqual(duplicateMatch.isLikelyDuplicate, true, 'Nearby report with matching category flags as duplicate');
    assert.ok(duplicateMatch.matchingScore >= 55, 'Matching score meets or exceeds duplicate threshold');
    assert.ok(duplicateMatch.distanceMeters < 50, 'Distance is correctly calculated within 50 meters');

    // Candidate 2: Different category (e.g. Streetlights vs Roads) -> Must NEVER auto-flag as duplicate
    const differentCategoryReport = {
      category: 'Streetlights and electrical infrastructure',
      latitude: 16.5421,
      longitude: 81.5230,
      title: 'Flickering street lamp',
      description: 'Light pole bulb burned out'
    };

    const differentCategoryMatch = evaluateDuplicateMatch(differentCategoryReport, existingIssue);
    assert.strictEqual(differentCategoryMatch.isLikelyDuplicate, false, 'Different categories are never flagged as duplicate');
  });

  await t.test('6. Dynamic Priority Scoring Calculation', async () => {
    // Standard priority calculation
    const normalResult = calculatePriorityScore({
      severity: 'Medium',
      isSafetyCritical: false,
      reportCount: 1
    });
    assert.ok(normalResult.score >= 10 && normalResult.score <= 50, `Normal score should be moderate, got ${normalResult.score}`);

    // Safety-critical calculation
    const safetyCriticalResult = calculatePriorityScore({
      severity: 'High',
      isSafetyCritical: true,
      reportCount: 4
    });
    assert.ok(safetyCriticalResult.score > normalResult.score, 'Safety-critical issue has significantly higher score');
    assert.ok(safetyCriticalResult.score >= 60, `Safety critical score should be high, got ${safetyCriticalResult.score}`);
    assert.strictEqual(safetyCriticalResult.priorityLevel, 'Critical', 'Safety critical issue classified as Critical');
  });

  await t.test('7. Infrastructure Risk Assessment Calculation', async () => {
    const mockAsset = {
      id: '65f123456789abcdef012345',
      name: 'Canal Road',
      category: 'Roads and potholes'
    };

    // Asset with frequent incidents and temporary repairs
    const highRiskResult = calculateInfrastructureRisk({
      asset: mockAsset,
      distinctIncidents: [
        { started_at: new Date(Date.now() - 10 * 86400000).toISOString() },
        { started_at: new Date(Date.now() - 30 * 86400000).toISOString() },
        { started_at: new Date(Date.now() - 60 * 86400000).toISOString() },
        { started_at: new Date(Date.now() - 120 * 86400000).toISOString() }
      ],
      repairRecords: [
        { repair_type: 'temporary', cost_amount: 1500 },
        { repair_type: 'temporary', cost_amount: 2500 }
      ],
      unresolvedIssuesCount: 2
    });

    assert.ok(highRiskResult.riskScore >= 50, `Frequent incidents and unresolved issues yield elevated risk score, got ${highRiskResult.riskScore}`);
    assert.ok(['High', 'Critical'].includes(highRiskResult.riskLevel), 'Risk level classified as High or Critical');

    // Asset with no failure history
    const lowRiskResult = calculateInfrastructureRisk({
      asset: mockAsset,
      distinctIncidents: [],
      repairRecords: [
        { repair_type: 'permanent', cost_amount: 500000 }
      ],
      unresolvedIssuesCount: 0
    });

    assert.ok(lowRiskResult.riskScore <= 30, `Zero incidents yield low risk score, got ${lowRiskResult.riskScore}`);
    assert.strictEqual(lowRiskResult.riskLevel, 'Low', 'Risk level classified as Low');
  });

  await t.test('8. Role-Based Access Control Middleware Enforcement', async () => {
    const adminReq = { user: { role: 'admin' } };
    const staffReq = { user: { role: 'department_staff' } };
    const citizenReq = { user: { role: 'citizen' } };

    const adminOnlyMiddleware = requireRole('admin');
    const staffOrAdminMiddleware = requireRole('admin', 'department_staff');

    // Admin passes admin check
    let adminNextCalled = false;
    adminOnlyMiddleware(adminReq, {}, () => { adminNextCalled = true; });
    assert.strictEqual(adminNextCalled, true, 'Admin passes admin-only route');

    // Citizen fails admin check with 403
    let forbiddenCode = 0;
    const res = {
      status(code) {
        forbiddenCode = code;
        return {
          json(data) {
            this.data = data;
          }
        };
      }
    };
    citizenReq.user.role = 'citizen';
    adminOnlyMiddleware(citizenReq, res, () => {
      assert.fail('Citizen must not reach next() on admin route');
    });
    assert.strictEqual(forbiddenCode, 403, 'Citizen receives HTTP 403 Forbidden on admin route');

    // Staff passes staff/admin check
    let staffNextCalled = false;
    staffOrAdminMiddleware(staffReq, {}, () => { staffNextCalled = true; });
    assert.strictEqual(staffNextCalled, true, 'Staff passes staff/admin route');
  });

  await t.test('9. Default Municipal Departments Configuration', async () => {
    assert.ok(Array.isArray(DEFAULT_DEPARTMENTS), 'DEFAULT_DEPARTMENTS must be an array');
    assert.strictEqual(DEFAULT_DEPARTMENTS.length >= 5, true, 'Must define at least 5 municipal departments');

    const expectedCodes = ['ROADS', 'ELECTRICAL', 'WATER', 'SANITATION', 'FACILITIES'];
    for (const code of expectedCodes) {
      const found = DEFAULT_DEPARTMENTS.find(d => d.code === code);
      assert.ok(found, `Department ${code} must be defined in defaults`);
      assert.ok(found.sla_hours > 0, `Department ${code} must have an SLA target > 0 hours`);
    }
  });

});

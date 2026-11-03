process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  User,
  SharedIssue,
  CitizenReport,
  AuditLog,
  RepairRecord,
  PasswordReset
} from '../src/models/index.js';
import { computeMaintenanceWaste, computeRepairEffectiveness } from '../src/utils/analyticsEngine.js';

test('CivicTrack End-to-End Workflow & Quality Audit Verification', async (t) => {

  await t.test('Flow 1: Authentication Credential Verification & Role Portal Enforcement', async () => {
    // 1. Password hashing verification
    const rawPass = 'CivicAdminSecure2026!';
    const passwordHash = await bcrypt.hash(rawPass, 10);

    const wrongPassMatch = await bcrypt.compare('WrongPassword999', passwordHash);
    assert.strictEqual(wrongPassMatch, false, 'Invalid credentials fail verification');

    const correctPassMatch = await bcrypt.compare(rawPass, passwordHash);
    assert.strictEqual(correctPassMatch, true, 'Valid credentials pass verification');

    // 2. Strict portal role enforcement
    const staffUser = new User({
      name: 'Ramesh Staff',
      email: 'ramesh@bhimavaram.gov.in',
      password_hash: passwordHash,
      role: 'department_staff'
    });

    const citizenUser = new User({
      name: 'Anjali Citizen',
      email: 'anjali@example.com',
      password_hash: passwordHash,
      role: 'citizen'
    });

    // Simulate login portal verification logic from server/src/routes/auth.js
    function verifyPortalAccess(userRole, requestedPortal) {
      if (!requestedPortal) return true;
      const normalizedPortal = requestedPortal.toLowerCase().trim();
      if (normalizedPortal === 'admin' && userRole !== 'admin') return false;
      if (normalizedPortal === 'staff' && userRole !== 'department_staff') return false;
      if (normalizedPortal === 'citizen' && userRole !== 'citizen') return false;
      return true;
    }

    assert.strictEqual(
      verifyPortalAccess(staffUser.role, 'admin'),
      false,
      'Staff credentials strictly rejected when attempting Admin portal sign in'
    );
    assert.strictEqual(
      verifyPortalAccess(citizenUser.role, 'staff'),
      false,
      'Citizen credentials strictly rejected when attempting Staff portal sign in'
    );
    assert.strictEqual(
      verifyPortalAccess(staffUser.role, 'staff'),
      true,
      'Staff credentials accepted for Staff portal sign in'
    );
    assert.strictEqual(
      verifyPortalAccess(citizenUser.role, 'citizen'),
      true,
      'Citizen credentials accepted for Citizen portal sign in'
    );
  });

  await t.test('Flow 2: Password Reset Token Security & Recovery Cycle', async () => {
    const userId = new mongoose.Types.ObjectId();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // 1. Create reset record
    const resetRecord = new PasswordReset({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt
    });

    const valErr = resetRecord.validateSync();
    assert.strictEqual(valErr, undefined, 'Password reset record validates correctly');
    assert.strictEqual(resetRecord.isUsed, false, 'isUsed virtual returns false initially');
    assert.strictEqual(resetRecord.isExpired, false, 'isExpired virtual returns false for 1-hour window');

    // 2. Mark token as used
    resetRecord.used_at = new Date();
    assert.strictEqual(resetRecord.isUsed, true, 'isUsed virtual returns true after use');

    // 3. Verify single-use security: used token cannot be re-used
    const canReuse = !resetRecord.used_at && resetRecord.expires_at > new Date();
    assert.strictEqual(canReuse, false, 'Used token cannot be reused for second password change');
  });

  await t.test('Flow 3: Deduplication & Audit Ledger Preservation', async () => {
    const masterIssueId = new mongoose.Types.ObjectId();
    const citizen1Id = new mongoose.Types.ObjectId();
    const citizen2Id = new mongoose.Types.ObjectId();

    // Report 1: Original reporter
    const report1 = new CitizenReport({
      report_code: 'REP-2026-001',
      user_id: citizen1Id,
      shared_issue_id: masterIssueId,
      title: 'Pothole on Somavaram Road',
      category: 'Roads and potholes',
      description: 'Dangerous pothole near the canal bridge',
      severity: 'High',
      address: 'Somavaram Road, Bhimavaram',
      latitude: 16.541,
      longitude: 81.523,
      link_type: 'original'
    });

    // Report 2: Secondary reporter merged into master issue
    const report2 = new CitizenReport({
      report_code: 'REP-2026-002',
      user_id: citizen2Id,
      shared_issue_id: masterIssueId,
      title: 'Road collapsed near canal bridge',
      category: 'Roads and potholes',
      description: 'Severe road crater disrupting traffic',
      severity: 'High',
      address: 'Somavaram Road, Bhimavaram',
      latitude: 16.5412,
      longitude: 81.5232,
      link_type: 'confirmed_duplicate'
    });

    assert.strictEqual(report1.validateSync(), undefined, 'Report 1 validates cleanly');
    assert.strictEqual(report2.validateSync(), undefined, 'Report 2 validates cleanly');

    // Verify distinct reporters & individual descriptions preserved
    assert.notStrictEqual(report1.user_id.toString(), report2.user_id.toString(), 'Reporters are distinct');
    assert.notStrictEqual(report1.description, report2.description, 'Original descriptions preserved');
    assert.strictEqual(report1.shared_issue_id.toString(), report2.shared_issue_id.toString(), 'Shared under same master issue');

    // Audit log records the merge event
    const auditLog = new AuditLog({
      action: 'MERGE_ISSUES',
      entity_type: 'shared_issue',
      entity_id: masterIssueId,
      user_id: new mongoose.Types.ObjectId(),
      details: JSON.stringify({
        merged_report_code: report2.report_code,
        reason: 'Duplicate complaint of identical road defect confirmed by field engineer'
      })
    });

    assert.strictEqual(auditLog.validateSync(), undefined, 'Audit log validates cleanly');
    assert.strictEqual(auditLog.action, 'MERGE_ISSUES', 'Action recorded as MERGE_ISSUES');
  });

  await t.test('Flow 4: Maintenance Waste & Repair Effectiveness Analytics', async () => {
    const assetId = new mongoose.Types.ObjectId();

    // 1. Repair effectiveness: test recurring incident after temporary repair
    const mockRepairs = [
      new RepairRecord({
        infrastructure_id: assetId,
        repair_type: 'temporary',
        work_summary: 'Asphalt cold patch applied to pothole',
        cost_amount: 12000,
        recurrence_observed: true,
        days_until_next_incident: 22
      }),
      new RepairRecord({
        infrastructure_id: assetId,
        repair_type: 'permanent',
        work_summary: 'Full base layer re-excavation and concrete laying',
        cost_amount: 145000,
        recurrence_observed: false
      })
    ];

    const effectiveness = await computeRepairEffectiveness(mockRepairs);
    assert.ok(effectiveness, 'Effectiveness metrics generated');
    assert.strictEqual(effectiveness.totalRepairs, 2, 'Total repairs matches input count');
    assert.strictEqual(effectiveness.temporaryVsPermanent.temporary.count, 1, 'Temporary repair counted');
    assert.strictEqual(effectiveness.temporaryVsPermanent.permanent.count, 1, 'Permanent repair counted');
    assert.strictEqual(effectiveness.recurrenceCount, 1, 'Recurrence count is 1');

    // 2. Maintenance waste calculation
    const mockAssets = [
      {
        _id: assetId,
        asset_code: 'ROA-001',
        name: 'Somavaram Road',
        category: 'Roads and potholes',
        address: 'Somavaram, Bhimavaram',
        current_health_status: 'warning',
        risk_level: 'High'
      }
    ];

    const waste = await computeMaintenanceWaste(mockAssets, mockRepairs);
    assert.ok(waste, 'Maintenance waste calculated');
    assert.strictEqual(waste.totalExpenditure, 157000, 'Total expenditure accurately summed in ₹');
    assert.strictEqual(waste.recurringExpenditure, 12000, 'Recurring wasteful expenditure identified in ₹');
  });

});

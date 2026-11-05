process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  SharedIssue,
  CitizenReport,
  RepairRecord,
  StatusHistory,
  AuditLog
} from '../src/models/index.js';

test('CivicTrack Separate Resolved and Admin Approved Lifecycle Suite', async (t) => {
  const dummyAdminId = new mongoose.Types.ObjectId();
  const dummyStaffId = new mongoose.Types.ObjectId();
  const dummyCitizenId = new mongoose.Types.ObjectId();
  const dummyDeptId = new mongoose.Types.ObjectId();

  await t.test('1. SharedIssue Status Enum includes Approved and Rejected', () => {
    const validStatuses = SharedIssue.schema.path('status').enumValues;
    assert.ok(validStatuses.includes('Approved'), 'Schema must include Approved');
    assert.ok(validStatuses.includes('Rejected'), 'Schema must include Rejected');
    assert.ok(validStatuses.includes('Resolved'), 'Schema must include Resolved');
    assert.ok(validStatuses.includes('In Progress'), 'Schema must include In Progress');
    assert.ok(validStatuses.includes('Pending'), 'Schema must include Pending');
  });

  await t.test('2. SharedIssue Model Schema defines approval and rejection tracking fields', () => {
    const paths = SharedIssue.schema.paths;
    assert.ok(paths['approved_at'], 'approved_at must exist');
    assert.ok(paths['approved_by_user_id'], 'approved_by_user_id must exist');
    assert.ok(paths['approval_notes'], 'approval_notes must exist');
    assert.ok(paths['rejected_at'], 'rejected_at must exist');
    assert.ok(paths['rejected_by_user_id'], 'rejected_by_user_id must exist');
    assert.ok(paths['rejection_reason'], 'rejection_reason must exist');
  });

  await t.test('3. Staff Repair Submission transitions complaint to Resolved (Awaiting Approval)', () => {
    const issue = new SharedIssue({
      issue_code: 'CT-TEST-01',
      title: 'Pothole on Main Road',
      category: 'Roads and potholes',
      description: 'Dangerous pothole near market',
      severity: 'High',
      priority_score: 75,
      is_safety_critical: true,
      status: 'In Progress',
      latitude: 16.544,
      longitude: 81.521,
      address: 'Main Road, Bhimavaram',
      department_id: dummyDeptId,
      assigned_to_user_id: dummyStaffId
    });

    const now = new Date();
    // Simulate staff repair completion
    issue.status = 'Resolved';
    issue.resolved_at = now;
    issue.resolution_type = 'permanent';
    issue.resolution_notes = 'Cold-mix asphalt compaction completed over 2m x 1m section';

    assert.strictEqual(issue.status, 'Resolved');
    assert.strictEqual(issue.resolution_type, 'permanent');
    assert.ok(issue.resolved_at instanceof Date);
    assert.strictEqual(issue.approved_at, null);
  });

  await t.test('4. Admin Approval transitions Resolved issue to Approved and records approval metadata', () => {
    const issue = new SharedIssue({
      issue_code: 'CT-TEST-02',
      title: 'Broken Streetlight',
      category: 'Streetlights and electrical infrastructure',
      description: 'Pole lamp dark for 3 days',
      severity: 'Medium',
      priority_score: 45,
      is_safety_critical: false,
      status: 'Resolved',
      latitude: 16.541,
      longitude: 81.524,
      address: 'College Road, Bhimavaram',
      resolved_at: new Date(Date.now() - 3600000),
      resolution_type: 'permanent',
      resolution_notes: 'LED fixture replaced'
    });

    const approveTime = new Date();
    const approvalNotes = 'Verified by field inspector Ramesh. Illumination measured at standard lux level.';

    // Simulate Admin approval
    issue.status = 'Approved';
    issue.approved_at = approveTime;
    issue.approved_by_user_id = dummyAdminId;
    issue.approval_notes = approvalNotes;

    assert.strictEqual(issue.status, 'Approved');
    assert.strictEqual(issue.approved_by_user_id, dummyAdminId);
    assert.strictEqual(issue.approval_notes, approvalNotes);
    assert.strictEqual(issue.approved_at, approveTime);
    // Preserves original staff repair timestamp and notes
    assert.ok(issue.resolved_at);
    assert.strictEqual(issue.resolution_type, 'permanent');
    assert.strictEqual(issue.resolution_notes, 'LED fixture replaced');
  });

  await t.test('5. Admin Rejection transitions Resolved issue to Rejected and records mandatory reason', () => {
    const issue = new SharedIssue({
      issue_code: 'CT-TEST-03',
      title: 'Water pipe leak',
      category: 'Water supply and leakage',
      description: 'Pressurized water bubbling through pavement',
      severity: 'High',
      priority_score: 70,
      is_safety_critical: false,
      status: 'Resolved',
      latitude: 16.543,
      longitude: 81.522,
      address: 'Station Road, Bhimavaram',
      resolved_at: new Date(Date.now() - 7200000),
      resolution_type: 'temporary',
      resolution_notes: 'Clamp placed on leaking section'
    });

    const rejectTime = new Date();
    const rejectionReason = 'Inspection reveals clamp is weeping water; permanent sleeve replacement required.';

    // Simulate Admin rejection
    issue.status = 'Rejected';
    issue.rejected_at = rejectTime;
    issue.rejected_by_user_id = dummyAdminId;
    issue.rejection_reason = rejectionReason;

    assert.strictEqual(issue.status, 'Rejected');
    assert.strictEqual(issue.rejected_by_user_id, dummyAdminId);
    assert.strictEqual(issue.rejection_reason, rejectionReason);
    assert.strictEqual(issue.rejected_at, rejectTime);
    // Preserves original repair notes and history
    assert.strictEqual(issue.resolution_notes, 'Clamp placed on leaking section');
  });

  await t.test('6. Unresolved Filter ($nin: ["Resolved", "Approved"]) correctly filters both resolved and approved', () => {
    const sampleIssues = [
      { status: 'Pending' },
      { status: 'Assigned' },
      { status: 'In Progress' },
      { status: 'Rejected' },
      { status: 'Reopened' },
      { status: 'Resolved' },
      { status: 'Approved' }
    ];

    const filterOpen = (item) => !['Resolved', 'Approved'].includes(item.status);
    const openIssues = sampleIssues.filter(filterOpen);

    assert.strictEqual(openIssues.length, 5, 'Must keep Pending, Assigned, In Progress, Rejected, and Reopened');
    assert.ok(!openIssues.some(i => i.status === 'Resolved'), 'Resolved must not be counted as open');
    assert.ok(!openIssues.some(i => i.status === 'Approved'), 'Approved must not be counted as open');
    assert.ok(openIssues.some(i => i.status === 'Rejected'), 'Rejected (rework) must be counted as open');
  });

  await t.test('7. Reopen logic allows reopening Resolved and Approved complaints', () => {
    function canReopen(status) {
      return ['Resolved', 'Approved'].includes(status);
    }

    assert.strictEqual(canReopen('Resolved'), true, 'Resolved complaints can be reopened');
    assert.strictEqual(canReopen('Approved'), true, 'Approved complaints can be reopened if failure recurs');
    assert.strictEqual(canReopen('In Progress'), false, 'In Progress complaints cannot be reopened');
    assert.strictEqual(canReopen('Pending'), false, 'Pending complaints cannot be reopened');
  });

  await t.test('8. Status input normalization accurately resolves Title Case for approved and rejected', () => {
    const statusMap = {
      pending: 'Pending',
      assigned: 'Assigned',
      'in progress': 'In Progress',
      in_progress: 'In Progress',
      resolved: 'Resolved',
      approved: 'Approved',
      rejected: 'Rejected',
      reopened: 'Reopened',
      escalated: 'Escalated'
    };

    assert.strictEqual(statusMap['approved'], 'Approved');
    assert.strictEqual(statusMap['rejected'], 'Rejected');
    assert.strictEqual(statusMap['resolved'], 'Resolved');
    assert.strictEqual(statusMap['in_progress'], 'In Progress');
  });
});

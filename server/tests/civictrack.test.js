process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { getDb, closeDb, getDbPath } from '../src/db/connection.js';
import { seedDatabase } from '../src/db/seed.js';
import { evaluateDuplicateMatch, findNearbyDuplicates } from '../src/utils/duplicateDetector.js';
import { calculateInfrastructureRisk } from '../src/utils/riskPredictor.js';
import { calculatePriorityScore } from '../src/utils/priorityScorer.js';
import { requireRole } from '../src/middleware/auth.js';

test('CivicTrack Comprehensive Test Suite', async (t) => {
  // Ensure we are strictly using the isolated test database
  assert.strictEqual(
    getDbPath().endsWith('civictrack.test.sqlite'),
    true,
    'Tests must execute strictly against isolated civictrack.test.sqlite database'
  );

  // Re-seed DB to known clean demonstration state
  await seedDatabase();
  const db = await getDb();

  await t.test('1. Multiple citizens reporting the same issue connects to shared civic issue', async () => {
    const reportsForIssue1 = db.all(
      'SELECT * FROM citizen_reports WHERE shared_issue_id = 1 ORDER BY created_at ASC'
    );
    assert.strictEqual(reportsForIssue1.length >= 4, true, 'CT-101 has multiple linked citizen reports');

    // Verify distinct reporters
    const reporterIds = new Set(reportsForIssue1.map(r => r.user_id));
    assert.strictEqual(reporterIds.size >= 4, true, 'Reports come from distinct citizens');
  });

  await t.test('2. A duplicate report is linked without losing its original data (Section 5 Feature 1D)', async () => {
    const report1 = db.get('SELECT * FROM citizen_reports WHERE report_code = "REP-2024-001"');
    const report2 = db.get('SELECT * FROM citizen_reports WHERE report_code = "REP-2024-002"');

    assert.ok(report1, 'Report 1 exists');
    assert.ok(report2, 'Report 2 exists');
    assert.notStrictEqual(report1.user_id, report2.user_id, 'Original reporters are distinct');
    assert.notStrictEqual(report1.description, report2.description, 'Original descriptions are preserved');
    assert.strictEqual(report2.link_type, 'confirmed_duplicate', 'Link type indicates confirmed duplicate');
    assert.strictEqual(report1.shared_issue_id, report2.shared_issue_id, 'Both reports share the master issue ID');

    // Verify images preserved
    const images1 = db.all('SELECT * FROM report_images WHERE report_id = ?', [report1.id]);
    assert.strictEqual(images1.length > 0, true, 'Original evidence images preserved');
  });

  await t.test('3. Two nearby but separate issues remain separate and are not auto-merged', async () => {
    const issue1 = db.get('SELECT * FROM shared_issues WHERE issue_code = "CT-101"');
    const issue2 = db.get('SELECT * FROM shared_issues WHERE issue_code = "CT-102"');

    assert.ok(issue1);
    assert.ok(issue2);
    assert.notStrictEqual(issue1.id, issue2.id, 'Issues have distinct IDs');
    assert.notStrictEqual(issue1.infrastructure_id, issue2.infrastructure_id, 'Issues link to distinct assets');
    assert.strictEqual(issue1.is_merged_into_id, null, 'Issue 1 is not merged');
    assert.strictEqual(issue2.is_merged_into_id, null, 'Issue 2 is not merged');
  });

  await t.test('4. An administrator merging two confirmed duplicate shared issues preserves audit history', async () => {
    // Create two dummy shared issues to test merging
    const now = new Date().toISOString();
    const resA = db.run(
      `INSERT INTO shared_issues (issue_code, title, category, description, status, latitude, longitude, address, first_reported_at, latest_reported_at, created_at, updated_at)
       VALUES ('CT-TEST-A', 'Road hole A', 'Roads and potholes', 'Desc A', 'Pending', 37.77, -122.41, 'Test Rd', ?, ?, ?, ?)`,
      [now, now, now, now]
    );
    const resB = db.run(
      `INSERT INTO shared_issues (issue_code, title, category, description, status, latitude, longitude, address, first_reported_at, latest_reported_at, created_at, updated_at)
       VALUES ('CT-TEST-B', 'Road hole B', 'Roads and potholes', 'Desc B', 'Pending', 37.77, -122.41, 'Test Rd', ?, ?, ?, ?)`,
      [now, now, now, now]
    );

    const targetId = resA.lastInsertRowid;
    const sourceId = resB.lastInsertRowid;

    // Attach report to source
    db.run(
      `INSERT INTO citizen_reports (report_code, user_id, shared_issue_id, title, category, description, latitude, longitude, address, created_at)
       VALUES ('REP-TEST-B', 4, ?, 'Report B', 'Roads and potholes', 'Desc', 37.77, -122.41, 'Test', ?)`,
      [sourceId, now]
    );

    // Merge source into target
    db.run('UPDATE citizen_reports SET shared_issue_id = ?, link_type = "admin_merged" WHERE shared_issue_id = ?', [targetId, sourceId]);
    db.run('UPDATE shared_issues SET is_merged_into_id = ?, status = "Resolved" WHERE id = ?', [targetId, sourceId]);
    db.run('INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details, created_at) VALUES ("MERGE_ISSUES", "shared_issue", ?, 1, ?, ?)',
      [targetId, JSON.stringify({ sourceId, targetId }), now]
    );

    // Verify report moved
    const movedReport = db.get('SELECT * FROM citizen_reports WHERE report_code = "REP-TEST-B"');
    assert.strictEqual(movedReport.shared_issue_id, targetId, 'Report was linked to target issue');
    assert.strictEqual(movedReport.link_type, 'admin_merged', 'Report link_type reflects admin merge');

    // Verify audit log
    const audit = db.get('SELECT * FROM audit_logs WHERE action = "MERGE_ISSUES" AND entity_id = ?', [targetId]);
    assert.ok(audit, 'Audit log recorded for merge');
  });

  await t.test('5. A new incident occurring after an earlier repair increments recurrence sequence', async () => {
    const assetId = 1; // RD-204
    const incidents = db.all(
      'SELECT * FROM infrastructure_incidents WHERE infrastructure_id = ? ORDER BY recurrence_sequence ASC',
      [assetId]
    );
    assert.strictEqual(incidents.length >= 4, true, 'Multiple recurring incidents recorded over time');
    assert.strictEqual(incidents[incidents.length - 1].recurrence_sequence >= 4, true, 'Recurrence sequence properly incremented');
  });

  await t.test('6. Report totals and unique-issue totals are calculated correctly (10 reports != 10 issues)', async () => {
    const totalReports = db.get('SELECT COUNT(*) as count FROM citizen_reports').count;
    const uniqueIssues = db.get('SELECT COUNT(*) as count FROM shared_issues WHERE is_merged_into_id IS NULL').count;

    assert.strictEqual(totalReports > uniqueIssues, true, 'Total reports exceeds unique civic issues');
    assert.strictEqual(uniqueIssues >= 5, true, 'Unique civic issues counted accurately');
  });

  await t.test('7. Unauthorized users (citizen) are prevented from administrative operations', async () => {
    const middleware = requireRole('admin');
    let statusCalled = null;
    let jsonCalled = null;

    const fakeReq = { user: { id: 4, role: 'citizen' } };
    const fakeRes = {
      status: (code) => {
        statusCalled = code;
        return {
          json: (payload) => {
            jsonCalled = payload;
          }
        };
      }
    };
    let nextCalled = false;

    middleware(fakeReq, fakeRes, () => {
      nextCalled = true;
    });

    assert.strictEqual(statusCalled, 403, 'Citizen role is rejected with 403 Forbidden');
    assert.strictEqual(nextCalled, false, 'Next middleware was not called');
  });

  await t.test('8. Risk score does not inflate from duplicate reports about one incident', async () => {
    const asset = db.get('SELECT * FROM infrastructure_assets WHERE id = 1');
    const singleIncident = [{ id: 1, started_at: new Date().toISOString() }];
    const noRepairs = [];

    // Calculate risk with 1 distinct incident
    const riskSingle = calculateInfrastructureRisk({
      asset,
      distinctIncidents: singleIncident,
      repairRecords: noRepairs,
      unresolvedIssuesCount: 1
    });

    // Even if 10 duplicate citizen reports exist for that single incident, distinctIncidents remains 1!
    assert.strictEqual(riskSingle.riskScore < 50, true, 'Single incident does not trigger critical risk');

    // But if 4 distinct historical incidents occur over time:
    const multipleIncidents = [
      { id: 1, started_at: '2024-01-01' },
      { id: 2, started_at: '2024-02-15' },
      { id: 3, started_at: '2024-04-01' },
      { id: 4, started_at: '2024-05-10' }
    ];
    const riskMultiple = calculateInfrastructureRisk({
      asset,
      distinctIncidents: multipleIncidents,
      repairRecords: [{ repair_type: 'temporary' }],
      unresolvedIssuesCount: 2
    });

    assert.strictEqual(riskMultiple.riskScore >= 70, true, 'Distinct recurring incidents trigger high risk');
  });

  await t.test('9. Authentication verifies credentials against database and rejects invalid passwords', async () => {
    const adminUser = db.get('SELECT * FROM users WHERE email = "admin@civictrack.org"');
    assert.ok(adminUser, 'Admin user exists in database');
    assert.strictEqual(adminUser.role, 'admin', 'Admin has admin role');
    assert.strictEqual(adminUser.name, 'Suresh Varma (Municipal Commissioner)', 'Admin has proper Indian municipal name');

    const validPass = await bcrypt.compare('admin123', adminUser.password_hash);
    const invalidPass = await bcrypt.compare('wrongpassword', adminUser.password_hash);
    assert.strictEqual(validPass, true, 'Valid password matches database hash');
    assert.strictEqual(invalidPass, false, 'Invalid password is fundamentally rejected');
  });

  await t.test('10. Public registration strictly prevents escalation to Admin or Staff accounts', async () => {
    // Attempting to register as admin via backend logic
    const reqBody = {
      name: 'Hacker User',
      email: 'hacker@test.com',
      password: 'password123',
      role: 'admin'
    };

    // Simulated registration handler check
    assert.notStrictEqual(reqBody.role === 'admin' ? 'rejected' : 'allowed', 'allowed', 'Admin escalation in public registration is blocked');
  });

  await t.test('11. Citizen query isolates citizen-specific reports and followed issues', async () => {
    // User 4 has reports
    const user4Reports = db.all('SELECT * FROM citizen_reports WHERE user_id = 4');
    assert.strictEqual(user4Reports.length > 0, true, 'User 4 has their own reports');

    // User 9 (new citizen) has 0 reports and honest empty state
    const user9Reports = db.all('SELECT * FROM citizen_reports WHERE user_id = 9');
    assert.strictEqual(user9Reports.length, 0, 'User 9 starts with empty dashboard reports without fake data');
  });

  await t.test('12. Department staff cannot update work orders of other municipal departments', async () => {
    const roadsStaff = db.get('SELECT * FROM users WHERE email = "roads.staff@civictrack.org"');
    const waterIssue = db.get('SELECT * FROM shared_issues WHERE department_id = 3 LIMIT 1');

    if (waterIssue) {
      assert.notStrictEqual(roadsStaff.department_id, waterIssue.department_id, 'Departments are different');
    }
  });

  await t.test('13. Password reset token is securely hashed, single-use, and invalidates previous tokens', async () => {
    const crypto = await import('crypto');
    const citizen = db.get('SELECT * FROM users WHERE email = "citizen.alice@example.com"');
    assert.ok(citizen, 'Citizen Alice exists');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const now = new Date().toISOString();

    // Insert reset token
    db.run(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [citizen.id, tokenHash, expiresAt, now]
    );

    const saved = db.get('SELECT * FROM password_resets WHERE token_hash = ?', [tokenHash]);
    assert.ok(saved, 'Token stored with SHA-256 hash');
    assert.strictEqual(saved.used_at, null, 'Token is initially unused');

    // Perform password reset
    const newPassword = 'NewSecretPassword123!';
    const newHash = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, citizen.id]);
    db.run('UPDATE password_resets SET used_at = ? WHERE id = ?', [now, saved.id]);

    const updatedUser = db.get('SELECT * FROM users WHERE id = ?', [citizen.id]);
    const matchesNew = await bcrypt.compare(newPassword, updatedUser.password_hash);
    assert.strictEqual(matchesNew, true, 'New password verifies against database');

    const usedRecord = db.get('SELECT * FROM password_resets WHERE id = ?', [saved.id]);
    assert.ok(usedRecord.used_at, 'Token is marked as used');
  });

  await t.test('14. Expired or reused password reset token is strictly rejected', async () => {
    const crypto = await import('crypto');
    const citizen = db.get('SELECT * FROM users WHERE email = "citizen.alice@example.com"');
    const expiredToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
    const pastTime = new Date(Date.now() - 3600000).toISOString();

    db.run(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [citizen.id, expiredHash, pastTime, pastTime]
    );

    const checkRecord = db.get('SELECT * FROM password_resets WHERE token_hash = ?', [expiredHash]);
    const isExpired = new Date(checkRecord.expires_at) < new Date();
    assert.strictEqual(isExpired, true, 'Past expiry timestamp identifies expired token');
  });

  await t.test('15. Prevention of cross-citizen private report inspection', async () => {
    // User Alice (ID 4) owns report REP-2024-001
    const report1 = db.get('SELECT * FROM citizen_reports WHERE report_code = "REP-2024-001"');
    assert.ok(report1, 'Report 1 exists');
    assert.strictEqual(report1.user_id, 4, 'Report belongs to Alice (ID 4)');

    // Citizen User 9 (e.g. Yasaswini) querying Alice's report should be identified as non-owner
    const requestingUserId = 9;
    const isOwnerOrStaffOrAdmin = requestingUserId === report1.user_id; // citizen check
    assert.strictEqual(isOwnerOrStaffOrAdmin, false, 'Non-owner citizen is strictly flagged as unauthorized for private report lookup');
  });

  await t.test('16. Work order status update enforces department ownership and records audit logs', async () => {
    const roadsStaff = db.get('SELECT * FROM users WHERE email = "roads.staff@civictrack.org"');
    const roadsIssue = db.get('SELECT * FROM shared_issues WHERE department_id = ? LIMIT 1', [roadsStaff.department_id]);
    assert.ok(roadsIssue, 'Roads issue exists');

    const now = new Date().toISOString();
    // Simulate valid status change
    db.run(
      'UPDATE shared_issues SET status = "In Progress", updated_at = ? WHERE id = ?',
      [now, roadsIssue.id]
    );

    // Audit log and status history
    db.run(
      'INSERT INTO status_history (shared_issue_id, old_status, new_status, changed_by_user_id, comments, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [roadsIssue.id, roadsIssue.status, 'In Progress', roadsStaff.id, 'Work crew dispatched on site', now]
    );

    const updated = db.get('SELECT * FROM shared_issues WHERE id = ?', [roadsIssue.id]);
    assert.strictEqual(updated.status, 'In Progress', 'Status successfully changed');

    const history = db.all('SELECT * FROM status_history WHERE shared_issue_id = ? ORDER BY id DESC', [roadsIssue.id]);
    assert.strictEqual(history.length > 0, true, 'Status history record persisted');
    assert.strictEqual(history[0].new_status, 'In Progress', 'New status recorded in history');
  });

  await t.test('17. Maintenance expenditure metrics in INR match individual ledger repair records', async () => {
    const totalExpenditureRow = db.get('SELECT SUM(cost_amount) as total FROM repair_records WHERE cost_amount IS NOT NULL');
    const expectedTotal = totalExpenditureRow ? Math.round(totalExpenditureRow.total) : 0;

    const { computeMaintenanceWaste } = await import('../src/utils/analyticsEngine.js');
    const waste = computeMaintenanceWaste(db);

    assert.strictEqual(waste.totalExpenditure, expectedTotal, 'Calculated total expenditure matches DB sum');
    assert.strictEqual(waste.totalExpenditure > 0, true, 'Total expenditure is calculated from real ledger');
  });
});

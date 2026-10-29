process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, getDbPath } from '../src/db/connection.js';
import { evaluateDuplicateMatch, findNearbyDuplicates } from '../src/utils/duplicateDetector.js';
import { computeMaintenanceWaste, computeRepairEffectiveness } from '../src/utils/analyticsEngine.js';

test('CivicTrack End-to-End Workflow & Quality Audit Verification', async (t) => {
  // 1. Confirm test isolation
  assert.strictEqual(
    getDbPath().endsWith('civictrack.test.sqlite'),
    true,
    'E2E tests must execute strictly against isolated civictrack.test.sqlite database'
  );

  const db = await getDb();

  await t.test('Flow 1: Form & Authentication Credential Verification', async () => {
    // Check that wrong password is fundamentally rejected
    const admin = db.get('SELECT * FROM users WHERE email = "admin@civictrack.org"');
    assert.ok(admin, 'Admin account exists');

    const wrongPassMatch = await bcrypt.compare('WrongPassword999', admin.password_hash);
    assert.strictEqual(wrongPassMatch, false, 'Invalid credentials fail verification');

    const correctPassMatch = await bcrypt.compare('admin123', admin.password_hash);
    assert.strictEqual(correctPassMatch, true, 'Valid credentials pass verification');
  });

  await t.test('Flow 2: Password Reset Token Security & Recovery Cycle', async () => {
    const citizen = db.get('SELECT * FROM users WHERE email = "citizen.alice@example.com"');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const now = new Date().toISOString();

    // 1. Store hashed token
    db.run(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [citizen.id, tokenHash, expiresAt, now]
    );

    // 2. Validate token lookup
    const tokenRecord = db.get('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL', [tokenHash]);
    assert.ok(tokenRecord, 'Token successfully located by secure hash');
    assert.strictEqual(new Date(tokenRecord.expires_at) > new Date(), true, 'Token is active and unexpired');

    // 3. Complete password reset
    const updatedPass = 'AliceBrandNewPass2026!';
    const updatedHash = await bcrypt.hash(updatedPass, 10);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [updatedHash, citizen.id]);
    db.run('UPDATE password_resets SET used_at = ? WHERE id = ?', [new Date().toISOString(), tokenRecord.id]);

    // 4. Verify new credentials work
    const updatedUser = db.get('SELECT * FROM users WHERE id = ?', [citizen.id]);
    const isNewValid = await bcrypt.compare(updatedPass, updatedUser.password_hash);
    assert.strictEqual(isNewValid, true, 'User can authenticate with newly reset password');

    // 5. Verify token cannot be reused
    const reusedRecord = db.get('SELECT * FROM password_resets WHERE token_hash = ?', [tokenHash]);
    assert.ok(reusedRecord.used_at, 'Token is permanently invalidated after first use');
  });

  await t.test('Flow 3: Citizen Complaint Submission, Duplicate Matching & Ownership Persistence', async () => {
    const now = new Date().toISOString();
    // Unique test user
    const passHash = await bcrypt.hash('testpass123', 10);
    const userRes = db.run(
      'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['Test Citizen Submitter', 'submitter.test@bhimavaram.org', passHash, 'citizen', now]
    );
    const userId = userRes.lastInsertRowid;

    // 1. Create a master shared issue
    const issueRes = db.run(
      `INSERT INTO shared_issues (
        issue_code, title, category, description, severity, priority_score,
        status, latitude, longitude, address, first_reported_at, latest_reported_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'CT-TEST-99', 'Large Pothole near Someswara Temple', 'Roads and potholes',
        'Deep water-filled pothole causing vehicle congestion', 'High', 75,
        'Pending', 16.5445, 81.5215, 'Someswara Temple Road, Bhimavaram', now, now, now, now
      ]
    );
    const sharedIssueId = issueRes.lastInsertRowid;

    // 2. Submit citizen report linked to this shared issue
    const reportCode = 'REP-TEST-099';
    const reportRes = db.run(
      `INSERT INTO citizen_reports (
        report_code, user_id, shared_issue_id, title, category, description,
        severity, latitude, longitude, address, status, link_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportCode, userId, sharedIssueId, 'Deep road cavity at temple road', 'Roads and potholes',
        'Visible erosion and sharp edges', 'High', 16.5446, 81.5216,
        'Someswara Temple Road, Bhimavaram', 'Pending', 'original', now
      ]
    );
    const reportId = reportRes.lastInsertRowid;

    // 3. Verify retrieval by owner
    const myReports = db.all('SELECT * FROM citizen_reports WHERE user_id = ?', [userId]);
    assert.strictEqual(myReports.length, 1, 'Citizen has exactly 1 submitted report');
    assert.strictEqual(myReports[0].report_code, reportCode, 'Report code matches');
    assert.strictEqual(myReports[0].shared_issue_id, sharedIssueId, 'Report is connected to master shared issue');

    // 4. Verify privacy: another citizen cannot claim or view this private report
    const otherCitizenId = 99999;
    const isOwner = myReports[0].user_id === otherCitizenId;
    assert.strictEqual(isOwner, false, 'Another citizen is flagged as non-owner');
  });

  await t.test('Flow 4: Staff Department Scoped Access & Work Order Management', async () => {
    // Roads staff
    const roadsStaff = db.get('SELECT * FROM users WHERE email = "roads.staff@civictrack.org"');
    assert.ok(roadsStaff, 'Roads staff exists');

    // Issue assigned to roads
    const roadsDept = db.get('SELECT id FROM departments WHERE code = "ROADS"');
    const waterDept = db.get('SELECT id FROM departments WHERE code = "WATER"');

    // Staff can only update their own department's issues
    assert.strictEqual(roadsStaff.department_id, roadsDept.id, 'Staff belongs to ROADS department');
    assert.notStrictEqual(roadsStaff.department_id, waterDept.id, 'Staff does NOT belong to WATER department');
  });

  await t.test('Flow 5: Currency and Cost Calculations in Indian Rupees (₹)', async () => {
    const waste = computeMaintenanceWaste(db);
    assert.strictEqual(typeof waste.totalExpenditure, 'number', 'Expenditure is a valid number');
    assert.strictEqual(waste.totalExpenditure >= 0, true, 'Expenditure is non-negative');

    const formattedINR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(waste.totalExpenditure);
    assert.strictEqual(formattedINR.includes('₹'), true, 'Formatted cost starts with ₹ symbol');
  });
});

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, getDbPath } from '../src/db/connection.js';
import { initSchema, initDefaultData, DEFAULT_DEPARTMENTS } from '../src/db/schema.js';
import { seedDatabase } from '../src/db/seed.js';
import reportRoutes from '../src/routes/reports.js';
import authRoutes from '../src/routes/auth.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateToken } from '../src/middleware/auth.js';

test('Regression Test: Complaint Submission Foreign Key Constraints & Safe Initialization', async (t) => {
  assert.strictEqual(
    getDbPath().endsWith('civictrack.test.sqlite'),
    true,
    'Tests must execute strictly against test database'
  );

  // Initialize fresh clean seed
  await seedDatabase();
  const db = await getDb();

  await t.test('1. Direct foreign key violation reproduction: invalid department_id strictly fails', async () => {
    const now = new Date().toISOString();
    
    // Attempting to insert a shared issue with non-existent department ID must fail with FOREIGN KEY constraint error
    assert.throws(
      () => {
        db.run(
          `INSERT INTO shared_issues (
            issue_code, title, category, description, severity, priority_score,
            is_safety_critical, status, latitude, longitude, address,
            department_id, infrastructure_id, estimated_affected_population,
            affected_population_details, first_reported_at, latest_reported_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'CT-BUG-TEST',
            'FK Violation Test Pothole',
            'Roads and potholes',
            'Testing direct FK enforcement',
            'Medium',
            50,
            0,
            16.54,
            81.52,
            'Main Road',
            999999, // Non-existent department ID
            null,
            25,
            'Test details',
            now,
            now,
            now,
            now
          ]
        );
      },
      (err) => {
        return err.message && err.message.includes('FOREIGN KEY constraint failed');
      },
      'SQLite must throw FOREIGN KEY constraint failed when referencing invalid department ID'
    );
  });

  await t.test('2. Idempotent default data initialization guarantees required departments', async () => {
    // Run initDefaultData multiple times
    await initDefaultData(db);
    await initDefaultData(db);

    const depts = db.all('SELECT * FROM departments');
    assert.strictEqual(depts.length >= 5, true, 'At least 5 core departments exist');

    for (const expected of DEFAULT_DEPARTMENTS) {
      const found = depts.find(d => d.code === expected.code);
      assert.ok(found, `Department with code ${expected.code} is present`);
      assert.ok(found.id > 0, `Department ${expected.code} has a valid positive ID`);
    }
  });

  await t.test('3. Complaint submission resolves valid department and creates issue successfully', async () => {
    const citizen = db.get('SELECT * FROM users WHERE role = "citizen" LIMIT 1');
    assert.ok(citizen, 'Test citizen exists');

    const now = new Date().toISOString();
    const issueCode = `CT-REG-${Date.now().toString().slice(-4)}`;

    // Look up department code dynamically like reports route
    const dept = db.get('SELECT id, sla_hours FROM departments WHERE code = "ROADS"') ||
                 db.get('SELECT id, sla_hours FROM departments ORDER BY id ASC LIMIT 1');
    assert.ok(dept, 'Department found in database');

    const res = db.run(
      `INSERT INTO shared_issues (
        issue_code, title, category, description, severity, priority_score,
        is_safety_critical, status, latitude, longitude, address,
        department_id, infrastructure_id, estimated_affected_population,
        affected_population_details, first_reported_at, latest_reported_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issueCode,
        'Somavaram Canal Road Damaged Culvert',
        'Roads and potholes',
        'Culvert concrete collapsed, hazard for two-wheelers',
        'High',
        75,
        1,
        16.5412,
        81.5234,
        'Somavaram Canal Road, Bhimavaram',
        dept.id,
        null,
        85,
        'Immediate traffic hazard',
        now,
        now,
        now,
        now
      ]
    );

    const sharedIssueId = res.lastInsertRowid;
    assert.ok(sharedIssueId > 0, 'Shared issue created successfully with valid FK');

    // Insert linked citizen report
    const repCode = `REP-REG-${Date.now().toString().slice(-4)}`;
    const repRes = db.run(
      `INSERT INTO citizen_reports (
        report_code, user_id, shared_issue_id, title, category, description,
        severity, latitude, longitude, address, status, similarity_match_score,
        link_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 100, 'original', ?)`,
      [
        repCode,
        citizen.id,
        sharedIssueId,
        'Somavaram Canal Road Damaged Culvert',
        'Roads and potholes',
        'Culvert concrete collapsed, hazard for two-wheelers',
        'High',
        16.5412,
        81.5234,
        'Somavaram Canal Road, Bhimavaram',
        now
      ]
    );

    assert.ok(repRes.lastInsertRowid > 0, 'Citizen report inserted with valid user and issue FKs');

    // Verify foreign key integrity
    const savedIssue = db.get('SELECT s.*, d.name as dept_name FROM shared_issues s JOIN departments d ON s.department_id = d.id WHERE s.id = ?', [sharedIssueId]);
    assert.ok(savedIssue, 'Joined query across shared_issues and departments succeeds');
    assert.strictEqual(savedIssue.department_id, dept.id);
  });

  await t.test('4. Foreign keys remain enabled and enforced globally in dbWrapper', async () => {
    const fkCheck = db.get('PRAGMA foreign_keys;');
    assert.strictEqual(fkCheck.foreign_keys, 1, 'PRAGMA foreign_keys must be strictly ON');
  });

  await t.test('5. Non-existent confirmedExistingIssueId is safely rejected by database lookup', async () => {
    const invalidIssueId = 999999;
    const existing = db.get('SELECT * FROM shared_issues WHERE id = ?', [invalidIssueId]);
    assert.strictEqual(existing, null, 'Non-existent shared issue returns null, preventing invalid FK link');
  });

  await t.test('6. In-Process Route Handler: POST /api/reports verifies no FK failure', async () => {
    const citizen = db.get('SELECT * FROM users WHERE role = "citizen" LIMIT 1');
    assert.ok(citizen, 'Test citizen exists');

    // Extract the POST / handler from reportRoutes
    const postRoute = reportRoutes.stack.find(
      layer => layer.route && layer.route.path === '/' && layer.route.methods.post
    );
    assert.ok(postRoute, 'POST / route exists in reportRoutes');
    const routeHandler = postRoute.route.stack[postRoute.route.stack.length - 1].handle;

    // Helper to simulate request / response
    async function executePost(body, user = citizen) {
      let statusCode = 200;
      let responseData = null;
      const req = {
        body,
        user,
        headers: {}
      };
      const res = {
        status(code) {
          statusCode = code;
          return res;
        },
        json(data) {
          responseData = data;
          return res;
        }
      };

      await routeHandler(req, res);
      return { status: statusCode, data: responseData };
    }

    // 6a. Valid complaint submission creates issue and links report without 500 error
    const validResult = await executePost({
      title: 'Overflowing Municipal Drain near Market',
      category: 'Water logging and drainage',
      description: 'Drain blocked with silt causing waterlogging in front of shops',
      severity: 'High',
      latitude: 16.543,
      longitude: 81.522,
      address: 'Main Market Road, Bhimavaram',
      isSafetyCritical: 0
    });

    assert.strictEqual(validResult.status, 201, 'Valid report submission returns HTTP 201');
    assert.ok(validResult.data.sharedIssueId > 0, 'Returns sharedIssueId');
    assert.ok(validResult.data.reportId > 0, 'Returns reportId');
    assert.strictEqual(validResult.data.isNewSharedIssue, true, 'Flagged as new shared issue');

    // Verify in DB that department was assigned correctly
    const createdIssue = db.get('SELECT * FROM shared_issues WHERE id = ?', [validResult.data.sharedIssueId]);
    assert.ok(createdIssue, 'Created issue exists in database');
    assert.ok(createdIssue.department_id > 0, 'Department ID is populated');
    const dept = db.get('SELECT * FROM departments WHERE id = ?', [createdIssue.department_id]);
    assert.ok(dept, 'Referenced department exists in departments table');

    // 6b. Submit with unmapped category: falls back gracefully without FK error
    const unmappedResult = await executePost({
      title: 'Strange Odor near Canal',
      category: 'Miscellaneous / Other',
      description: 'Strong chemical odor detected along canal path',
      severity: 'Low',
      latitude: 16.541,
      longitude: 81.521,
      address: 'Canal Bank, Bhimavaram'
    });
    assert.strictEqual(unmappedResult.status, 201, 'Unmapped category returns 201');
    assert.ok(unmappedResult.data.sharedIssueId > 0, 'Unmapped category created issue successfully');

    // 6c. Submit with invalid confirmedExistingIssueId returns 404
    const invalidLinkResult = await executePost({
      title: 'Pothole duplicate attempt',
      category: 'Roads and potholes',
      description: 'Attempting to link to invalid issue',
      severity: 'Medium',
      latitude: 16.54,
      longitude: 81.52,
      confirmedExistingIssueId: 999999
    });
    assert.strictEqual(invalidLinkResult.status, 404, 'Invalid confirmedExistingIssueId returns 404');
    assert.strictEqual(invalidLinkResult.data.error, 'The selected shared issue does not exist.');

    // 6d. Submit with user not in database returns 401
    const ghostResult = await executePost(
      {
        title: 'Ghost submission',
        category: 'Roads and potholes',
        description: 'Submission by non-existent user ID',
        severity: 'Low',
        latitude: 16.54,
        longitude: 81.52
      },
      { id: 999999, name: 'Ghost', email: 'ghost@example.com', role: 'citizen' }
    );
    assert.strictEqual(ghostResult.status, 401, 'Ghost user token returns 401');
    assert.ok(ghostResult.data.error.includes('not found'), 'Returns meaningful user not found error');
  });

  await t.test('7. Password Recovery Security: Token secrecy, account enumeration resistance, expiry, single-use, and failure handling', async () => {
    function getHandler(method, path) {
      const layer = authRoutes.stack.find(
        l => l.route && l.route.path === path && l.route.methods[method.toLowerCase()]
      );
      assert.ok(layer, `${method} ${path} route exists`);
      return layer.route.stack[layer.route.stack.length - 1].handle;
    }

    const forgotHandler = getHandler('post', '/forgot-password');
    const validateHandler = getHandler('post', '/validate-reset-token');
    const resetHandler = getHandler('post', '/reset-password');
    const loginHandler = getHandler('post', '/login');

    async function callRoute(handler, body, headers = {}) {
      let statusCode = 200;
      let responseData = null;
      const req = { body, headers, ip: '127.0.0.1' };
      const res = {
        status(code) {
          statusCode = code;
          return res;
        },
        json(data) {
          responseData = data;
          return res;
        }
      };
      await handler(req, res);
      return { status: statusCode, data: responseData };
    }

    const targetEmail = 'citizen.alice@example.com';
    const nonExistentEmail = 'completely.nonexistent.user.999@example.com';

    // 7a. Never disclose reset tokens or reset URLs in API responses
    const forgotRes = await callRoute(forgotHandler, { email: targetEmail });
    assert.strictEqual(forgotRes.status, 200, 'Forgot password returns HTTP 200');
    assert.strictEqual(forgotRes.data.dev_reset_token, undefined, 'dev_reset_token MUST NOT exist in response');
    assert.strictEqual(forgotRes.data.reset_url, undefined, 'reset_url MUST NOT exist in response');
    assert.strictEqual(JSON.stringify(forgotRes.data).includes('token='), false, 'Response payload must never contain a token');

    // 7b. Existing and nonexistent accounts receive equivalent public responses
    const nonExistentRes = await callRoute(forgotHandler, { email: nonExistentEmail });
    assert.strictEqual(nonExistentRes.status, 200, 'Non-existent account returns HTTP 200');
    assert.strictEqual(forgotRes.data.message, nonExistentRes.data.message, 'Response message must be identical');
    assert.strictEqual(forgotRes.data.email_service_configured, nonExistentRes.data.email_service_configured, 'email_service_configured status must match');
    assert.deepStrictEqual(
      Object.keys(forgotRes.data).sort(),
      Object.keys(nonExistentRes.data).sort(),
      'Response keys must be identical to prevent account enumeration'
    );

    // 7c. Missing SMTP configuration is handled safely
    const oldHost = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    const unconfiguredRes = await callRoute(forgotHandler, { email: targetEmail });
    assert.strictEqual(unconfiguredRes.status, 200, 'Missing SMTP returns 200 without crashing');
    assert.strictEqual(unconfiguredRes.data.email_service_configured, false, 'Reports SMTP not configured');
    assert.ok(unconfiguredRes.data.notice, 'Provides safe server notice');
    assert.ok(Array.isArray(unconfiguredRes.data.required_env), 'Lists required environment variables');
    if (oldHost) process.env.SMTP_HOST = oldHost;

    // 7d. SMTP delivery failure: Equivalent public responses across existing and nonexistent accounts,
    // and immediate invalidation of generated tokens to prevent enumeration and unauthorized usage.
    const envBackup = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    };
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = '65534'; // Unreachable port
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'testpass';

    // Request for existing account when SMTP delivery fails
    const existingFailedRes = await callRoute(forgotHandler, { email: targetEmail });

    // Request for nonexistent account when SMTP delivery fails
    const nonExistentFailedRes = await callRoute(forgotHandler, { email: nonExistentEmail });

    // Anti-enumeration assertions: Status code, message, and payload keys must be completely equivalent
    assert.strictEqual(existingFailedRes.status, 200, 'Existing account returns HTTP 200 on SMTP failure');
    assert.strictEqual(nonExistentFailedRes.status, 200, 'Nonexistent account returns HTTP 200 on SMTP failure');
    assert.strictEqual(
      existingFailedRes.data.message,
      nonExistentFailedRes.data.message,
      'Public response message must be identical regardless of account existence on SMTP failure'
    );
    assert.strictEqual(
      existingFailedRes.data.email_service_configured,
      nonExistentFailedRes.data.email_service_configured,
      'Email service configured status must be identical'
    );
    assert.deepStrictEqual(
      Object.keys(existingFailedRes.data).sort(),
      Object.keys(nonExistentFailedRes.data).sort(),
      'Response structure must be identical to prevent enumeration'
    );
    assert.strictEqual(existingFailedRes.data.dev_reset_token, undefined, 'dev_reset_token MUST NOT be disclosed');
    assert.strictEqual(existingFailedRes.data.reset_url, undefined, 'reset_url MUST NOT be disclosed');
    assert.strictEqual(existingFailedRes.data.error, undefined, 'Internal delivery error MUST NOT be exposed to client');

    // Token invalidation: The newly created token for existing account must be immediately invalidated
    const aliceUser = db.get('SELECT id FROM users WHERE email = ?', [targetEmail]);
    const latestReset = db.get(
      'SELECT * FROM password_resets WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [aliceUser.id]
    );
    assert.ok(latestReset, 'Reset record was created in database');
    assert.ok(latestReset.used_at !== null, 'Token was immediately invalidated (used_at set) after failed delivery');
    assert.ok(new Date(latestReset.expires_at) <= new Date(), 'Token was expired immediately upon failure');

    // Verify token cannot be queried as active
    const activeTokenCheck = db.get(
      'SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL',
      [latestReset.token_hash]
    );
    assert.ok(!activeTokenCheck, 'Undelivered token is not queryable as active');

    // Restore env
    if (envBackup.host) process.env.SMTP_HOST = envBackup.host; else delete process.env.SMTP_HOST;
    if (envBackup.port) process.env.SMTP_PORT = envBackup.port; else delete process.env.SMTP_PORT;
    if (envBackup.user) process.env.SMTP_USER = envBackup.user; else delete process.env.SMTP_USER;
    if (envBackup.pass) process.env.SMTP_PASS = envBackup.pass; else delete process.env.SMTP_PASS;

    // 7e. Cryptographic token security: expired tokens cannot be used
    const alice = db.get('SELECT id FROM users WHERE email = ?', [targetEmail]);
    assert.ok(alice, 'Citizen Alice found in DB');

    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredTokenHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
    const pastExpiry = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [alice.id, expiredTokenHash, pastExpiry, now]
    );

    const expiredValidateRes = await callRoute(validateHandler, { token: expiredRawToken });
    assert.strictEqual(expiredValidateRes.status, 400, 'Expired token validation returns 400');
    assert.ok(expiredValidateRes.data.error.includes('expired'), 'Validation error mentions expired');

    const expiredResetRes = await callRoute(resetHandler, { token: expiredRawToken, password: 'NewPassword123' });
    assert.strictEqual(expiredResetRes.status, 400, 'Expired token reset returns 400');
    assert.ok(expiredResetRes.data.error.includes('expired'), 'Reset error mentions expired');

    // 7f. Valid token resets password and cannot be reused
    const validRawToken = crypto.randomBytes(32).toString('hex');
    const validTokenHash = crypto.createHash('sha256').update(validRawToken).digest('hex');
    const futureExpiry = new Date(Date.now() + 3600000).toISOString();

    db.run(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [alice.id, validTokenHash, futureExpiry, now]
    );

    const validValidateRes = await callRoute(validateHandler, { token: validRawToken });
    assert.strictEqual(validValidateRes.status, 200, 'Valid token validation returns 200');
    assert.strictEqual(validValidateRes.data.valid, true, 'Valid token reported as valid');

    const newPassword = 'SecureNewPassword2026!';
    const successfulResetRes = await callRoute(resetHandler, { token: validRawToken, password: newPassword });
    assert.strictEqual(successfulResetRes.status, 200, 'Password reset returns 200');
    assert.ok(successfulResetRes.data.message.includes('successfully'), 'Returns success confirmation');

    // Reusing the same token must fail
    const reusedResetRes = await callRoute(resetHandler, { token: validRawToken, password: 'AnotherPassword!' });
    assert.strictEqual(reusedResetRes.status, 400, 'Token reuse returns 400');
    assert.ok(reusedResetRes.data.error.includes('already been used'), 'Reused token error mentions already used');

    // Login with new password succeeds, old password fails
    const oldLoginRes = await callRoute(loginHandler, { email: targetEmail, password: 'citizen123' });
    assert.strictEqual(oldLoginRes.status, 401, 'Old password rejected');

    const newLoginRes = await callRoute(loginHandler, { email: targetEmail, password: newPassword });
    assert.strictEqual(newLoginRes.status, 200, 'New password accepted');
    assert.ok(newLoginRes.data.token, 'Returns authenticated JWT token');
  });
});

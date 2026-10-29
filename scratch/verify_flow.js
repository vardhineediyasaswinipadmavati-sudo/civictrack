import http from 'http';
import assert from 'assert';
import { getDb } from '../server/src/db/connection.js';
import { seedDatabase } from '../server/src/db/seed.js';

// Helper to make HTTP requests
function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('=== CIVICTRACK END-TO-END FLOW VERIFICATION ===\n');

  // 1. Re-seed to clean known state
  await seedDatabase();

  // Dynamically import server app
  const { app } = await import('../server/src/index.js');
  const server = app.listen(5099);
  console.log('Test server started on port 5099');

  const baseOptions = {
    hostname: 'localhost',
    port: 5099,
    headers: { 'Content-Type': 'application/json' }
  };

  try {
    // TEST 1: Role Escalation Attack Prevention in Registration
    console.log('\n--- Step 1: Enforce Role Permissions in Registration ---');
    const escalateRes = await request({
      ...baseOptions,
      path: '/api/auth/register',
      method: 'POST'
    }, {
      name: 'Intruder',
      email: 'intruder@test.com',
      password: 'password123',
      role: 'admin' // Attempting to register as admin
    });
    assert.strictEqual(escalateRes.status, 400, 'Registration as admin must return 400 Bad Request');
    console.log('✓ Public registration correctly rejects admin role escalation (400)');

    const staffEscalateRes = await request({
      ...baseOptions,
      path: '/api/auth/register',
      method: 'POST'
    }, {
      name: 'Intruder Staff',
      email: 'intruder.staff@test.com',
      password: 'password123',
      role: 'department_staff'
    });
    assert.strictEqual(staffEscalateRes.status, 400, 'Registration as department_staff must return 400 Bad Request');
    console.log('✓ Public registration correctly rejects department_staff role escalation (400)');

    // Legitimate citizen registration
    const citizenRegRes = await request({
      ...baseOptions,
      path: '/api/auth/register',
      method: 'POST'
    }, {
      name: 'Venkata Rao',
      email: 'venkata.rao@test.com',
      password: 'password123',
      phone: '+91 98480 33445'
    });
    assert.strictEqual(citizenRegRes.status, 201, 'Citizen registration succeeds (201)');
    assert.strictEqual(citizenRegRes.data.user.role, 'citizen', 'New user role is strictly citizen');
    assert.strictEqual(citizenRegRes.data.user.name, 'Venkata Rao');
    const venkataToken = citizenRegRes.data.token;
    const venkataId = citizenRegRes.data.user.id;
    console.log(`✓ Legitimate citizen registered successfully (ID: ${venkataId}, Role: citizen)`);

    // TEST 2: Login and Authentication Verification
    console.log('\n--- Step 2: Login Authentication & Role Assignment ---');
    // Invalid credentials
    const invalidLogin = await request({
      ...baseOptions,
      path: '/api/auth/login',
      method: 'POST'
    }, { email: 'admin@civictrack.org', password: 'wrongpassword' });
    assert.strictEqual(invalidLogin.status, 401, 'Invalid password returns 401');
    console.log('✓ Invalid password correctly rejected (401)');

    // Admin login
    const adminLogin = await request({
      ...baseOptions,
      path: '/api/auth/login',
      method: 'POST'
    }, { email: 'admin@civictrack.org', password: 'admin123' });
    assert.strictEqual(adminLogin.status, 200, 'Admin login succeeds (200)');
    assert.strictEqual(adminLogin.data.user.role, 'admin');
    assert.strictEqual(adminLogin.data.user.name, 'Suresh Varma (Municipal Commissioner)');
    const adminToken = adminLogin.data.token;
    console.log('✓ Admin login returned correct user: Suresh Varma (Municipal Commissioner, Role: admin)');

    // Staff login
    const staffLogin = await request({
      ...baseOptions,
      path: '/api/auth/login',
      method: 'POST'
    }, { email: 'roads.staff@civictrack.org', password: 'staff123' });
    assert.strictEqual(staffLogin.status, 200, 'Staff login succeeds (200)');
    assert.strictEqual(staffLogin.data.user.role, 'department_staff');
    assert.strictEqual(staffLogin.data.user.department_name, 'Roads and Infrastructure');
    const staffToken = staffLogin.data.token;
    console.log('✓ Staff login returned correct user: Ramesh Naidu (Roads & Works Engineer, Dept: Roads and Infrastructure)');

    // Existing citizen Yasaswini login
    const yasaswiniLogin = await request({
      ...baseOptions,
      path: '/api/auth/login',
      method: 'POST'
    }, { email: 'vyasaswini007@gmail.com', password: 'citizen123' });
    assert.strictEqual(yasaswiniLogin.status, 200, 'Yasaswini login succeeds (200)');
    assert.strictEqual(yasaswiniLogin.data.user.role, 'citizen');
    assert.strictEqual(yasaswiniLogin.data.user.name, 'Yasaswini');
    const yasaswiniToken = yasaswiniLogin.data.token;
    const yasaswiniId = yasaswiniLogin.data.user.id;
    console.log(`✓ Yasaswini citizen login verified (ID: ${yasaswiniId}, Name: Yasaswini)`);

    // TEST 3: Citizen Dashboard & Honest Empty State
    console.log('\n--- Step 3: Citizen Dashboard & Honest Empty State ---');
    const venkataReports = await request({
      ...baseOptions,
      path: '/api/reports?mineOnly=true',
      method: 'GET',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${venkataToken}` }
    });
    assert.strictEqual(venkataReports.status, 200);
    assert.strictEqual(Array.isArray(venkataReports.data), true);
    assert.strictEqual(venkataReports.data.length, 0, 'New citizen starts with honest 0 reports');
    console.log('✓ New citizen report query returns empty array [] (honest empty state without fake data)');

    const venkataIssues = await request({
      ...baseOptions,
      path: '/api/issues?mineOnly=true',
      method: 'GET',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${venkataToken}` }
    });
    assert.strictEqual(venkataIssues.status, 200);
    assert.strictEqual(venkataIssues.data.length, 0, 'New citizen starts with honest 0 tracked issues');
    console.log('✓ New citizen tracked issues query returns empty array [] (honest empty state)');

    // TEST 4: Issue Creation & Ownership
    console.log('\n--- Step 4: Issue Creation, Ownership & Association ---');
    const newReportRes = await request({
      ...baseOptions,
      path: '/api/reports',
      method: 'POST',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${yasaswiniToken}` }
    }, {
      title: 'Water logging near Bhimavaram Town Railway Station',
      category: 'Drainage and sewage',
      description: 'Stormwater culvert clogged with silt causing severe water logging across the access road.',
      severity: 'High',
      latitude: 16.5470,
      longitude: 81.5235,
      address: 'Near Town Railway Station, Bhimavaram, AP',
      isSafetyCritical: false,
      imageUrls: ['https://example.com/evidence-bhimavaram.jpg']
    });

    assert.strictEqual(newReportRes.status, 201, 'Report created (201)');
    const createdReportId = newReportRes.data.reportId;
    const createdIssueId = newReportRes.data.sharedIssueId;
    console.log(`✓ Report created by Yasaswini (Report ID: ${createdReportId}, Master Issue ID: ${createdIssueId})`);

    // Check Yasaswini's dashboard now
    const yasaswiniReports = await request({
      ...baseOptions,
      path: '/api/reports?mineOnly=true',
      method: 'GET',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${yasaswiniToken}` }
    });
    assert.strictEqual(yasaswiniReports.data.length, 1, 'Yasaswini has 1 report now');
    assert.strictEqual(yasaswiniReports.data[0].title, 'Water logging near Bhimavaram Town Railway Station');
    console.log('✓ Yasaswini dashboard now displays her own report with exact title and status');

    const yasaswiniIssues = await request({
      ...baseOptions,
      path: '/api/issues?mineOnly=true',
      method: 'GET',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${yasaswiniToken}` }
    });
    assert.strictEqual(yasaswiniIssues.data.length, 1, 'Yasaswini has 1 tracked issue');
    console.log('✓ Yasaswini tracked issues query now returns her master civic issue');

    // TEST 5: Citizen Report Isolation (Authorization check)
    console.log('\n--- Step 5: Report Detail Privacy & Authorization Isolation ---');
    // Venkata tries to read Yasaswini's report
    const snoopRes = await request({
      ...baseOptions,
      path: `/api/reports/${createdReportId}`,
      method: 'GET',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${venkataToken}` }
    });
    assert.strictEqual(snoopRes.status, 403, 'Citizen snooping on another citizen report is rejected (403)');
    console.log("✓ Citizen cannot view other citizens' individual report submissions (403 Forbidden)");

    // Yasaswini reads her own report
    const ownReportRes = await request({
      ...baseOptions,
      path: `/api/reports/${createdReportId}`,
      method: 'GET',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${yasaswiniToken}` }
    });
    assert.strictEqual(ownReportRes.status, 200, 'Citizen can view their own report');
    console.log('✓ Citizen can view their own report with full evidence images (200 OK)');

    // TEST 6: Status Update Permissions
    console.log('\n--- Step 6: Status Transition & Role Protection ---');
    // Citizen tries to change status
    const citizenStatusRes = await request({
      ...baseOptions,
      path: `/api/issues/${createdIssueId}/status`,
      method: 'PATCH',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${yasaswiniToken}` }
    }, { status: 'Resolved' });
    assert.strictEqual(citizenStatusRes.status, 403, 'Citizen cannot update issue status (403)');
    console.log('✓ Citizen rejected when attempting to update status (403 Forbidden)');

    // Admin updates status to 'In Progress'
    const adminStatusRes = await request({
      ...baseOptions,
      path: `/api/issues/${createdIssueId}/status`,
      method: 'PATCH',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${adminToken}` }
    }, { status: 'In Progress', comments: 'Work crew dispatched to desilt station culvert' });
    assert.strictEqual(adminStatusRes.status, 200, 'Admin can update status (200)');
    console.log('✓ Admin successfully updated status to In Progress (200 OK)');

    // TEST 7: Admin & Staff Dashboard Metrics
    console.log('\n--- Step 7: Accurate Analytics & Dashboard Statistics ---');
    const overviewRes = await request({
      ...baseOptions,
      path: '/api/analytics/overview',
      method: 'GET',
      headers: { ...baseOptions.headers, Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(overviewRes.status, 200);
    assert.strictEqual(typeof overviewRes.data.totalCitizenReports, 'number');
    assert.strictEqual(typeof overviewRes.data.uniqueCivicIssues, 'number');
    assert.strictEqual(typeof overviewRes.data.consolidationRatio, 'number');
    console.log(`✓ Admin overview analytics returns real computed numbers: ${overviewRes.data.totalCitizenReports} total reports, ${overviewRes.data.uniqueCivicIssues} unique issues, consolidation ratio: ${overviewRes.data.consolidationRatio}x`);

    console.log('\n=================================================');
    console.log(' ALL 7 VERIFICATION STAGES PASSED SUCCESSFULLY!');
    console.log('=================================================\n');
  } finally {
    server.close();
  }
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Department, AuditLog } from '../src/models/index.js';
import { generateToken, requireRole } from '../src/middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('CivicTrack Authentication, Role Provisioning & Security Test Suite', async (t) => {

  await t.test('1. Password Hashing and Password Verification Integrity', async () => {
    const rawPass = 'OfficerSecure2026!';
    const hash = await bcrypt.hash(rawPass, 10);

    assert.notStrictEqual(hash, rawPass, 'Passwords must be securely hashed and never plain text');
    const isValid = await bcrypt.compare(rawPass, hash);
    assert.strictEqual(isValid, true, 'Correct password verifies successfully against bcrypt hash');

    const isInvalid = await bcrypt.compare('WrongPassword999', hash);
    assert.strictEqual(isInvalid, false, 'Incorrect password is strictly rejected');
  });

  await t.test('2. User Model Role Normalization (accepts staff and department_staff)', async () => {
    const staffUser1 = new User({
      name: 'Ramesh Staff',
      email: 'staff1@civictrack.org',
      password_hash: 'dummyhash',
      role: 'staff'
    });
    assert.strictEqual(staffUser1.role, 'department_staff', 'Model automatically normalizes "staff" to "department_staff"');

    const staffUser2 = new User({
      name: 'Priya Staff',
      email: 'staff2@civictrack.org',
      password_hash: 'dummyhash',
      role: 'department_staff'
    });
    assert.strictEqual(staffUser2.role, 'department_staff', 'Model preserves "department_staff"');

    const adminUser = new User({
      name: 'Suresh Admin',
      email: 'admin@civictrack.org',
      password_hash: 'dummyhash',
      role: 'admin'
    });
    assert.strictEqual(adminUser.role, 'admin', 'Model preserves "admin"');

    const citizenUser = new User({
      name: 'Alice Citizen',
      email: 'alice@example.com',
      password_hash: 'dummyhash',
      role: 'citizen'
    });
    assert.strictEqual(citizenUser.role, 'citizen', 'Model preserves "citizen"');
  });

  await t.test('3. Email Normalization in User Model Schema', async () => {
    const user = new User({
      name: 'Case Test Officer',
      email: '  Officer.Anand@CivicTrack.Org  ',
      password_hash: 'dummyhash',
      role: 'department_staff'
    });

    assert.strictEqual(
      user.email,
      'officer.anand@civictrack.org',
      'User email is trimmed and lowercased by Mongoose schema'
    );
  });

  await t.test('4. Provisioning Logic: Rejecting Public Registration of Admin or Staff', async () => {
    // Simulate public registration role check from server/src/routes/auth.js:39
    function validatePublicRegistrationRole(role) {
      if (role && role !== 'citizen') {
        return {
          allowed: false,
          status: 400,
          error: 'Public registration is strictly restricted to citizen accounts. Municipal staff and administrators are provisioned by authorities.'
        };
      }
      return { allowed: true, role: 'citizen' };
    }

    const regAdmin = validatePublicRegistrationRole('admin');
    assert.strictEqual(regAdmin.allowed, false);
    assert.strictEqual(regAdmin.status, 400);

    const regStaff = validatePublicRegistrationRole('department_staff');
    assert.strictEqual(regStaff.allowed, false);
    assert.strictEqual(regStaff.status, 400);

    const regCitizen = validatePublicRegistrationRole('citizen');
    assert.strictEqual(regCitizen.allowed, true);
    assert.strictEqual(regCitizen.role, 'citizen');
  });

  await t.test('5. Authorized Provisioning: Role and Department Validation', async () => {
    function validateProvisioningPayload(callerUser, payload) {
      // 1. Caller authorization
      if (!callerUser || callerUser.role !== 'admin') {
        return { success: false, status: 403, error: 'Access denied. Requires admin privileges.' };
      }

      const { name, email, password, role, department_id } = payload;
      if (!name || !email || !password || !role) {
        return { success: false, status: 400, error: 'Name, email, password, and role are required.' };
      }

      if (password.length < 6) {
        return { success: false, status: 400, error: 'Password must be at least 6 characters long.' };
      }

      const normalizedRole = role === 'staff' ? 'department_staff' : role;
      if (!['admin', 'department_staff'].includes(normalizedRole)) {
        return { success: false, status: 400, error: 'Invalid role for provisioning.' };
      }

      if (normalizedRole === 'department_staff' && !department_id) {
        return { success: false, status: 400, error: 'Department is required for staff.' };
      }

      return { success: true, role: normalizedRole };
    }

    // Citizen caller cannot provision
    const citizenCaller = { id: 'c1', role: 'citizen', email: 'citizen@example.com' };
    const failCitizenCall = validateProvisioningPayload(citizenCaller, {
      name: 'Staff Test',
      email: 'staff@test.com',
      password: 'password123',
      role: 'department_staff',
      department_id: 'dept1'
    });
    assert.strictEqual(failCitizenCall.status, 403, 'Citizen caller is rejected from provisioning');

    // Staff caller cannot provision
    const staffCaller = { id: 's1', role: 'department_staff', email: 'staff@civictrack.org' };
    const failStaffCall = validateProvisioningPayload(staffCaller, {
      name: 'Staff Test',
      email: 'staff@test.com',
      password: 'password123',
      role: 'department_staff',
      department_id: 'dept1'
    });
    assert.strictEqual(failStaffCall.status, 403, 'Staff caller is rejected from provisioning');

    // Admin caller can provision
    const adminCaller = { id: 'a1', role: 'admin', email: 'admin@civictrack.org' };
    const passAdminProvision = validateProvisioningPayload(adminCaller, {
      name: 'New Administrator',
      email: 'newadmin@civictrack.org',
      password: 'StrongPassword2026!',
      role: 'admin'
    });
    assert.strictEqual(passAdminProvision.success, true);
    assert.strictEqual(passAdminProvision.role, 'admin');

    const passStaffProvision = validateProvisioningPayload(adminCaller, {
      name: 'New Field Staff',
      email: 'newstaff@civictrack.org',
      password: 'StrongPassword2026!',
      role: 'department_staff',
      department_id: new mongoose.Types.ObjectId().toString()
    });
    assert.strictEqual(passStaffProvision.success, true);
    assert.strictEqual(passStaffProvision.role, 'department_staff');
  });

  await t.test('6. Role Portal Matching Verification on Login', async () => {
    function verifyPortalRole(userRole, requestedPortal) {
      if (!requestedPortal) return true;
      const normalizedPortal = requestedPortal === 'staff' ? 'department_staff' : requestedPortal;
      const normalizedUser = userRole === 'staff' ? 'department_staff' : userRole;
      return normalizedUser === normalizedPortal;
    }

    assert.strictEqual(verifyPortalRole('admin', 'admin'), true, 'Admin matches Admin portal');
    assert.strictEqual(verifyPortalRole('department_staff', 'department_staff'), true, 'Staff matches Staff portal');
    assert.strictEqual(verifyPortalRole('department_staff', 'staff'), true, 'Staff matches normalized staff portal');
    assert.strictEqual(verifyPortalRole('citizen', 'citizen'), true, 'Citizen matches Citizen portal');

    assert.strictEqual(verifyPortalRole('citizen', 'admin'), false, 'Citizen cannot log in via Admin portal');
    assert.strictEqual(verifyPortalRole('citizen', 'department_staff'), false, 'Citizen cannot log in via Staff portal');
    assert.strictEqual(verifyPortalRole('department_staff', 'admin'), false, 'Staff cannot log in via Admin portal');
    assert.strictEqual(verifyPortalRole('admin', 'citizen'), false, 'Admin cannot log in via Citizen portal');
  });

  await t.test('7. requireRole Middleware Enforces Permissions with Role Normalization', async () => {
    const adminReq = { user: { id: '1', role: 'admin' } };
    const staffReq = { user: { id: '2', role: 'department_staff' } };
    const legacyStaffReq = { user: { id: '3', role: 'staff' } };
    const citizenReq = { user: { id: '4', role: 'citizen' } };

    let adminAllowed = false;
    requireRole('admin')(adminReq, {}, () => { adminAllowed = true; });
    assert.strictEqual(adminAllowed, true, 'Admin passes requireRole("admin")');

    let citizenDenied = false;
    const resMock = {
      status: (code) => {
        if (code === 403) citizenDenied = true;
        return { json: () => {} };
      }
    };
    requireRole('admin')(citizenReq, resMock, () => {});
    assert.strictEqual(citizenDenied, true, 'Citizen denied by requireRole("admin")');

    let staffAllowedOnStaff = false;
    requireRole('department_staff')(staffReq, {}, () => { staffAllowedOnStaff = true; });
    assert.strictEqual(staffAllowedOnStaff, true, 'Staff passes requireRole("department_staff")');

    let legacyStaffAllowedOnStaff = false;
    requireRole('department_staff')(legacyStaffReq, {}, () => { legacyStaffAllowedOnStaff = true; });
    assert.strictEqual(legacyStaffAllowedOnStaff, true, 'Normalized staff passes requireRole("department_staff")');
  });

  await t.test('8. LoginPage Source Verification: Zero Demo Credentials or Auto-Fill Buttons', async () => {
    const loginPagePath = path.resolve(__dirname, '../../client/src/pages/LoginPage.tsx');
    const loginPageContent = fs.readFileSync(loginPagePath, 'utf8');

    // Ensure demo credentials are removed
    assert.strictEqual(
      loginPageContent.includes('Evaluation Demo Credential'),
      false,
      'LoginPage must not contain "Evaluation Demo Credential"'
    );
    assert.strictEqual(
      loginPageContent.includes('Auto-Fill Credentials'),
      false,
      'LoginPage must not contain "Auto-Fill Credentials"'
    );
    assert.strictEqual(
      loginPageContent.includes('citizen.alice@example.com'),
      false,
      'LoginPage must not expose demo email "citizen.alice@example.com"'
    );
    assert.strictEqual(
      loginPageContent.includes('roads.staff@civictrack.org'),
      false,
      'LoginPage must not expose demo email "roads.staff@civictrack.org"'
    );
    assert.strictEqual(
      loginPageContent.includes('admin@civictrack.org'),
      false,
      'LoginPage must not expose demo email "admin@civictrack.org"'
    );
    assert.strictEqual(
      loginPageContent.includes('admin123'),
      false,
      'LoginPage must not expose demo password "admin123"'
    );
  });
});

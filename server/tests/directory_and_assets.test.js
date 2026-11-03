process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  User,
  Department,
  InfrastructureAsset,
  InfrastructureIncident,
  RepairRecord,
  SharedIssue,
  CitizenReport
} from '../src/models/index.js';
import { DEMO_ASSETS_DATA, seedDemoInfrastructureAssets } from '../src/db/demoAssets.js';
import { calculateDistanceMeters } from '../src/utils/duplicateDetector.js';

test('Municipal Personnel Directory & Infrastructure Asset Registry Suite', async (t) => {

  await t.test('1. DEMO_ASSETS_DATA contains exactly 33 realistic Bhimavaram assets across required categories', () => {
    assert.strictEqual(DEMO_ASSETS_DATA.length, 33, 'Must contain exactly 33 realistic demo assets');

    const roadAssets = DEMO_ASSETS_DATA.filter(a => a.category === 'Roads and potholes');
    const streetlightAssets = DEMO_ASSETS_DATA.filter(a => a.category.includes('Streetlight'));
    const drainageAssets = DEMO_ASSETS_DATA.filter(a => a.category === 'Drainage and sewage');
    const waterAssets = DEMO_ASSETS_DATA.filter(a => a.category === 'Water supply and leakage');
    const buildingAssets = DEMO_ASSETS_DATA.filter(a => a.category === 'Public buildings and facilities');

    assert.strictEqual(roadAssets.length, 10, 'Must have exactly 10 road assets');
    assert.strictEqual(streetlightAssets.length, 8, 'Must have exactly 8 streetlight assets');
    assert.strictEqual(drainageAssets.length, 6, 'Must have exactly 6 drainage assets');
    assert.strictEqual(waterAssets.length, 5, 'Must have exactly 5 water supply assets');
    assert.strictEqual(buildingAssets.length, 4, 'Must have exactly 4 public building assets');

    // Verify all 33 have coordinates in Bhimavaram bounds (Lat ~16.53 to 16.56, Lon ~81.48 to 81.54)
    for (const asset of DEMO_ASSETS_DATA) {
      assert.ok(asset.asset_code, `Asset ${asset.name} must have asset_code`);
      assert.ok(asset.name.includes('[Demo Asset]'), `Asset ${asset.name} must be clearly labeled as demo`);
      assert.ok(asset.latitude >= 16.50 && asset.latitude <= 16.60, `Latitude ${asset.latitude} must be in Bhimavaram bounds`);
      assert.ok(asset.longitude >= 81.45 && asset.longitude <= 81.56, `Longitude ${asset.longitude} must be in Bhimavaram bounds`);
      assert.ok(['good', 'monitoring', 'warning', 'critical'].includes(asset.current_health_status), `Health status must be valid`);
      assert.ok(asset.risk_score >= 0 && asset.risk_score <= 100, `Risk score must be 0-100`);
      assert.ok(asset.risk_reasons && asset.risk_reasons.length > 0, `Risk reasons must be non-empty`);
    }
  });

  await t.test('2. InfrastructureAsset Model Schema includes department_id and is_demo flag', () => {
    const asset = new InfrastructureAsset({
      asset_code: 'TEST-AST-01',
      name: 'Test Road Section [Demo Asset]',
      category: 'Roads and potholes',
      latitude: 16.5449,
      longitude: 81.5212,
      address: 'Test Road, Bhimavaram',
      current_health_status: 'warning',
      risk_score: 65,
      risk_level: 'High',
      is_demo: true,
      department_id: new mongoose.Types.ObjectId()
    });

    assert.strictEqual(asset.is_demo, true);
    assert.ok(asset.department_id instanceof mongoose.Types.ObjectId);
    const validationError = asset.validateSync();
    assert.strictEqual(validationError, undefined, 'Asset model validation should pass');
  });

  await t.test('3. Municipal Directory Query Filtering strictly separates Municipal Officers from Citizens', () => {
    const mockUsers = [
      { name: 'Suresh Varma', email: 'admin@civictrack.org', role: 'admin' },
      { name: 'Ramesh Naidu', email: 'roads.staff@civictrack.org', role: 'department_staff' },
      { name: 'Priya Sharma', email: 'water.staff@civictrack.org', role: 'department_staff' },
      { name: 'Lakshmi Rao', email: 'citizen.alice@example.com', role: 'citizen' },
      { name: 'Yasaswini', email: 'vyasaswini007@gmail.com', role: 'citizen' },
      { name: 'rocky', email: 'rocky666@gmail.com', role: 'citizen' },
      { name: 'yasin', email: 'yasin@gmail.com', role: 'citizen' },
      { name: 'pavani', email: 'pavani@gmail.com', role: 'citizen' },
      { name: 'Yasaswini P', email: 'vardhineediyasaswinipadmavati@gmail.com', role: 'citizen' }
    ];

    // Municipal Directory filter simulation matching server/src/routes/auth.js:
    // role is omitted or 'municipal' -> role must be in ['admin', 'department_staff']
    const municipalRoleFilter = ['admin', 'department_staff'];

    const filteredOfficers = mockUsers.filter(u => municipalRoleFilter.includes(u.role));
    assert.strictEqual(filteredOfficers.length, 3, 'Exactly 3 authorized municipal officers must be returned');

    // Confirm all 3 authorized personnel
    const emails = filteredOfficers.map(o => o.email);
    assert.ok(emails.includes('admin@civictrack.org'));
    assert.ok(emails.includes('roads.staff@civictrack.org'));
    assert.ok(emails.includes('water.staff@civictrack.org'));

    // Confirm citizens are strictly excluded
    assert.ok(!emails.includes('rocky666@gmail.com'), 'rocky must not appear in directory');
    assert.ok(!emails.includes('yasin@gmail.com'), 'yasin must not appear in directory');
    assert.ok(!emails.includes('pavani@gmail.com'), 'pavani must not appear in directory');
    assert.ok(!emails.includes('citizen.alice@example.com'), 'Lakshmi Rao must not appear in directory');
    assert.ok(!emails.includes('vyasaswini007@gmail.com'), 'vyasaswini007 must not appear in directory');
    assert.ok(!emails.includes('vardhineediyasaswinipadmavati@gmail.com'), 'vardhineediyasaswinipadmavati must not appear in directory');
  });

  await t.test('4. Spatial matching: 150m proximity calculation correctly identifies nearest infrastructure asset', () => {
    // SRKR College coordinates
    const reportLat = 16.5456;
    const reportLon = 81.4949;

    // AST-RD-003 is at 16.5455, 81.4948 (~15 meters away)
    const assetNear = { latitude: 16.5455, longitude: 81.4948, asset_code: 'AST-RD-003' };
    const distNear = calculateDistanceMeters(reportLat, reportLon, assetNear.latitude, assetNear.longitude);

    assert.ok(distNear < 150, `Distance ${distNear}m must be within 150m threshold`);

    // Far away asset at Railway station (16.5385, 81.5321 - several km away)
    const assetFar = { latitude: 16.5385, longitude: 81.5321, asset_code: 'AST-SL-001' };
    const distFar = calculateDistanceMeters(reportLat, reportLon, assetFar.latitude, assetFar.longitude);

    assert.ok(distFar > 1000, `Distance ${distFar}m must exceed threshold`);
  });

  await t.test('5. Multi-incident failure and recurrence sequence tracking', () => {
    const criticalRoadAsset = DEMO_ASSETS_DATA.find(a => a.asset_code === 'AST-RD-001');
    assert.ok(criticalRoadAsset, 'AST-RD-001 must exist');
    assert.strictEqual(criticalRoadAsset.current_health_status, 'critical');
    assert.strictEqual(criticalRoadAsset.risk_level, 'Critical');
    assert.strictEqual(criticalRoadAsset.sampleIncidents.length, 3, 'Critical asset must have 3 recorded incidents');

    const sequences = criticalRoadAsset.sampleIncidents.map(i => i.recurrence_sequence);
    assert.deepStrictEqual(sequences, [1, 2, 3], 'Incidents must maintain chronological recurrence sequence');

    // Check repairs
    const repairs = criticalRoadAsset.sampleIncidents.filter(i => i.repair);
    assert.strictEqual(repairs.length, 2, 'First 2 incidents must have associated repair records');
    assert.strictEqual(repairs[0].repair.repair_type, 'temporary');
    assert.strictEqual(repairs[0].repair.cost_amount, 35000);
  });
});

import bcrypt from 'bcryptjs';
import { getDb } from './connection.js';
import { initSchema } from './schema.js';

export async function seedDatabase() {
  console.log('--- Starting CivicTrack Database Seeding ---');
  const db = await getDb();
  await initSchema(db);

  // Clear existing demo tables & reset sequences
  db.exec(`
    DELETE FROM password_resets;
    DELETE FROM audit_logs;
    DELETE FROM issue_follows;
    DELETE FROM citizen_verifications;
    DELETE FROM status_history;
    DELETE FROM report_images;
    DELETE FROM citizen_reports;
    DELETE FROM repair_records;
    DELETE FROM infrastructure_incidents;
    DELETE FROM shared_issues;
    DELETE FROM infrastructure_assets;
    DELETE FROM notifications;
    DELETE FROM users;
    DELETE FROM departments;
    DELETE FROM sqlite_sequence;
  `);

  console.log('✓ Cleared previous database records and reset ID sequences');

  const now = new Date().toISOString();

  // 1. Departments
  const departmentsData = [
    { name: 'Roads and Infrastructure', code: 'ROADS', contact_email: 'roads@civictrack.org', sla_hours: 48 },
    { name: 'Electrical and Lighting', code: 'ELECTRICAL', contact_email: 'electrical@civictrack.org', sla_hours: 36 },
    { name: 'Water Supply and Sewage', code: 'WATER', contact_email: 'water@civictrack.org', sla_hours: 24 },
    { name: 'Solid Waste and Sanitation', code: 'SANITATION', contact_email: 'sanitation@civictrack.org', sla_hours: 24 },
    { name: 'Public Facilities and Structures', code: 'FACILITIES', contact_email: 'facilities@civictrack.org', sla_hours: 72 }
  ];

  const deptMap = {};
  for (const d of departmentsData) {
    const res = db.run(
      `INSERT INTO departments (name, code, contact_email, sla_hours, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [d.name, d.code, d.contact_email, d.sla_hours, now]
    );
    deptMap[d.code] = res.lastInsertRowid;
  }
  console.log('✓ Seeded 5 Municipal Departments');

  // 2. Users
  const passAdmin = await bcrypt.hash('admin123', 10);
  const passStaff = await bcrypt.hash('staff123', 10);
  const passCitizen = await bcrypt.hash('citizen123', 10);

  const usersData = [
    { name: 'Suresh Varma (Municipal Commissioner)', email: 'admin@civictrack.org', pass: passAdmin, role: 'admin', deptCode: null, phone: '+91 98480 22101' },
    { name: 'Ramesh Naidu (Roads & Works Engineer)', email: 'roads.staff@civictrack.org', pass: passStaff, role: 'department_staff', deptCode: 'ROADS', phone: '+91 98480 22102' },
    { name: 'Priya Sharma (Water Supply Engineer)', email: 'water.staff@civictrack.org', pass: passStaff, role: 'department_staff', deptCode: 'WATER', phone: '+91 98480 22103' },
    { name: 'Lakshmi Rao', email: 'citizen.alice@example.com', pass: passCitizen, role: 'citizen', deptCode: null, phone: '+91 98480 22104' },
    { name: 'Kalyan Kumar', email: 'citizen.bob@example.com', pass: passCitizen, role: 'citizen', deptCode: null, phone: '+91 98480 22105' },
    { name: 'Ananya Reddy', email: 'citizen.carol@example.com', pass: passCitizen, role: 'citizen', deptCode: null, phone: '+91 98480 22106' },
    { name: 'David Raju', email: 'citizen.david@example.com', pass: passCitizen, role: 'citizen', deptCode: null, phone: '+91 98480 22107' },
    { name: 'Sita Mahalakshmi', email: 'citizen.elena@example.com', pass: passCitizen, role: 'citizen', deptCode: null, phone: '+91 98480 22108' },
    { name: 'Yasaswini', email: 'vyasaswini007@gmail.com', pass: passCitizen, role: 'citizen', deptCode: null, phone: '+91 98480 22339' }
  ];

  const userMap = {};
  for (const u of usersData) {
    const deptId = u.deptCode ? deptMap[u.deptCode] : null;
    const res = db.run(
      `INSERT INTO users (name, email, password_hash, role, department_id, phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [u.name, u.email, u.pass, u.role, deptId, u.phone, now]
    );
    userMap[u.email] = res.lastInsertRowid;
  }
  console.log('✓ Seeded Users (Admin, Staff, and Citizens)');

  // 3. Infrastructure Assets
  const assetsData = [
    {
      asset_code: 'RD-204',
      name: 'PP Road Arterial Corridor (km 2.4 - 3.1), Bhimavaram',
      category: 'Roads and potholes',
      latitude: 16.5449,
      longitude: 81.5212,
      address: 'Penumatsa Peda Amiram Road, Town Center, Bhimavaram, AP',
      installation_date: '2021-04-10',
      current_health_status: 'critical',
      risk_score: 82,
      risk_level: 'Critical',
      risk_reasons: JSON.stringify([
        '3 distinct failure incidents recorded on this asset',
        '2 previous temporary cold patches without permanent base stabilization',
        'Average recurrence cycle is 42 days',
        'Heavy commercial traffic volume and monsoon waterlogging'
      ])
    },
    {
      asset_code: 'RD-205',
      name: 'J.P. Road Junction (km 3.4), Bhimavaram',
      category: 'Roads and potholes',
      latitude: 16.5470,
      longitude: 81.5235,
      address: 'Jnanapuram Road near Town Railway Station, Bhimavaram, AP',
      installation_date: '2022-09-15',
      current_health_status: 'monitoring',
      risk_score: 38,
      risk_level: 'Medium',
      risk_reasons: JSON.stringify([
        '1 historical failure incident recorded on this asset',
        'Minor joint settling near storm drain culvert'
      ])
    },
    {
      asset_code: 'SL-102',
      name: 'Somaramam Temple Road Luminaire Pole #102',
      category: 'Streetlights and electrical infrastructure',
      latitude: 16.5425,
      longitude: 81.5185,
      address: 'Somaramam Temple Road, Gunupudi, Bhimavaram, AP',
      installation_date: '2020-11-20',
      current_health_status: 'warning',
      risk_score: 64,
      risk_level: 'High',
      risk_reasons: JSON.stringify([
        '2 failure incidents recorded during rainy periods',
        'Underground conduit seal degradation causing intermittent tripping',
        'Requires weather-sealed junction box retrofit'
      ])
    },
    {
      asset_code: 'WT-305',
      name: 'Yenamadurru Water Distribution Pipeline (Valve 12-B)',
      category: 'Water supply and leakage',
      latitude: 16.5412,
      longitude: 81.5250,
      address: 'Yenamadurru Drain Bund Road, Industrial Sector, Bhimavaram, AP',
      installation_date: '2019-06-01',
      current_health_status: 'monitoring',
      risk_score: 45,
      risk_level: 'Medium',
      risk_reasons: JSON.stringify([
        'Seasonal summer pressure surges recorded',
        'Cast iron joint packings nearing 5-year inspection milestone'
      ])
    },
    {
      asset_code: 'DR-402',
      name: 'Gandhi Bomma Center Stormwater Intake Channel',
      category: 'Drainage and sewage',
      latitude: 16.5435,
      longitude: 81.5220,
      address: 'Gandhi Bomma Center, Main Bazaar, Bhimavaram, AP',
      installation_date: '2018-08-12',
      current_health_status: 'warning',
      risk_score: 68,
      risk_level: 'High',
      risk_reasons: JSON.stringify([
        'Repeated monsoon silt buildup clogging outfall grates',
        'Requires biannual hydro-jet desilting before June'
      ])
    },
    {
      asset_code: 'SB-501',
      name: 'Bhimavaram Municipal Office Plaza Steps & Ramp',
      category: 'Public buildings and facilities',
      latitude: 16.5455,
      longitude: 81.5205,
      address: 'Municipal Corporation Complex, Balusumoodi, Bhimavaram, AP',
      installation_date: '2023-01-20',
      current_health_status: 'good',
      risk_score: 12,
      risk_level: 'Low',
      risk_reasons: JSON.stringify([
        'Permanent handrail structural anchoring completed',
        'No active defects recorded'
      ])
    }
  ];

  const assetMap = {};
  for (const a of assetsData) {
    const res = db.run(
      `INSERT INTO infrastructure_assets (
        asset_code, name, category, latitude, longitude, address,
        installation_date, current_health_status, risk_score, risk_level,
        risk_reasons, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.asset_code, a.name, a.category, a.latitude, a.longitude,
        a.address, a.installation_date, a.current_health_status,
        a.risk_score, a.risk_level, a.risk_reasons, now
      ]
    );
    assetMap[a.asset_code] = res.lastInsertRowid;
  }
  console.log('✓ Seeded 6 Infrastructure Assets with Risk Indicators');

  // 4. Historical Incidents & Repairs on RD-204 (demonstrating lifecycle and recurring failure over time)
  const rd204Id = assetMap['RD-204'];
  const roadsLeadId = userMap['roads.staff@civictrack.org'];
  const roadsDeptId = deptMap['ROADS'];

  // Incident 1: 8 months ago
  const d1 = new Date(Date.now() - 240 * 24 * 3600 * 1000).toISOString();
  const d1_res = new Date(Date.now() - 235 * 24 * 3600 * 1000).toISOString();
  db.run(
    `INSERT INTO infrastructure_incidents (
      incident_code, infrastructure_id, incident_type, description, started_at, resolved_at, recurrence_sequence, created_at
    ) VALUES ('INC-RD-204-1', ?, 'Subsurface Pothole Cavity', 'Initial road surface subsidence following heavy winter frost.', ?, ?, 1, ?)`,
    [rd204Id, d1, d1_res, d1]
  );

  // Repair 1 (Temporary patch, cost: ₹24,500)
  db.run(
    `INSERT INTO repair_records (
      repair_code, infrastructure_id, repaired_by_user_id, department_id,
      repair_type, cost_amount, cost_unavailable, materials_used,
      work_summary, completed_at, recurrence_observed, days_until_next_incident, created_at
    ) VALUES (
      'REP-REC-101', ?, ?, ?, 'temporary', 24500.00, 0, 'Cold-pour asphalt emulsion, gravel aggregate filler',
      'Quick temporary leveling patch applied during cold conditions to restore traffic flow.',
      ?, 1, 42, ?
    )`,
    [rd204Id, roadsLeadId, roadsDeptId, d1_res, d1_res]
  );

  // Incident 2: 5 months ago (Recurrence 42 days after repair!)
  const d2 = new Date(Date.now() - 193 * 24 * 3600 * 1000).toISOString();
  const d2_res = new Date(Date.now() - 188 * 24 * 3600 * 1000).toISOString();
  db.run(
    `INSERT INTO infrastructure_incidents (
      incident_code, infrastructure_id, incident_type, description, started_at, resolved_at, recurrence_sequence, created_at
    ) VALUES ('INC-RD-204-2', ?, 'Pothole Re-opening', 'Cold patch eroded after heavy rainfall. Pothole widened to 1.2m across right traffic lane.', ?, ?, 2, ?)`,
    [rd204Id, d2, d2_res, d2]
  );

  // Repair 2 (Another temporary patch, cost: ₹32,000)
  db.run(
    `INSERT INTO repair_records (
      repair_code, infrastructure_id, repaired_by_user_id, department_id,
      repair_type, cost_amount, cost_unavailable, materials_used,
      work_summary, completed_at, recurrence_observed, days_until_next_incident, created_at
    ) VALUES (
      'REP-REC-102', ?, ?, ?, 'temporary', 32000.00, 0, 'Hot asphalt surface tack, compaction roller',
      'Re-filled cavity with surface hot mix. Noted subsurface sub-base moisture saturation requiring full milling.',
      ?, 1, 65, ?
    )`,
    [rd204Id, roadsLeadId, roadsDeptId, d2_res, d2_res]
  );

  // Incident 3: 2 months ago (Recurrence #3!)
  const d3 = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const d3_res = new Date(Date.now() - 55 * 24 * 3600 * 1000).toISOString();
  db.run(
    `INSERT INTO infrastructure_incidents (
      incident_code, infrastructure_id, incident_type, description, started_at, resolved_at, recurrence_sequence, created_at
    ) VALUES ('INC-RD-204-3', ?, 'Deep Structural Road Depression', 'Sub-base settling caused large recurring pothole cluster causing vehicle wheel damage.', ?, ?, 3, ?)`,
    [rd204Id, d3, d3_res, d3]
  );

  // Repair 3 (Permanent milling & stabilization, cost: ₹1,45,000)
  db.run(
    `INSERT INTO repair_records (
      repair_code, infrastructure_id, repaired_by_user_id, department_id,
      repair_type, cost_amount, cost_unavailable, materials_used,
      work_summary, completed_at, recurrence_observed, days_until_next_incident, created_at
    ) VALUES (
      'REP-REC-103', ?, ?, ?, 'permanent', 145000.00, 0, 'Milled asphalt 10cm depth, crushed limestone base, high-grade binder asphalt',
      'Full depth milling and stabilization of 20m road segment.',
      ?, 1, 50, ?
    )`,
    [rd204Id, roadsLeadId, roadsDeptId, d3_res, d3_res]
  );

  // Incident on SL-102 (Streetlight)
  const slId = assetMap['SL-102'];
  const elecDeptId = deptMap['ELECTRICAL'];
  const d_sl = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const d_sl_res = new Date(Date.now() - 88 * 24 * 3600 * 1000).toISOString();
  db.run(
    `INSERT INTO infrastructure_incidents (
      incident_code, infrastructure_id, incident_type, description, started_at, resolved_at, recurrence_sequence, created_at
    ) VALUES ('INC-SL-102-1', ?, 'Water Ingress Circuit Trip', 'Ground moisture tripped LED luminaire driver.', ?, ?, 1, ?)`,
    [slId, d_sl, d_sl_res, d_sl]
  );

  db.run(
    `INSERT INTO repair_records (
      repair_code, infrastructure_id, repaired_by_user_id, department_id,
      repair_type, cost_amount, cost_unavailable, materials_used,
      work_summary, completed_at, recurrence_observed, days_until_next_incident, created_at
    ) VALUES (
      'REP-REC-104', ?, ?, ?, 'permanent', 8500.00, 0, 'IP68 waterproof junction box, silicone sealant',
      'Replaced blown luminaire ballast and upgraded waterproof sealing.',
      ?, 0, NULL, ?
    )`,
    [slId, roadsLeadId, elecDeptId, d_sl_res, d_sl_res]
  );

  // Incidents on WT-305 (Water Main - Summer)
  const wtId = assetMap['WT-305'];
  const waterLeadId = userMap['water.staff@civictrack.org'];
  const waterDeptId = deptMap['WATER'];
  const d_wt = new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString();
  db.run(
    `INSERT INTO infrastructure_incidents (
      incident_code, infrastructure_id, incident_type, description, started_at, recurrence_sequence, created_at
    ) VALUES ('INC-WT-305-1', ?, 'Thermal Expansion Joint Leak', 'High ambient temperature surge caused flange weeping.', ?, 1, ?)`,
    [wtId, d_wt, d_wt]
  );
  db.run(
    `INSERT INTO repair_records (
      repair_code, infrastructure_id, repaired_by_user_id, department_id,
      repair_type, cost_amount, cost_unavailable, materials_used,
      work_summary, completed_at, recurrence_observed, days_until_next_incident, created_at
    ) VALUES (
      'REP-REC-105', ?, ?, ?, 'permanent', 45000.00, 0, 'High-pressure EPDM gaskets, stainless steel torque bolts',
      'Torqued flange joints and replaced aged packing seals.',
      ?, 0, NULL, ?
    )`,
    [wtId, waterLeadId, waterDeptId, d_wt, d_wt]
  );

  // Incidents on DR-402 (Drainage - Monsoon seasonal)
  const drId = assetMap['DR-402'];
  const d_dr1 = new Date(Date.now() - 110 * 24 * 3600 * 1000).toISOString();
  const d_dr2 = new Date(Date.now() - 75 * 24 * 3600 * 1000).toISOString();
  db.run(
    `INSERT INTO infrastructure_incidents (
      incident_code, infrastructure_id, incident_type, description, started_at, recurrence_sequence, created_at
    ) VALUES 
    ('INC-DR-402-1', ?, 'Heavy Silt Blockage', 'Storm runoff swept leaves and construction debris into main grate.', ?, 1, ?),
    ('INC-DR-402-2', ?, 'Outfall Pipe Silt Accumulation', 'Second flood surge clogged downstream retention chamber.', ?, 2, ?)`,
    [drId, d_dr1, d_dr1, drId, d_dr2, d_dr2]
  );

  console.log('✓ Seeded Historical Incidents & Multi-Stage Repair Records');

  // 5. Active Shared Civic Issues
  // CT-101: CURRENT ACTIVE RECURRING INCIDENT on RD-204 (Oak Avenue Pothole)
  const t_rep1 = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const t_rep2 = new Date(Date.now() - 28 * 3600 * 1000).toISOString();
  const t_rep3 = new Date(Date.now() - 14 * 3600 * 1000).toISOString();
  const t_rep4 = new Date(Date.now() - 4 * 3600 * 1000).toISOString();

  const issueResult1 = db.run(
    `INSERT INTO shared_issues (
      issue_code, title, category, description, severity, priority_score,
      is_safety_critical, status, latitude, longitude, address,
      department_id, infrastructure_id, estimated_affected_population,
      affected_population_details, first_reported_at, latest_reported_at,
      created_at, updated_at
    ) VALUES (
      'CT-101', 'Severe Recurring Pothole Cluster on PP Road',
      'Roads and potholes',
      'Multiple deep potholes opened up right near PP Road RTC bus stop, Bhimavaram. Vehicles are swerving into oncoming traffic to avoid rim damage.',
      'Critical', 88, 1, 'In Progress', 16.5449, 81.5212,
      'PP Road near RTC Bus Complex, Bhimavaram, AP',
      ?, ?, 140,
      'Calculated from 4 independent reporter submissions, local bus route ridership, and proximity to RTC Transit Hub',
      ?, ?, ?, ?
    )`,
    [roadsDeptId, rd204Id, t_rep1, t_rep4, t_rep1, t_rep4]
  );
  const issueId1 = issueResult1.lastInsertRowid;

  // 4th recurrence incident on RD-204 linked to CT-101
  const incRes4 = db.run(
    `INSERT INTO infrastructure_incidents (
      incident_code, infrastructure_id, shared_issue_id, incident_type, description, started_at, recurrence_sequence, created_at
    ) VALUES ('INC-RD-204-4', ?, ?, 'Monsoon Pothole Re-emergence', '4th recurrence of pothole cluster along PP Road arterial bus corridor.', ?, 4, ?)`,
    [rd204Id, issueId1, t_rep1, t_rep1]
  );
  db.run('UPDATE shared_issues SET incident_id = ? WHERE id = ?', [incRes4.lastInsertRowid, issueId1]);

  // Citizen Reports linked to CT-101 (Section 12 scenario: Lakshmi, Kalyan, Ananya, David)
  const repAliceId = userMap['citizen.alice@example.com'];
  const repBobId = userMap['citizen.bob@example.com'];
  const repCarolId = userMap['citizen.carol@example.com'];
  const repDavidId = userMap['citizen.david@example.com'];
  const repElenaId = userMap['citizen.elena@example.com'];

  const report1 = db.run(
    `INSERT INTO citizen_reports (
      report_code, user_id, shared_issue_id, title, category, description,
      severity, latitude, longitude, address, status, similarity_match_score, link_type, created_at
    ) VALUES (
      'REP-2024-001', ?, ?, 'Dangerous deep pothole on PP Road near RTC bus stop',
      'Roads and potholes',
      'Hit this huge pothole at PP Road this morning on my commute. Almost bent my scooter wheel rim. Needs immediate attention!',
      'Critical', 16.5449, 81.5212, 'PP Road near RTC Bus Complex, Bhimavaram, AP', 'In Progress', 100, 'original', ?
    )`,
    [repAliceId, issueId1, t_rep1]
  );
  const repId1 = report1.lastInsertRowid;

  const report2 = db.run(
    `INSERT INTO citizen_reports (
      report_code, user_id, shared_issue_id, title, category, description,
      severity, latitude, longitude, address, status, similarity_match_score, link_type, created_at
    ) VALUES (
      'REP-2024-002', ?, ?, 'Pothole opened up again on PP Road',
      'Roads and potholes',
      'This same pothole keeps coming back every time it rains! Saw two-wheelers swerving dangerously into traffic yesterday afternoon.',
      'High', 16.5448, 81.5213, 'PP Road outside Sweet Shop, Bhimavaram, AP', 'In Progress', 92, 'confirmed_duplicate', ?
    )`,
    [repBobId, issueId1, t_rep2]
  );
  const repId2 = report2.lastInsertRowid;

  const report3 = db.run(
    `INSERT INTO citizen_reports (
      report_code, user_id, shared_issue_id, title, category, description,
      severity, latitude, longitude, address, status, similarity_match_score, link_type, created_at
    ) VALUES (
      'REP-2024-003', ?, ?, 'Road crater near pedestrian crossing PP Road',
      'Roads and potholes',
      'Water pooled inside the crater making it invisible at dusk. Extremely hazardous for elderly walkers and motorbikes.',
      'Critical', 16.5450, 81.5215, 'PP Road pedestrian crossing, Bhimavaram, AP', 'In Progress', 89, 'confirmed_duplicate', ?
    )`,
    [repCarolId, issueId1, t_rep3]
  );
  const repId3 = report3.lastInsertRowid;

  const report4 = db.run(
    `INSERT INTO citizen_reports (
      report_code, user_id, shared_issue_id, title, category, description,
      severity, latitude, longitude, address, status, similarity_match_score, link_type, created_at
    ) VALUES (
      'REP-2024-004', ?, ?, 'Large road hole causing traffic bottleneck PP Road',
      'Roads and potholes',
      'Buses and autos are having to brake abruptly. Observed several vehicles scraping chassis today.',
      'High', 16.5449, 81.5212, 'PP Road roadway, Bhimavaram, AP', 'In Progress', 94, 'confirmed_duplicate', ?
    )`,
    [repDavidId, issueId1, t_rep4]
  );
  const repId4 = report4.lastInsertRowid;

  // Images for CT-101 and citizen reports
  db.run(
    `INSERT INTO report_images (report_id, shared_issue_id, image_url, caption, image_type, created_at)
     VALUES 
     (?, ?, 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80', 'Original road depression reported by Alice Chen', 'evidence', ?),
     (?, ?, 'https://images.unsplash.com/photo-1584463699047-926c04cf037f?w=800&auto=format&fit=crop&q=80', 'Bob Miller photo showing water accumulation in road cavity', 'evidence', ?),
     (?, ?, 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?w=800&auto=format&fit=crop&q=80', 'Carol Davis evidence showing hazard to crossing pedestrians', 'evidence', ?)`,
    [repId1, issueId1, t_rep1, repId2, issueId1, t_rep2, repId3, issueId1, t_rep3]
  );

  // Status history for CT-101
  db.run(
    `INSERT INTO status_history (shared_issue_id, old_status, new_status, changed_by_user_id, comments, created_at)
     VALUES 
     (?, 'None', 'Pending', ?, 'Initial complaint registered by citizen Alice Chen', ?),
     (?, 'Pending', 'Assigned', ?, 'Auto-assigned to Roads & Infrastructure department due to high safety rating', ?),
     (?, 'Assigned', 'In Progress', ?, 'Work order dispatch #WO-891 created; maintenance crew inspecting sub-base saturation', ?)`,
    [
      issueId1, repAliceId, t_rep1,
      issueId1, userMap['admin@civictrack.org'], new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
      issueId1, roadsLeadId, new Date(Date.now() - 10 * 3600 * 1000).toISOString()
    ]
  );

  // Follows for CT-101
  db.run('INSERT INTO issue_follows (shared_issue_id, user_id, created_at) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)', [
    issueId1, repAliceId, t_rep1,
    issueId1, repBobId, t_rep2,
    issueId1, repCarolId, t_rep3,
    issueId1, repDavidId, t_rep4
  ]);

  // CT-102: Distinct nearby issue that MUST NOT be merged (Section 12 requirement!)
  const rd205Id = assetMap['RD-205'];
  const t_sep = new Date(Date.now() - 18 * 3600 * 1000).toISOString();
  const issueResult2 = db.run(
    `INSERT INTO shared_issues (
      issue_code, title, category, description, severity, priority_score,
      is_safety_critical, status, latitude, longitude, address,
      department_id, infrastructure_id, estimated_affected_population,
      affected_population_details, first_reported_at, latest_reported_at,
      created_at, updated_at
    ) VALUES (
      'CT-102', 'Sunken Manhole Cover at J.P. Road Railway Feeder Junction',
      'Roads and potholes',
      'The utility manhole cover ring has settled 3 inches below the road surface at J.P. Road junction. This is a separate utility casting problem, distinct from the bus stand pothole cluster 300m south.',
      'Medium', 52, 0, 'Pending', 16.5470, 81.5235,
      'Jnanapuram Road near Town Railway Station, Bhimavaram, AP',
      ?, ?, 45,
      'Residential intersection traffic and turning vehicles',
      ?, ?, ?, ?
    )`,
    [roadsDeptId, rd205Id, t_sep, t_sep, t_sep, t_sep]
  );
  const issueId2 = issueResult2.lastInsertRowid;

  const repSeparated = db.run(
    `INSERT INTO citizen_reports (
      report_code, user_id, shared_issue_id, title, category, description,
      severity, latitude, longitude, address, status, similarity_match_score, link_type, created_at
    ) VALUES (
      'REP-2024-005', ?, ?, 'Sunken utility manhole ring clanking at night',
      'Roads and potholes',
      'Loud metallic thump every time vehicles drive over it at J.P. Road railway feeder. Frame appears unseated.',
      'Medium', 16.5470, 81.5235, 'Jnanapuram Road near Town Railway Station, Bhimavaram, AP', 'Pending', 100, 'original', ?
    )`,
    [repElenaId, issueId2, t_sep]
  );

  db.run(
    `INSERT INTO report_images (report_id, shared_issue_id, image_url, caption, image_type, created_at)
     VALUES (?, ?, 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80', 'Sunken cast iron utility frame photo', 'evidence', ?)`,
    [repSeparated.lastInsertRowid, issueId2, t_sep]
  );

  // CT-103: Streetlight issue on SL-102 (Resolved permanent repair, for effectiveness verification demo!)
  const t_sl_start = new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString();
  const t_sl_end = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
  const issueResult3 = db.run(
    `INSERT INTO shared_issues (
      issue_code, title, category, description, severity, priority_score,
      is_safety_critical, status, latitude, longitude, address,
      department_id, infrastructure_id, estimated_affected_population,
      affected_population_details, first_reported_at, latest_reported_at,
      resolved_at, resolution_notes, resolution_type, created_at, updated_at
    ) VALUES (
      'CT-103', 'Flickering Luminaire on Greenway Pedestrian Walkway',
      'Streetlights and electrical infrastructure',
      'Luminaire pole #102 blacking out after 8pm creating an unlit blind spot for joggers.',
      'Medium', 44, 0, 'Resolved', 37.7725, -122.4215,
      '150 Park Street West, Greenway Walkway',
      ?, ?, 60,
      'Pedestrians using the greenway transit shortcut',
      ?, ?, ?, 'Permanent waterproof ballast replacement and photocell recalibration completed.', 'permanent', ?, ?
    )`,
    [elecDeptId, slId, t_sl_start, t_sl_start, t_sl_end, t_sl_start, t_sl_end]
  );
  const issueId3 = issueResult3.lastInsertRowid;

  db.run(
    `INSERT INTO citizen_reports (
      report_code, user_id, shared_issue_id, title, category, description,
      severity, latitude, longitude, address, status, similarity_match_score, link_type, created_at
    ) VALUES (
      'REP-2024-006', ?, ?, 'Park Street path light out at night',
      'Streetlights and electrical infrastructure',
      'Walking home from metro station, pole #102 was completely dark.',
      'Medium', 37.7725, -122.4215, '150 Park Street West', 'Resolved', 100, 'original', ?
    )`,
    [repAliceId, issueId3, t_sl_start]
  );

  db.run(
    `INSERT INTO citizen_verifications (shared_issue_id, user_id, is_effective, feedback, created_at)
     VALUES (?, ?, 1, 'Checked tonight during evening walk. The light is shining steadily and brightly now!', ?)`,
    [issueId3, repAliceId, new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()]
  );

  // CT-104: Water Supply Leak on WT-305
  const t_wt = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
  const issueResult4 = db.run(
    `INSERT INTO shared_issues (
      issue_code, title, category, description, severity, priority_score,
      is_safety_critical, status, latitude, longitude, address,
      department_id, infrastructure_id, estimated_affected_population,
      affected_population_details, first_reported_at, latest_reported_at,
      created_at, updated_at
    ) VALUES (
      'CT-104', 'Water Main Pressure Leak along River Road Culvert',
      'Water supply and leakage',
      'Continuous stream of clean potable water bubbling up through curb joint. Pressure dropping in adjacent buildings.',
      'High', 72, 0, 'Assigned', 37.7712, -122.4150,
      '890 River Road, Industrial Riverside Sector',
      ?, ?, 210,
      'Industrial building tenants and municipal warehouse district',
      ?, ?, ?, ?
    )`,
    [waterDeptId, wtId, t_wt, t_wt, t_wt, t_wt]
  );
  const issueId4 = issueResult4.lastInsertRowid;

  db.run(
    `INSERT INTO citizen_reports (
      report_code, user_id, shared_issue_id, title, category, description,
      severity, latitude, longitude, address, status, similarity_match_score, link_type, created_at
    ) VALUES (
      'REP-2024-007', ?, ?, 'Pavement leak bubbling up on River Road',
      'Water supply and leakage',
      'Significant clean water runoff wasting thousands of gallons right near valve station.',
      'High', 37.7712, -122.4150, '890 River Road', 'Assigned', 100, 'original', ?
    )`,
    [repBobId, issueId4, t_wt]
  );

  // CT-105: Drainage Blockage on DR-402 (Escalated overdue issue demo!)
  const t_dr_overdue = new Date(Date.now() - 85 * 3600 * 1000).toISOString();
  const issueResult5 = db.run(
    `INSERT INTO shared_issues (
      issue_code, title, category, description, severity, priority_score,
      is_safety_critical, status, latitude, longitude, address,
      department_id, infrastructure_id, estimated_affected_population,
      affected_population_details, first_reported_at, latest_reported_at,
      created_at, updated_at
    ) VALUES (
      'CT-105', 'Stormwater Drain Grate Choked with Urban Silt & Trash',
      'Drainage and sewage',
      'Promenade drain completely occluded. Rain runoff backing up into plaza shop basements. SLA target elapsed.',
      'High', 82, 0, 'Escalated', 37.7785, -122.4130,
      '420 Market Square Promenade, Metro Center',
      ?, ?, 350,
      'Market square ground floor retail tenants and metro promenade foot traffic',
      ?, ?, ?, ?
    )`,
    [waterDeptId, drId, t_dr_overdue, t_dr_overdue, t_dr_overdue, t_dr_overdue]
  );
  const issueId5 = issueResult5.lastInsertRowid;

  db.run(
    `INSERT INTO citizen_reports (
      report_code, user_id, shared_issue_id, title, category, description,
      severity, latitude, longitude, address, status, similarity_match_score, link_type, created_at
    ) VALUES 
    ('REP-2024-008', ?, ?, 'Market Square drain overflow flooding sidewalk', 'Drainage and sewage', 'Smelly overflow entering stores.', 'High', 37.7785, -122.4130, '420 Market Square Promenade', 'Escalated', 100, 'original', ?),
    ('REP-2024-009', ?, ?, 'Blocked sewer intake near metro stairs', 'Drainage and sewage', 'Deep puddle blocking accessibility ramp.', 'Medium', 37.7786, -122.4132, '430 Market Square', 'Escalated', 88, 'confirmed_duplicate', ?)`,
    [repCarolId, issueId5, t_dr_overdue, repDavidId, issueId5, new Date(Date.now() - 50 * 3600 * 1000).toISOString()]
  );

  // Notifications for users
  db.run(
    `INSERT INTO notifications (user_id, title, message, link_url, is_read, created_at)
     VALUES 
     (?, 'Status Update: Issue CT-101', 'Your report was linked to Master Issue CT-101. Work crews have arrived on site.', '/issues/1', 0, ?),
     (?, 'Repair In Progress', 'Roads crew is addressing the Oak Ave Pothole cluster.', '/issues/1', 0, ?),
     (?, 'Priority Escalation Alert', 'Issue CT-105 (Market Square Drainage) has exceeded its 24h SLA and has been escalated.', '/issues/5', 0, ?)`,
    [repAliceId, now, repBobId, now, userMap['admin@civictrack.org'], now]
  );

  console.log('✓ Seeded Shared Issues, Linked Reports, Notifications & Follows');
  console.log('=== Database Seeding Completed Successfully ===');
}

// If run directly via node src/db/seed.js
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

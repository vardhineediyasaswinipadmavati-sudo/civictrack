import bcrypt from 'bcryptjs';
import { connectMongo, disconnectMongo } from './connection.js';
import {
  Department,
  User,
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
} from '../models/index.js';

export async function seedMongoDatabase() {
  console.log('--- Starting CivicTrack MongoDB Seeding ---');
  await connectMongo();

  // Clear existing collections cleanly
  await Promise.all([
    PasswordReset.deleteMany({}),
    AuditLog.deleteMany({}),
    IssueFollow.deleteMany({}),
    CitizenVerification.deleteMany({}),
    StatusHistory.deleteMany({}),
    ReportImage.deleteMany({}),
    CitizenReport.deleteMany({}),
    RepairRecord.deleteMany({}),
    InfrastructureIncident.deleteMany({}),
    SharedIssue.deleteMany({}),
    InfrastructureAsset.deleteMany({}),
    Notification.deleteMany({}),
    User.deleteMany({}),
    Department.deleteMany({})
  ]);

  console.log('✓ Cleared previous MongoDB collections');

  const now = new Date();

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
    const doc = await Department.create(d);
    deptMap[d.code] = doc._id;
  }
  console.log('✓ Seeded 5 Municipal Departments');

  // 2. Users
  const passAdmin = await bcrypt.hash('admin123', 10);
  const passStaff = await bcrypt.hash('staff123', 10);
  const passCitizen = await bcrypt.hash('citizen123', 10);

  const usersData = [
    { name: 'Suresh Varma (Municipal Commissioner)', email: 'admin@civictrack.org', password_hash: passAdmin, role: 'admin', department_id: null, phone: '+91 98480 22101' },
    { name: 'Ramesh Naidu (Roads & Works Engineer)', email: 'roads.staff@civictrack.org', password_hash: passStaff, role: 'department_staff', department_id: deptMap['ROADS'], phone: '+91 98480 22102' },
    { name: 'Priya Sharma (Water Supply Engineer)', email: 'water.staff@civictrack.org', password_hash: passStaff, role: 'department_staff', department_id: deptMap['WATER'], phone: '+91 98480 22103' },
    { name: 'Lakshmi Rao', email: 'citizen.alice@example.com', password_hash: passCitizen, role: 'citizen', department_id: null, phone: '+91 98480 22104' },
    { name: 'Kalyan Kumar', email: 'citizen.bob@example.com', password_hash: passCitizen, role: 'citizen', department_id: null, phone: '+91 98480 22105' },
    { name: 'Ananya Reddy', email: 'citizen.carol@example.com', password_hash: passCitizen, role: 'citizen', department_id: null, phone: '+91 98480 22106' },
    { name: 'David Raju', email: 'citizen.david@example.com', password_hash: passCitizen, role: 'citizen', department_id: null, phone: '+91 98480 22107' },
    { name: 'Sita Mahalakshmi', email: 'citizen.elena@example.com', password_hash: passCitizen, role: 'citizen', department_id: null, phone: '+91 98480 22108' },
    { name: 'Yasaswini', email: 'vyasaswini007@gmail.com', password_hash: passCitizen, role: 'citizen', department_id: null, phone: '+91 98480 22339' }
  ];

  const userMap = {};
  for (const u of usersData) {
    const doc = await User.create(u);
    userMap[u.email] = doc._id;
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
      risk_reasons: [
        '3 distinct failure incidents recorded on this asset',
        '2 previous temporary cold patches without permanent base stabilization',
        'Average recurrence cycle is 42 days',
        'Heavy commercial traffic volume and monsoon waterlogging'
      ]
    },
    {
      asset_code: 'WS-108',
      name: 'Someswara Swamy Temple Feeder Pipeline (Main Hub)',
      category: 'Water supply and drainage',
      latitude: 16.5412,
      longitude: 81.5283,
      address: 'Old Town Heritage Circle, Bhimavaram, AP',
      installation_date: '2018-09-15',
      current_health_status: 'warning',
      risk_score: 64,
      risk_level: 'High',
      risk_reasons: [
        '2 pipeline burst incidents recorded in last 90 days',
        'Pressure surge fluctuations from municipal pump house',
        'Cast iron junction exceeds recommended service life without relining'
      ]
    },
    {
      asset_code: 'SL-045',
      name: 'Bhimavaram Junction - Railway Station High-Mast Array',
      category: 'Streetlights and electrical',
      latitude: 16.5385,
      longitude: 81.5321,
      address: 'Railway Station Approach Road, Bhimavaram, AP',
      installation_date: '2022-11-20',
      current_health_status: 'monitoring',
      risk_score: 38,
      risk_level: 'Medium',
      risk_reasons: [
        'Intermittent phase surge tripping circuit breakers during dusk transition',
        'Scheduled preventive contactor replacement pending'
      ]
    },
    {
      asset_code: 'DR-012',
      name: 'Mavullamma Temple Stormwater Trunk Culvert',
      category: 'Water supply and drainage',
      latitude: 16.5429,
      longitude: 81.5244,
      address: 'Temple Main Ring Road, Bhimavaram, AP',
      installation_date: '2019-06-01',
      current_health_status: 'good',
      risk_score: 18,
      risk_level: 'Low',
      risk_reasons: [
        'Recently cleared of silt; free stormwater gradient maintained',
        'Annual pre-monsoon inspection completed satisfactorily'
      ]
    },
    {
      asset_code: 'RD-101',
      name: 'DNR College Road Academic Flyover Approach',
      category: 'Roads and potholes',
      latitude: 16.5478,
      longitude: 81.5165,
      address: 'College Road, Balusumoodi, Bhimavaram, AP',
      installation_date: '2020-02-14',
      current_health_status: 'monitoring',
      risk_score: 45,
      risk_level: 'Medium',
      risk_reasons: [
        '1 recurrence recorded after asphalt overlay in monsoon',
        'Heavy student two-wheeler flow during peak morning hours'
      ]
    },
    {
      asset_code: 'ST-003',
      name: 'Sunday Vegetable Market Solid Waste Compactor Bay',
      category: 'Garbage and sanitation',
      latitude: 16.5463,
      longitude: 81.5198,
      address: 'Weekly Market Yard, Gandhi Nagar, Bhimavaram, AP',
      installation_date: '2023-01-10',
      current_health_status: 'good',
      risk_score: 15,
      risk_level: 'Low',
      risk_reasons: [
        'Daily mechanized clearing operational',
        'Leachate drainage sump functioning properly'
      ]
    }
  ];

  const assetMap = {};
  for (const a of assetsData) {
    const doc = await InfrastructureAsset.create(a);
    assetMap[a.asset_code] = doc._id;
  }
  console.log('✓ Seeded 6 Infrastructure Assets with Risk Indicators');

  // 4. Infrastructure Incidents
  const incidentsData = [
    {
      incident_code: 'INC-RD204-1',
      infrastructure_id: assetMap['RD-204'],
      incident_type: 'Pavement Sub-base Subsidence',
      description: 'Multiple deep potholes formed after heavy monsoon waterlogging. Bitumen layer fractured.',
      started_at: new Date('2024-06-15T08:30:00Z'),
      resolved_at: new Date('2024-06-18T16:00:00Z'),
      recurrence_sequence: 1
    },
    {
      incident_code: 'INC-RD204-2',
      infrastructure_id: assetMap['RD-204'],
      incident_type: 'Asphalt Stripping & Pothole Recurrence',
      description: 'Temporary cold patch eroded within 40 days. Exposed aggregate dislodged creating hazardous cavity.',
      started_at: new Date('2024-07-28T09:15:00Z'),
      resolved_at: new Date('2024-08-01T17:30:00Z'),
      recurrence_sequence: 2
    },
    {
      incident_code: 'INC-RD204-3',
      infrastructure_id: assetMap['RD-204'],
      incident_type: 'Extensive Road Crater Expansion',
      description: 'Active severe pothole measuring 1.2m across near Penumatsa corridor junction causing heavy traffic delays.',
      started_at: new Date('2024-09-12T07:45:00Z'),
      resolved_at: null,
      recurrence_sequence: 3
    },
    {
      incident_code: 'INC-WS108-1',
      infrastructure_id: assetMap['WS-108'],
      incident_type: 'Distribution Main Flange Leakage',
      description: 'Pressurized water escaping into pedestrian walkway near Someswara Swamy temple gate.',
      started_at: new Date('2024-05-10T06:00:00Z'),
      resolved_at: new Date('2024-05-11T14:00:00Z'),
      recurrence_sequence: 1
    },
    {
      incident_code: 'INC-WS108-2',
      infrastructure_id: assetMap['WS-108'],
      incident_type: 'Main Trunk Burst & Flooding',
      description: 'Underground high pressure pipe cracked. Potable water flooding surrounding low-lying shops.',
      started_at: new Date('2024-08-20T04:30:00Z'),
      resolved_at: null,
      recurrence_sequence: 2
    }
  ];

  const incidentMap = {};
  for (const inc of incidentsData) {
    const doc = await InfrastructureIncident.create(inc);
    incidentMap[inc.incident_code] = doc._id;
  }
  console.log('✓ Seeded Historical Incidents');

  // 5. Repair Records
  const repairsData = [
    {
      repair_code: 'REP-REC-8801',
      infrastructure_id: assetMap['RD-204'],
      incident_id: incidentMap['INC-RD204-1'],
      repaired_by_user_id: userMap['roads.staff@civictrack.org'],
      department_id: deptMap['ROADS'],
      repair_type: 'temporary',
      cost_amount: 14500,
      cost_unavailable: false,
      materials_used: 'Cold-mix asphalt emulsion, 10mm crushed aggregate',
      work_summary: 'Emergency leveling of 3 potholes using cold mix aggregate. Base stabilization not executed due to rainfall.',
      completed_at: new Date('2024-06-18T16:00:00Z'),
      recurrence_observed: true,
      days_until_next_incident: 40
    },
    {
      repair_code: 'REP-REC-8802',
      infrastructure_id: assetMap['RD-204'],
      incident_id: incidentMap['INC-RD204-2'],
      repaired_by_user_id: userMap['roads.staff@civictrack.org'],
      department_id: deptMap['ROADS'],
      repair_type: 'temporary',
      cost_amount: 18000,
      cost_unavailable: false,
      materials_used: 'Rapid-set bitumen patch, stone dust filler',
      work_summary: 'Surface patching repeated. Deep compaction not performed as heavy commercial trucks continued using lane.',
      completed_at: new Date('2024-08-01T17:30:00Z'),
      recurrence_observed: true,
      days_until_next_incident: 42
    },
    {
      repair_code: 'REP-REC-8803',
      infrastructure_id: assetMap['WS-108'],
      incident_id: incidentMap['INC-WS108-1'],
      repaired_by_user_id: userMap['water.staff@civictrack.org'],
      department_id: deptMap['WATER'],
      repair_type: 'temporary',
      cost_amount: 8500,
      cost_unavailable: false,
      materials_used: 'Split collar clamp, rubber gasket sheet',
      work_summary: 'Emergency pipe band clamp fastened around cracked flange joint to restore temple water supply quickly.',
      completed_at: new Date('2024-05-11T14:00:00Z'),
      recurrence_observed: true,
      days_until_next_incident: 101
    }
  ];

  for (const r of repairsData) {
    await RepairRecord.create(r);
  }
  console.log('✓ Seeded Multi-Stage Repair Records');

  // 6. Shared Issues
  const issue1 = await SharedIssue.create({
    issue_code: 'CT-101',
    title: 'Hazardous Crater Pothole on PP Road Corridor (Town Center)',
    category: 'Roads and potholes',
    description: 'Deep road cavity spanning nearly 1.2 meters directly in the center traffic lane in front of Penumatsa Complex, causing severe vehicle swerving.',
    severity: 'Critical',
    priority_score: 88,
    is_safety_critical: true,
    status: 'In Progress',
    latitude: 16.5449,
    longitude: 81.5212,
    address: 'PP Road near Town Center Junction, Bhimavaram',
    department_id: deptMap['ROADS'],
    infrastructure_id: assetMap['RD-204'],
    incident_id: incidentMap['INC-RD204-3'],
    assigned_to_user_id: userMap['roads.staff@civictrack.org'],
    estimated_affected_population: 48,
    affected_population_details: 'Main commercial artery connecting town center to railway station with heavy two-wheeler and RTC bus volume',
    first_reported_at: new Date('2024-09-12T07:45:00Z'),
    latest_reported_at: new Date('2024-09-14T11:20:00Z')
  });

  const issue2 = await SharedIssue.create({
    issue_code: 'CT-102',
    title: 'High-Pressure Water Main Burst near Someswara Temple',
    category: 'Water supply and drainage',
    description: 'Major drinking water pipeline rupture flooding temple heritage street with severe loss of potable water and low pressure across 4 wards.',
    severity: 'High',
    priority_score: 74,
    is_safety_critical: false,
    status: 'Assigned',
    latitude: 16.5412,
    longitude: 81.5283,
    address: 'Old Town Heritage Circle, Bhimavaram',
    department_id: deptMap['WATER'],
    infrastructure_id: assetMap['WS-108'],
    incident_id: incidentMap['INC-WS108-2'],
    assigned_to_user_id: userMap['water.staff@civictrack.org'],
    estimated_affected_population: 65,
    affected_population_details: 'Directly impacts residential water supply for Ward 12 and Ward 14',
    first_reported_at: new Date('2024-08-20T04:30:00Z'),
    latest_reported_at: new Date('2024-08-21T09:10:00Z')
  });

  const issue3 = await SharedIssue.create({
    issue_code: 'CT-103',
    title: 'Dark High-Mast Streetlight Array at Railway Station Junction',
    category: 'Streetlights and electrical',
    description: 'Central 4-lamp high-mast luminaire completely extinguished for 3 consecutive nights, creating pedestrian safety hazards at station entrance.',
    severity: 'Medium',
    priority_score: 42,
    is_safety_critical: false,
    status: 'Pending',
    latitude: 16.5385,
    longitude: 81.5321,
    address: 'Railway Station Approach Circle, Bhimavaram',
    department_id: deptMap['ELECTRICAL'],
    infrastructure_id: assetMap['SL-045'],
    estimated_affected_population: 32,
    first_reported_at: new Date('2024-09-18T19:30:00Z'),
    latest_reported_at: new Date('2024-09-18T19:30:00Z')
  });

  const issue4 = await SharedIssue.create({
    issue_code: 'CT-104',
    title: 'Stormwater Culvert Grate Debris Clearance',
    category: 'Water supply and drainage',
    description: 'Plastic bags and storm debris trapped in temple trunk culvert screen during heavy monsoon showers.',
    severity: 'Low',
    priority_score: 25,
    is_safety_critical: false,
    status: 'Resolved',
    latitude: 16.5429,
    longitude: 81.5244,
    address: 'Mavullamma Temple Ring Road, Bhimavaram',
    department_id: deptMap['WATER'],
    infrastructure_id: assetMap['DR-012'],
    resolved_at: new Date('2024-09-10T15:00:00Z'),
    resolution_type: 'permanent',
    resolution_notes: 'Trash screen cleared and silt deposit flushed with hydro-jetting equipment.',
    first_reported_at: new Date('2024-09-09T08:00:00Z'),
    latest_reported_at: new Date('2024-09-09T10:15:00Z')
  });

  console.log('✓ Seeded Shared Master Issues');

  // 7. Citizen Reports linked to Issue 1 (Multiple citizens reporting the same issue)
  const rep1 = await CitizenReport.create({
    report_code: 'REP-2024-001',
    user_id: userMap['citizen.alice@example.com'],
    shared_issue_id: issue1._id,
    title: 'Massive pothole broke my motorcycle suspension on PP Road',
    category: 'Roads and potholes',
    description: 'I hit this deep hole while returning from market at night. It is nearly 5 inches deep with no street markings or warning sign.',
    severity: 'Critical',
    latitude: 16.54485,
    longitude: 81.52118,
    address: 'PP Road near Penumatsa Complex, Bhimavaram',
    status: 'In Progress',
    similarity_match_score: 100,
    link_type: 'original',
    created_at: new Date('2024-09-12T07:45:00Z')
  });

  const rep2 = await CitizenReport.create({
    report_code: 'REP-2024-002',
    user_id: userMap['citizen.bob@example.com'],
    shared_issue_id: issue1._id,
    title: 'Very dangerous crater near Penumatsa center',
    category: 'Roads and potholes',
    description: 'Saw an auto-rickshaw overturn almost completely this morning avoiding this crater on PP road.',
    severity: 'High',
    latitude: 16.54492,
    longitude: 81.52125,
    address: 'PP Road, Town Center, Bhimavaram',
    status: 'In Progress',
    similarity_match_score: 94,
    link_type: 'confirmed_duplicate',
    created_at: new Date('2024-09-12T14:10:00Z')
  });

  const rep3 = await CitizenReport.create({
    report_code: 'REP-2024-003',
    user_id: userMap['citizen.carol@example.com'],
    shared_issue_id: issue1._id,
    title: 'Re-opened pothole after last month repair on PP road',
    category: 'Roads and potholes',
    description: 'The cold patch placed in July has completely washed away. It is even wider now than before.',
    severity: 'High',
    latitude: 16.5449,
    longitude: 81.5212,
    address: 'Penumatsa Peda Amiram Road, Bhimavaram',
    status: 'In Progress',
    similarity_match_score: 98,
    link_type: 'confirmed_duplicate',
    created_at: new Date('2024-09-13T09:30:00Z')
  });

  const rep4 = await CitizenReport.create({
    report_code: 'REP-2024-004',
    user_id: userMap['vyasaswini007@gmail.com'],
    shared_issue_id: issue1._id,
    title: 'Severe road cavity causing severe traffic bottle-neck',
    category: 'Roads and potholes',
    description: 'Vehicles must stop and maneuver into opposing lane to bypass this ditch. High risk of head-on collisions.',
    severity: 'Critical',
    latitude: 16.54488,
    longitude: 81.52115,
    address: 'PP Road Corridor, Bhimavaram',
    status: 'In Progress',
    similarity_match_score: 96,
    link_type: 'confirmed_duplicate',
    created_at: new Date('2024-09-14T11:20:00Z')
  });

  // Report for Issue 2
  await CitizenReport.create({
    report_code: 'REP-2024-005',
    user_id: userMap['citizen.david@example.com'],
    shared_issue_id: issue2._id,
    title: 'Drinking water pipeline ruptured at Someswara temple',
    category: 'Water supply and drainage',
    description: 'Fresh water gushing across the road since early morning. Shop fronts flooded.',
    severity: 'High',
    latitude: 16.5412,
    longitude: 81.5283,
    address: 'Old Town Heritage Circle, Bhimavaram',
    status: 'Assigned',
    similarity_match_score: 100,
    link_type: 'original',
    created_at: new Date('2024-08-20T04:30:00Z')
  });

  // Report for Issue 3
  await CitizenReport.create({
    report_code: 'REP-2024-006',
    user_id: userMap['citizen.elena@example.com'],
    shared_issue_id: issue3._id,
    title: 'Railway station junction lights not functioning',
    category: 'Streetlights and electrical',
    description: 'High mast light dark. Auto stand and station approach are pitch black after 7 PM.',
    severity: 'Medium',
    latitude: 16.5385,
    longitude: 81.5321,
    address: 'Railway Station Approach Circle, Bhimavaram',
    status: 'Pending',
    similarity_match_score: 100,
    link_type: 'original',
    created_at: new Date('2024-09-18T19:30:00Z')
  });

  console.log('✓ Seeded Linked Citizen Reports');

  // 8. Report Images
  await ReportImage.create([
    {
      report_id: rep1._id,
      shared_issue_id: issue1._id,
      image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
      caption: 'PP Road deep pothole measuring 1.2m width across active lane',
      image_type: 'evidence'
    },
    {
      report_id: rep2._id,
      shared_issue_id: issue1._id,
      image_url: 'https://images.unsplash.com/photo-1584463699042-494b29bb8044?w=800&auto=format&fit=crop&q=80',
      caption: 'Vehicles swerving to avoid crater in front of Penumatsa complex',
      image_type: 'evidence'
    }
  ]);

  // 9. Status History & Follows
  await StatusHistory.create([
    {
      shared_issue_id: issue1._id,
      old_status: 'None',
      new_status: 'Pending',
      changed_by_user_id: userMap['citizen.alice@example.com'],
      comments: 'Citizen submitted initial complaint'
    },
    {
      shared_issue_id: issue1._id,
      old_status: 'Pending',
      new_status: 'In Progress',
      changed_by_user_id: userMap['admin@civictrack.org'],
      comments: 'Dispatched emergency roads engineering squad for base inspection and milling'
    }
  ]);

  await IssueFollow.create([
    { shared_issue_id: issue1._id, user_id: userMap['citizen.alice@example.com'] },
    { shared_issue_id: issue1._id, user_id: userMap['citizen.bob@example.com'] },
    { shared_issue_id: issue1._id, user_id: userMap['vyasaswini007@gmail.com'] }
  ]);

  await Notification.create([
    {
      user_id: userMap['citizen.alice@example.com'],
      title: 'Work Order In Progress',
      message: 'Municipal maintenance squad has been dispatched to PP Road (Issue CT-101).',
      link_url: `/issues/${issue1._id}`,
      is_read: false
    },
    {
      user_id: userMap['vyasaswini007@gmail.com'],
      title: 'Report Linked to Master Issue CT-101',
      message: 'Your observation was linked to Master Issue CT-101. You will receive real-time repair updates.',
      link_url: `/issues/${issue1._id}`,
      is_read: false
    }
  ]);

  console.log('=== MongoDB Seeding Completed Successfully ===');
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedMongoDatabase()
    .then(async () => {
      await disconnectMongo();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

import { InfrastructureAsset, InfrastructureIncident, RepairRecord, Department, User } from '../models/index.js';

export const DEMO_ASSETS_DATA = [
  // ==========================================
  // 10 ROAD ASSETS (Category: 'Roads and potholes')
  // ==========================================
  {
    asset_code: 'AST-RD-001',
    name: 'PP Road Arterial Corridor (km 2.4 - 3.1) [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5449,
    longitude: 81.5212,
    address: 'Penumatsa Peda Amiram Road, Town Center, Bhimavaram, AP 534202',
    installation_date: '2021-04-10',
    current_health_status: 'critical',
    risk_score: 82,
    risk_level: 'Critical',
    risk_reasons: [
      '3 distinct pavement subsidence incidents recorded on this corridor',
      '2 previous temporary cold asphalt patches eroded under heavy rains',
      'Average recurrence cycle is 42 days',
      'High commercial traffic volume and monsoon waterlogging',
      'Sample / Demonstration Data'
    ],
    sampleIncidents: [
      {
        incident_code: 'INC-RD001-1',
        incident_type: 'Pavement Sub-base Subsidence',
        description: 'Multiple deep potholes formed after heavy monsoon waterlogging. Bitumen layer fractured.',
        started_at: new Date('2024-06-15T08:30:00Z'),
        resolved_at: new Date('2024-06-18T16:00:00Z'),
        recurrence_sequence: 1,
        repair: {
          repair_code: 'REP-RD001-1',
          repair_type: 'temporary',
          cost_amount: 35000,
          materials_used: 'Cold-mix asphalt, gravel aggregate',
          work_summary: 'Emergency filling of 4 critical potholes along market lane',
          completed_at: new Date('2024-06-18T16:00:00Z')
        }
      },
      {
        incident_code: 'INC-RD001-2',
        incident_type: 'Asphalt Stripping & Cavity Expansion',
        description: 'Temporary cold patch washed away within 40 days. Cavity expanded into traffic lane.',
        started_at: new Date('2024-07-28T09:15:00Z'),
        resolved_at: new Date('2024-08-01T17:30:00Z'),
        recurrence_sequence: 2,
        repair: {
          repair_code: 'REP-RD001-2',
          repair_type: 'temporary',
          cost_amount: 48000,
          materials_used: 'Bitumen emulsion patch, crushed stone',
          work_summary: 'Re-leveled road surface with tack coat and aggregate',
          completed_at: new Date('2024-08-01T17:30:00Z')
        }
      },
      {
        incident_code: 'INC-RD001-3',
        incident_type: 'Severe Road Crater Expansion',
        description: 'Active crater measuring 1.2m across near junction causing vehicle underbody damage and traffic congestion.',
        started_at: new Date('2024-09-10T11:00:00Z'),
        resolved_at: null,
        recurrence_sequence: 3
      }
    ]
  },
  {
    asset_code: 'AST-RD-002',
    name: 'DNR College Academic Corridor, Balusumoodi [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5478,
    longitude: 81.5165,
    address: 'College Road, Balusumoodi, Bhimavaram, AP 534202',
    installation_date: '2020-02-14',
    current_health_status: 'monitoring',
    risk_score: 45,
    risk_level: 'Medium',
    risk_reasons: [
      'Surface bitumen raveling detected during quarterly municipal audit',
      'High student two-wheeler peak flow during college opening hours',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-RD-003',
    name: 'Sriramapuram - Chinna Amiram Link Road [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5455,
    longitude: 81.4948,
    address: 'Sriramapuram Road near SRKR Engineering College, Chinna Amiram, Bhimavaram, AP 534204',
    installation_date: '2022-08-20',
    current_health_status: 'warning',
    risk_score: 68,
    risk_level: 'High',
    risk_reasons: [
      'Recurrent edge cracks along irrigation canal embankment',
      'Heavy college bus and transport vehicle traffic loads',
      'Sub-base drainage requires gravel replenishment',
      'Sample / Demonstration Data'
    ],
    sampleIncidents: [
      {
        incident_code: 'INC-RD003-1',
        incident_type: 'Shoulder Erosion & Edge Drop-off',
        description: 'Canal embankment soil eroded causing 15cm shoulder drop-off dangerous for two-wheelers.',
        started_at: new Date('2024-05-10T10:00:00Z'),
        resolved_at: new Date('2024-05-14T15:00:00Z'),
        recurrence_sequence: 1,
        repair: {
          repair_code: 'REP-RD003-1',
          repair_type: 'temporary',
          cost_amount: 28000,
          materials_used: 'Gravel backfill, sandbags',
          work_summary: 'Stabilized road shoulder with compacted gravel',
          completed_at: new Date('2024-05-14T15:00:00Z')
        }
      }
    ]
  },
  {
    asset_code: 'AST-RD-004',
    name: 'Town Railway Station Main Approach Road [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5472,
    longitude: 81.5196,
    address: 'Station Road, Sivaraopeta, Bhimavaram, AP 534201',
    installation_date: '2021-11-15',
    current_health_status: 'good',
    risk_score: 15,
    risk_level: 'Low',
    risk_reasons: [
      'Full bituminous concrete resurfacing completed in 2023',
      'Proper road crown drainage functioning effectively',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-RD-005',
    name: 'Mavullamma Temple Circular Ring Road [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5429,
    longitude: 81.5244,
    address: 'Temple Main Ring Road, Bhimavaram, AP 534201',
    installation_date: '2019-06-01',
    current_health_status: 'monitoring',
    risk_score: 35,
    risk_level: 'Medium',
    risk_reasons: [
      'Heavy pedestrian and festival chariot procession loads',
      'Minor paver block settlement near north gate',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-RD-006',
    name: 'Someswara Swamy Heritage Lane [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5412,
    longitude: 81.5283,
    address: 'Old Town Heritage Circle, Gunupudi, Bhimavaram, AP 534201',
    installation_date: '2018-09-15',
    current_health_status: 'warning',
    risk_score: 62,
    risk_level: 'High',
    risk_reasons: [
      'Potholes over excavated underground utility pipeline trenches',
      'Narrow heritage carriageway with limited drainage gradient',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-RD-007',
    name: 'Juvvalapalem Road Commercial Corridor [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5435,
    longitude: 81.5268,
    address: 'Juvvalapalem Road, Commercial Market Area, Bhimavaram, AP 534202',
    installation_date: '2022-03-18',
    current_health_status: 'good',
    risk_score: 20,
    risk_level: 'Low',
    risk_reasons: [
      'Reinforced cement concrete pavement with expansion joints intact',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-RD-008',
    name: 'Undi Road West Godavari Feeder Highway [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5512,
    longitude: 81.5085,
    address: 'Chebrolu - Undi Road, Town Outskirts, Bhimavaram, AP 534199',
    installation_date: '2020-07-25',
    current_health_status: 'critical',
    risk_score: 78,
    risk_level: 'Critical',
    risk_reasons: [
      'Sub-base deformation and multiple alligator crack patches',
      'Unregulated inter-district agricultural transport vehicles',
      '2 recurrent pavement failures logged within past 6 months',
      'Sample / Demonstration Data'
    ],
    sampleIncidents: [
      {
        incident_code: 'INC-RD008-1',
        incident_type: 'Heavy Vehicle Rutting & Alligator Cracking',
        description: 'Significant longitudinal rutting (8cm deep) caused by paddy harvest haulage trucks.',
        started_at: new Date('2024-04-12T07:00:00Z'),
        resolved_at: new Date('2024-04-17T18:00:00Z'),
        recurrence_sequence: 1,
        repair: {
          repair_code: 'REP-RD008-1',
          repair_type: 'temporary',
          cost_amount: 52000,
          materials_used: 'Bitumen mix and stone dust',
          work_summary: 'Milled surface ruts and laid hot mix patch',
          completed_at: new Date('2024-04-17T18:00:00Z')
        }
      }
    ]
  },
  {
    asset_code: 'AST-RD-009',
    name: 'Gandhi Nagar Vegetable Market Access Way [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5463,
    longitude: 81.5198,
    address: 'Market Yard Road, Gandhi Nagar, Bhimavaram, AP 534203',
    installation_date: '2023-01-10',
    current_health_status: 'good',
    risk_score: 18,
    risk_level: 'Low',
    risk_reasons: [
      'High-density interlock pavers installed in 2023',
      'Regular mechanized street sweeping operational',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-RD-010',
    name: 'Housing Board Colony Main Spine Road [Demo Asset]',
    category: 'Roads and potholes',
    deptCode: 'ROADS',
    latitude: 16.5495,
    longitude: 81.5240,
    address: 'Housing Board Colony, Rayalam Road, Bhimavaram, AP 534204',
    installation_date: '2019-12-05',
    current_health_status: 'monitoring',
    risk_score: 40,
    risk_level: 'Medium',
    risk_reasons: [
      'Surface weathering and minor potholes at culvert junctions',
      'Periodic monsoon puddle accumulation near Sector 2 entry',
      'Sample / Demonstration Data'
    ]
  },

  // ==========================================
  // 8 STREETLIGHT ASSETS (Category: 'Streetlights and electrical infrastructure')
  // ==========================================
  {
    asset_code: 'AST-SL-001',
    name: 'Bhimavaram Junction High-Mast Lighting Array [Demo Asset]',
    category: 'Streetlights and electrical infrastructure',
    deptCode: 'ELECTRICAL',
    latitude: 16.5444,
    longitude: 81.5376,
    address: 'Railway Junction Circulating Area, Narasa Agraharam, Bhimavaram, AP 534202',
    installation_date: '2022-11-20',
    current_health_status: 'good',
    risk_score: 15,
    risk_level: 'Low',
    risk_reasons: [
      '8-luminaire 400W LED array fully functional',
      'Automated astronomical timer calibrated',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-SL-002',
    name: 'Town Railway Station Forecourt Lighting Grid [Demo Asset]',
    category: 'Streetlights and electrical infrastructure',
    deptCode: 'ELECTRICAL',
    latitude: 16.5470,
    longitude: 81.5194,
    address: 'Town Station Plaza, Sivaraopeta, Bhimavaram, AP 534201',
    installation_date: '2021-08-12',
    current_health_status: 'monitoring',
    risk_score: 38,
    risk_level: 'Medium',
    risk_reasons: [
      'Phase imbalance tripping breaker during evening peak surge',
      'Scheduled contactor relay replacement pending',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-SL-003',
    name: 'PP Road LED Smart Streetlight Corridor (Poles 1-40) [Demo Asset]',
    category: 'Streetlights and electrical infrastructure',
    deptCode: 'ELECTRICAL',
    latitude: 16.5451,
    longitude: 81.5215,
    address: 'PP Road Arterial Median, Bhimavaram, AP 534202',
    installation_date: '2023-04-05',
    current_health_status: 'good',
    risk_score: 12,
    risk_level: 'Low',
    risk_reasons: [
      'Energy-efficient LED fixtures with photocell sensors operational',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-SL-004',
    name: 'Mavullamma Temple Pilgrim Pathway Illumination [Demo Asset]',
    category: 'Streetlights and electrical infrastructure',
    deptCode: 'ELECTRICAL',
    latitude: 16.5427,
    longitude: 81.5242,
    address: 'Temple South Enclosure Walkway, Bhimavaram, AP 534201',
    installation_date: '2020-09-18',
    current_health_status: 'warning',
    risk_score: 65,
    risk_level: 'High',
    risk_reasons: [
      'Underground armored cable moisture seepage triggering earth leakage breaker',
      'Exposed junction box requires waterproofing renewal',
      'Sample / Demonstration Data'
    ],
    sampleIncidents: [
      {
        incident_code: 'INC-SL004-1',
        incident_type: 'Short Circuit & Partial Blackout',
        description: 'Moisture ingress in junction box tripped 6 sequential walkway lights.',
        started_at: new Date('2024-07-15T19:00:00Z'),
        resolved_at: new Date('2024-07-16T11:00:00Z'),
        recurrence_sequence: 1,
        repair: {
          repair_code: 'REP-SL004-1',
          repair_type: 'temporary',
          cost_amount: 14000,
          materials_used: 'Silicone sealant, junction terminals',
          work_summary: 'Re-terminated scorched cables and sealed box',
          completed_at: new Date('2024-07-16T11:00:00Z')
        }
      }
    ]
  },
  {
    asset_code: 'AST-SL-005',
    name: 'Balusumoodi Center Smart Solar Light Array [Demo Asset]',
    category: 'Streetlights and electrical infrastructure',
    deptCode: 'ELECTRICAL',
    latitude: 16.5475,
    longitude: 81.5168,
    address: 'DNR College Traffic Island, Balusumoodi, Bhimavaram, AP 534202',
    installation_date: '2022-01-30',
    current_health_status: 'good',
    risk_score: 22,
    risk_level: 'Low',
    risk_reasons: [
      'LiFePO4 battery storage tested at 92% health capacity',
      'Solar panels cleaned bi-monthly',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-SL-006',
    name: 'RTC Bus Stand Depot Perimeter Floodlights [Demo Asset]',
    category: 'Streetlights and electrical infrastructure',
    deptCode: 'ELECTRICAL',
    latitude: 16.5460,
    longitude: 81.5140,
    address: 'APSRTC Bus Station Depot, Bhimavaram, AP 534201',
    installation_date: '2019-10-15',
    current_health_status: 'critical',
    risk_score: 75,
    risk_level: 'Critical',
    risk_reasons: [
      'Corroded pole base anchor bolts posing structural risk in coastal winds',
      'Frequent neutral wire disconnects recorded',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-SL-007',
    name: 'Sriramapuram Residential Streetlight Grid [Demo Asset]',
    category: 'Streetlights and electrical infrastructure',
    deptCode: 'ELECTRICAL',
    latitude: 16.5458,
    longitude: 81.4952,
    address: 'Sriramapuram 3rd Lane, Chinna Amiram, Bhimavaram, AP 534204',
    installation_date: '2021-06-20',
    current_health_status: 'monitoring',
    risk_score: 42,
    risk_level: 'Medium',
    risk_reasons: [
      '3 fixtures flickering due to loose service drop taps',
      'Tree branches touching overhead conductor in monsoon',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-SL-008',
    name: 'Guvvala Cheruvu Lake Bund Promenade Lights [Demo Asset]',
    category: 'Streetlights and electrical infrastructure',
    deptCode: 'ELECTRICAL',
    latitude: 16.5405,
    longitude: 81.5220,
    address: 'Lake Bund Promenade Walkway, Bhimavaram, AP 534202',
    installation_date: '2023-05-10',
    current_health_status: 'good',
    risk_score: 14,
    risk_level: 'Low',
    risk_reasons: [
      'Decorative cast iron bollard lighting fully commissioned',
      'Sample / Demonstration Data'
    ]
  },

  // ==========================================
  // 6 DRAINAGE ASSETS (Category: 'Drainage and sewage')
  // ==========================================
  {
    asset_code: 'AST-DR-001',
    name: 'Mavullamma Temple Stormwater Trunk Culvert [Demo Asset]',
    category: 'Drainage and sewage',
    deptCode: 'WATER',
    latitude: 16.5429,
    longitude: 81.5244,
    address: 'Temple Ring Road Culvert Junction, Bhimavaram, AP 534201',
    installation_date: '2019-06-01',
    current_health_status: 'good',
    risk_score: 18,
    risk_level: 'Low',
    risk_reasons: [
      'Pre-monsoon mechanized desilting completed',
      'Reinforced RCC barrel box structurally sound',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-DR-002',
    name: 'PP Road Commercial Stormwater Channel [Demo Asset]',
    category: 'Drainage and sewage',
    deptCode: 'WATER',
    latitude: 16.5445,
    longitude: 81.5218,
    address: 'PP Road East Shoulder, Bhimavaram, AP 534202',
    installation_date: '2018-05-14',
    current_health_status: 'critical',
    risk_score: 84,
    risk_level: 'Critical',
    risk_reasons: [
      'Solid waste dumping causing 70% cross-section blockage during downpours',
      'Broken RCC slab covers presenting pedestrian hazard',
      '3 overflow flood incidents recorded in commercial center',
      'Sample / Demonstration Data'
    ],
    sampleIncidents: [
      {
        incident_code: 'INC-DR002-1',
        incident_type: 'Severe Stormwater Backflow & Flooding',
        description: 'Channel choked with plastic waste during pre-monsoon storm flooding 12 storefronts.',
        started_at: new Date('2024-06-20T14:00:00Z'),
        resolved_at: new Date('2024-06-21T18:00:00Z'),
        recurrence_sequence: 1,
        repair: {
          repair_code: 'REP-DR002-1',
          repair_type: 'temporary',
          cost_amount: 42000,
          materials_used: 'Manual silt scoops, suction jetting',
          work_summary: 'Emergency evacuation of clogged drain channel section',
          completed_at: new Date('2024-06-21T18:00:00Z')
        }
      }
    ]
  },
  {
    asset_code: 'AST-DR-003',
    name: 'Balusumoodi Low-Lying Outfall Drain [Demo Asset]',
    category: 'Drainage and sewage',
    deptCode: 'WATER',
    latitude: 16.5482,
    longitude: 81.5160,
    address: 'Balusumoodi Drain Outfall, DNR College Road, Bhimavaram, AP 534202',
    installation_date: '2020-04-18',
    current_health_status: 'warning',
    risk_score: 66,
    risk_level: 'High',
    risk_reasons: [
      'Backwater stagnation during high canal tides',
      'Silt buildup reducing discharge velocity by 45%',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-DR-004',
    name: 'Kothapeta Canal Sluice & Siphon Conduit [Demo Asset]',
    category: 'Drainage and sewage',
    deptCode: 'WATER',
    latitude: 16.5390,
    longitude: 81.5260,
    address: 'Canal Bund, Kothapeta, Bhimavaram, AP 534201',
    installation_date: '2017-08-22',
    current_health_status: 'monitoring',
    risk_score: 48,
    risk_level: 'Medium',
    risk_reasons: [
      'Sluice gate winch requires greasing and corrosion removal',
      'Intake trash screen debris buildup observed',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-DR-005',
    name: 'Gandhi Nagar Vegetable Market Sub-surface Sump [Demo Asset]',
    category: 'Drainage and sewage',
    deptCode: 'WATER',
    latitude: 16.5465,
    longitude: 81.5195,
    address: 'Market Yard Sewage Sump, Gandhi Nagar, Bhimavaram, AP 534203',
    installation_date: '2022-09-05',
    current_health_status: 'good',
    risk_score: 24,
    risk_level: 'Low',
    risk_reasons: [
      'Dual submersible pump automated level sensors functional',
      'Weekly grease and silt evacuation logged',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-DR-006',
    name: 'Housing Board Colony Stormwater Discharge Conduit [Demo Asset]',
    category: 'Drainage and sewage',
    deptCode: 'WATER',
    latitude: 16.5498,
    longitude: 81.5235,
    address: 'Colony Sector 4 Outflow, Rayalam Road, Bhimavaram, AP 534204',
    installation_date: '2021-02-17',
    current_health_status: 'monitoring',
    risk_score: 36,
    risk_level: 'Medium',
    risk_reasons: [
      'Masonry side wall mortar erosion along 15m stretch',
      'Vegetative growth obstructing water flow velocity',
      'Sample / Demonstration Data'
    ]
  },

  // ==========================================
  // 5 WATER SUPPLY ASSETS (Category: 'Water supply and leakage')
  // ==========================================
  {
    asset_code: 'AST-WS-001',
    name: 'Someswara Swamy Feeder Pipeline (Main Hub) [Demo Asset]',
    category: 'Water supply and leakage',
    deptCode: 'WATER',
    latitude: 16.5412,
    longitude: 81.5283,
    address: 'Old Town Heritage Circle, Gunupudi, Bhimavaram, AP 534201',
    installation_date: '2018-09-15',
    current_health_status: 'warning',
    risk_score: 64,
    risk_level: 'High',
    risk_reasons: [
      '2 pipeline burst incidents recorded in last 90 days',
      'Pressure surge fluctuations from municipal pump house',
      'Cast iron junction exceeds recommended service life without relining',
      'Sample / Demonstration Data'
    ],
    sampleIncidents: [
      {
        incident_code: 'INC-WS001-1',
        incident_type: 'Trunk Feeder Joint Rupture',
        description: 'Sudden pressure spike caused bell-and-spigot joint collar rupture leaking 12,000L/hr.',
        started_at: new Date('2024-05-18T05:00:00Z'),
        resolved_at: new Date('2024-05-19T14:00:00Z'),
        recurrence_sequence: 1,
        repair: {
          repair_code: 'REP-WS001-1',
          repair_type: 'temporary',
          cost_amount: 65000,
          materials_used: 'Mechanical repair clamp, gasket seal',
          work_summary: 'Fitted split collar sleeve over ruptured joint',
          completed_at: new Date('2024-05-19T14:00:00Z')
        }
      }
    ]
  },
  {
    asset_code: 'AST-WS-002',
    name: 'Municipal Overhead Reservoir & Booster Station (2000 KL) [Demo Asset]',
    category: 'Water supply and leakage',
    deptCode: 'WATER',
    latitude: 16.5468,
    longitude: 81.5225,
    address: 'Head Water Works, Municipality Road, Bhimavaram, AP 534201',
    installation_date: '2016-03-20',
    current_health_status: 'good',
    risk_score: 16,
    risk_level: 'Low',
    risk_reasons: [
      'Staging column structural integrity non-destructive testing certified',
      'Chlorination automated dosing unit calibrated',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-WS-003',
    name: 'Balusumoodi Secondary Distribution Header [Demo Asset]',
    category: 'Water supply and leakage',
    deptCode: 'WATER',
    latitude: 16.5476,
    longitude: 81.5170,
    address: 'Water Works Road, Balusumoodi, Bhimavaram, AP 534202',
    installation_date: '2019-11-10',
    current_health_status: 'monitoring',
    risk_score: 39,
    risk_level: 'Medium',
    risk_reasons: [
      'Minor flange gasket weeping under peak distribution pressure',
      'Sluice valve packing gland tightened during regular maintenance',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-WS-004',
    name: 'Sivaraopeta High-Pressure Transmission Main [Demo Asset]',
    category: 'Water supply and leakage',
    deptCode: 'WATER',
    latitude: 16.5480,
    longitude: 81.5205,
    address: 'NH165 Crossing, Sivaraopeta, Bhimavaram, AP 534201',
    installation_date: '2017-06-14',
    current_health_status: 'critical',
    risk_score: 79,
    risk_level: 'Critical',
    risk_reasons: [
      'Multiple localized wall thinning spots identified via ultrasonic testing',
      'Heavy vibration from highway traffic adjacent to pipe trench',
      'Recurrent joint weeping recorded',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-WS-005',
    name: 'Chinna Amiram Sub-Urban Pumping Station [Demo Asset]',
    category: 'Water supply and leakage',
    deptCode: 'WATER',
    latitude: 16.5450,
    longitude: 81.4960,
    address: 'SRKR Road, Chinna Amiram, Bhimavaram, AP 534204',
    installation_date: '2021-05-18',
    current_health_status: 'good',
    risk_score: 20,
    risk_level: 'Low',
    risk_reasons: [
      'Dual 50HP centrifugal pump sets operational on alternate duty cycle',
      'Raw water quality telemetry active',
      'Sample / Demonstration Data'
    ]
  },

  // ==========================================
  // 4 PUBLIC BUILDINGS (Category: 'Public buildings and facilities')
  // ==========================================
  {
    asset_code: 'AST-PB-001',
    name: 'Bhimavaram Municipal Corporation Administrative Complex [Demo Asset]',
    category: 'Public buildings and facilities',
    deptCode: 'FACILITIES',
    latitude: 16.5456,
    longitude: 81.5228,
    address: 'Municipal Office Road, Town Center, Bhimavaram, AP 534201',
    installation_date: '2015-08-15',
    current_health_status: 'good',
    risk_score: 12,
    risk_level: 'Low',
    risk_reasons: [
      'Annual structural stability certification verified',
      'Fire hydrants and emergency electrical systems compliant',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-PB-002',
    name: 'Gandhi Nagar Municipal Urban Primary Health Center [Demo Asset]',
    category: 'Public buildings and facilities',
    deptCode: 'FACILITIES',
    latitude: 16.5466,
    longitude: 81.5192,
    address: 'UPHC Complex, Gandhi Nagar, Bhimavaram, AP 534203',
    installation_date: '2019-01-26',
    current_health_status: 'monitoring',
    risk_score: 34,
    risk_level: 'Medium',
    risk_reasons: [
      'Rooftop rainwater proofing membrane requires recoating before monsoon',
      'Backup solar inverter battery replaced in 2023',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-PB-003',
    name: 'Sunday Vegetable Market Wholesale Trading Pavilion [Demo Asset]',
    category: 'Public buildings and facilities',
    deptCode: 'FACILITIES',
    latitude: 16.5462,
    longitude: 81.5200,
    address: 'Wholesale Market Yard, Gandhi Nagar, Bhimavaram, AP 534203',
    installation_date: '2018-12-10',
    current_health_status: 'warning',
    risk_score: 63,
    risk_level: 'High',
    risk_reasons: [
      'Corrosion on steel roof purlins due to market humidity',
      'Pedestrian ramp handrail damaged from handcart collisions',
      'Sample / Demonstration Data'
    ]
  },
  {
    asset_code: 'AST-PB-004',
    name: 'Town Public Library & Digital Reading Room [Demo Asset]',
    category: 'Public buildings and facilities',
    deptCode: 'FACILITIES',
    latitude: 16.5440,
    longitude: 81.5248,
    address: 'Library Street near Mavullamma Temple, Bhimavaram, AP 534201',
    installation_date: '2017-11-14',
    current_health_status: 'good',
    risk_score: 17,
    risk_level: 'Low',
    risk_reasons: [
      'Interior climate control maintenance completed',
      'Emergency exit signage functional',
      'Sample / Demonstration Data'
    ]
  }
];

/**
 * Idempotently seed the 33 demonstration assets into MongoDB.
 * Never duplicates existing assets by asset_code.
 * Never overwrites or modifies real assets.
 */
export async function seedDemoInfrastructureAssets() {
  const depts = await Department.find({});
  const deptMap = {};
  for (const d of depts) {
    deptMap[d.code] = d._id;
  }

  // Find a staff or admin user to link to sample repairs if needed
  const staffUser = await User.findOne({ role: { $in: ['department_staff', 'admin'] } });
  const staffUserId = staffUser ? staffUser._id : null;

  let createdCount = 0;

  for (const item of DEMO_ASSETS_DATA) {
    const existing = await InfrastructureAsset.findOne({ asset_code: item.asset_code });
    if (!existing) {
      const deptId = deptMap[item.deptCode] || null;

      const assetDoc = await InfrastructureAsset.create({
        asset_code: item.asset_code,
        name: item.name,
        category: item.category,
        latitude: item.latitude,
        longitude: item.longitude,
        address: item.address,
        installation_date: item.installation_date,
        current_health_status: item.current_health_status,
        risk_score: item.risk_score,
        risk_level: item.risk_level,
        risk_reasons: item.risk_reasons,
        department_id: deptId,
        is_demo: true
      });
      createdCount++;

      // Seed sample historical incidents and repairs if specified
      if (item.sampleIncidents && item.sampleIncidents.length > 0) {
        for (const inc of item.sampleIncidents) {
          const incDoc = await InfrastructureIncident.create({
            incident_code: inc.incident_code,
            infrastructure_id: assetDoc._id,
            shared_issue_id: null,
            incident_type: inc.incident_type,
            description: inc.description,
            started_at: inc.started_at,
            resolved_at: inc.resolved_at,
            recurrence_sequence: inc.recurrence_sequence
          });

          if (inc.repair && staffUserId && deptId) {
            await RepairRecord.create({
              repair_code: inc.repair.repair_code,
              infrastructure_id: assetDoc._id,
              incident_id: incDoc._id,
              shared_issue_id: null,
              repaired_by_user_id: staffUserId,
              department_id: deptId,
              repair_type: inc.repair.repair_type,
              cost_amount: inc.repair.cost_amount,
              cost_unavailable: false,
              materials_used: inc.repair.materials_used,
              work_summary: inc.repair.work_summary,
              completed_at: inc.repair.completed_at,
              recurrence_observed: inc.recurrence_sequence > 1
            });
          }
        }
      }
    }
  }

  if (createdCount > 0) {
    console.log(`✓ Seeded ${createdCount} realistic Bhimavaram demonstration infrastructure assets`);
  }
}

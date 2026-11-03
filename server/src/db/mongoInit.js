import bcrypt from 'bcryptjs';
import { Department, User } from '../models/index.js';

export const DEFAULT_DEPARTMENTS = [
  { name: 'Roads and Infrastructure', code: 'ROADS', contact_email: 'roads@civictrack.org', sla_hours: 48 },
  { name: 'Electrical and Lighting', code: 'ELECTRICAL', contact_email: 'electrical@civictrack.org', sla_hours: 36 },
  { name: 'Water Supply and Sewage', code: 'WATER', contact_email: 'water@civictrack.org', sla_hours: 24 },
  { name: 'Solid Waste and Sanitation', code: 'SANITATION', contact_email: 'sanitation@civictrack.org', sla_hours: 24 },
  { name: 'Public Facilities and Structures', code: 'FACILITIES', contact_email: 'facilities@civictrack.org', sla_hours: 72 }
];

/**
 * Idempotent default data initialization for MongoDB.
 * Never deletes or overwrites existing records.
 */
export async function initDefaultData() {
  // 1. Ensure required municipal departments exist
  for (const dept of DEFAULT_DEPARTMENTS) {
    const existing = await Department.findOne({ code: dept.code });
    if (!existing) {
      await Department.create({
        name: dept.name,
        code: dept.code,
        contact_email: dept.contact_email,
        sla_hours: dept.sla_hours
      });
      console.log(`✓ Initialized default department: ${dept.name} (${dept.code})`);
    }
  }

  // 2. Provision initial administrator and staff accounts if users collection is empty
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const allowDemo = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_ACCOUNTS === 'true';
    const customAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
    const customAdminPass = process.env.INITIAL_ADMIN_PASSWORD;

    if (customAdminEmail && customAdminPass) {
      const passAdmin = await bcrypt.hash(customAdminPass, 10);
      await User.create({
        name: 'System Administrator',
        email: customAdminEmail.trim().toLowerCase(),
        password_hash: passAdmin,
        role: 'admin',
        department_id: null,
        phone: null
      });
      console.log(`✓ Provisioned production administrator account: ${customAdminEmail}`);
    } else if (allowDemo) {
      const roadsDept = await Department.findOne({ code: 'ROADS' });
      const waterDept = await Department.findOne({ code: 'WATER' });

      const passAdmin = await bcrypt.hash('admin123', 10);
      const passStaff = await bcrypt.hash('staff123', 10);
      const passCitizen = await bcrypt.hash('citizen123', 10);

      await User.create([
        {
          name: 'Suresh Varma (Demo Municipal Commissioner)',
          email: 'admin@civictrack.org',
          password_hash: passAdmin,
          role: 'admin',
          department_id: null,
          phone: '+91 98480 22101'
        },
        {
          name: 'Ramesh Naidu (Demo Roads Engineer)',
          email: 'roads.staff@civictrack.org',
          password_hash: passStaff,
          role: 'department_staff',
          department_id: roadsDept ? roadsDept._id : null,
          phone: '+91 98480 22102'
        },
        {
          name: 'Priya Sharma (Demo Water Engineer)',
          email: 'water.staff@civictrack.org',
          password_hash: passStaff,
          role: 'department_staff',
          department_id: waterDept ? waterDept._id : null,
          phone: '+91 98480 22103'
        },
        {
          name: 'Lakshmi Rao',
          email: 'citizen.alice@example.com',
          password_hash: passCitizen,
          role: 'citizen',
          department_id: null,
          phone: '+91 98480 22104'
        },
        {
          name: 'Yasaswini',
          email: 'vyasaswini007@gmail.com',
          password_hash: passCitizen,
          role: 'citizen',
          department_id: null,
          phone: '+91 98480 22339'
        }
      ]);
      console.log('✓ Provisioned evaluation demo accounts for evaluation');
    }
  }
}

export default {
  DEFAULT_DEPARTMENTS,
  initDefaultData
};

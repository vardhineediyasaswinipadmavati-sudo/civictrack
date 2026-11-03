import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import mongoose from 'mongoose';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Robust, Idempotent SQLite to MongoDB Migration Utility.
 * - Migrates all 14 tables.
 * - Idempotent: checks for existing documents by unique keys or legacy_id before inserting.
 * - Invalidates historical password reset tokens for security.
 * - Converts all relational foreign keys into MongoDB ObjectIds.
 * - Never modifies or overwrites the original SQLite database file.
 */
export async function migrateSqliteToMongo(sqlitePath = null) {
  const dbPath = sqlitePath || path.resolve(__dirname, '../../data/civictrack.sqlite');

  console.log('=== Starting CivicTrack SQLite to MongoDB Migration ===');
  console.log(`Source SQLite file: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    console.warn(`Source SQLite database not found at ${dbPath}. Skipping migration.`);
    return { success: false, reason: 'Source SQLite file does not exist' };
  }

  // 1. Read SQLite file (read-only buffer)
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const sqlDb = new SQL.Database(fileBuffer);

  function getAllRows(sql) {
    try {
      const stmt = sqlDb.prepare(sql);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (e) {
      return [];
    }
  }

  // 2. Ensure MongoDB connection
  await connectMongo();

  const idMap = {
    departments: {},
    users: {},
    infrastructure_assets: {},
    shared_issues: {},
    citizen_reports: {},
    infrastructure_incidents: {},
    repair_records: {}
  };

  const stats = {
    sqliteCounts: {},
    mongoMigratedCounts: {},
    skippedDuplicates: {},
    unmigratedRecords: []
  };

  try {
    // 1. Migrate Departments
    console.log('[1/14] Migrating Departments...');
    const sqliteDepts = getAllRows('SELECT * FROM departments ORDER BY id ASC');
    stats.sqliteCounts.departments = sqliteDepts.length;
    for (const d of sqliteDepts) {
      let doc = await Department.findOne({
        $or: [{ code: d.code }, { legacy_id: d.id }]
      });
      if (!doc) {
        doc = await Department.create({
          name: d.name,
          code: d.code,
          contact_email: d.contact_email,
          sla_hours: d.sla_hours,
          legacy_id: d.id,
          created_at: d.created_at ? new Date(d.created_at) : new Date()
        });
      }
      idMap.departments[d.id] = doc._id;
    }
    stats.mongoMigratedCounts.departments = await Department.countDocuments();

    // 2. Migrate Users
    console.log('[2/14] Migrating Users...');
    const sqliteUsers = getAllRows('SELECT * FROM users ORDER BY id ASC');
    stats.sqliteCounts.users = sqliteUsers.length;
    for (const u of sqliteUsers) {
      let doc = await User.findOne({
        $or: [{ email: u.email.toLowerCase().trim() }, { legacy_id: u.id }]
      });
      if (!doc) {
        doc = await User.create({
          name: u.name,
          email: u.email.toLowerCase().trim(),
          password_hash: u.password_hash,
          role: u.role,
          department_id: u.department_id ? idMap.departments[u.department_id] || null : null,
          phone: u.phone || null,
          is_active: true,
          legacy_id: u.id,
          created_at: u.created_at ? new Date(u.created_at) : new Date()
        });
      }
      idMap.users[u.id] = doc._id;
    }
    stats.mongoMigratedCounts.users = await User.countDocuments();

    // 3. Migrate Infrastructure Assets
    console.log('[3/14] Migrating Infrastructure Assets...');
    const sqliteAssets = getAllRows('SELECT * FROM infrastructure_assets ORDER BY id ASC');
    stats.sqliteCounts.infrastructure_assets = sqliteAssets.length;
    for (const a of sqliteAssets) {
      let doc = await InfrastructureAsset.findOne({
        $or: [{ asset_code: a.asset_code }, { legacy_id: a.id }]
      });
      let reasons = [];
      try {
        reasons = a.risk_reasons ? JSON.parse(a.risk_reasons) : [];
      } catch (_) {
        reasons = a.risk_reasons ? [a.risk_reasons] : [];
      }

      if (!doc) {
        doc = await InfrastructureAsset.create({
          asset_code: a.asset_code,
          name: a.name,
          category: a.category,
          latitude: Number(a.latitude),
          longitude: Number(a.longitude),
          address: a.address,
          installation_date: a.installation_date,
          last_inspected_at: a.last_inspected_at ? new Date(a.last_inspected_at) : null,
          current_health_status: a.current_health_status || 'good',
          risk_score: Number(a.risk_score || 10),
          risk_level: a.risk_level || 'Low',
          risk_reasons: reasons,
          legacy_id: a.id,
          created_at: a.created_at ? new Date(a.created_at) : new Date()
        });
      }
      idMap.infrastructure_assets[a.id] = doc._id;
    }
    stats.mongoMigratedCounts.infrastructure_assets = await InfrastructureAsset.countDocuments();

    // 4. Migrate Shared Issues
    console.log('[4/14] Migrating Shared Issues...');
    const sqliteIssues = getAllRows('SELECT * FROM shared_issues ORDER BY id ASC');
    stats.sqliteCounts.shared_issues = sqliteIssues.length;
    for (const s of sqliteIssues) {
      let doc = await SharedIssue.findOne({
        $or: [{ issue_code: s.issue_code }, { legacy_id: s.id }]
      });
      if (!doc) {
        doc = await SharedIssue.create({
          issue_code: s.issue_code,
          title: s.title,
          category: s.category,
          description: s.description,
          severity: s.severity || 'Medium',
          priority_score: Number(s.priority_score || 50),
          is_safety_critical: Boolean(s.is_safety_critical),
          status: s.status || 'Pending',
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
          address: s.address,
          department_id: s.department_id ? idMap.departments[s.department_id] || null : null,
          infrastructure_id: s.infrastructure_id ? idMap.infrastructure_assets[s.infrastructure_id] || null : null,
          assigned_to_user_id: s.assigned_to_user_id ? idMap.users[s.assigned_to_user_id] || null : null,
          estimated_affected_population: Number(s.estimated_affected_population || 0),
          affected_population_details: s.affected_population_details || null,
          first_reported_at: s.first_reported_at ? new Date(s.first_reported_at) : new Date(),
          latest_reported_at: s.latest_reported_at ? new Date(s.latest_reported_at) : new Date(),
          resolved_at: s.resolved_at ? new Date(s.resolved_at) : null,
          resolution_notes: s.resolution_notes || null,
          resolution_type: s.resolution_type || null,
          legacy_id: s.id,
          created_at: s.created_at ? new Date(s.created_at) : new Date(),
          updated_at: s.updated_at ? new Date(s.updated_at) : new Date()
        });
      }
      idMap.shared_issues[s.id] = doc._id;
    }
    stats.mongoMigratedCounts.shared_issues = await SharedIssue.countDocuments();

    // Update merged issues self-references
    for (const s of sqliteIssues) {
      if (s.is_merged_into_id && idMap.shared_issues[s.is_merged_into_id]) {
        await SharedIssue.updateOne(
          { issue_code: s.issue_code },
          { is_merged_into_id: idMap.shared_issues[s.is_merged_into_id] }
        );
      }
    }

    // 5. Migrate Citizen Reports
    console.log('[5/14] Migrating Citizen Reports...');
    const sqliteReports = getAllRows('SELECT * FROM citizen_reports ORDER BY id ASC');
    stats.sqliteCounts.citizen_reports = sqliteReports.length;
    for (const r of sqliteReports) {
      let doc = await CitizenReport.findOne({
        $or: [{ report_code: r.report_code }, { legacy_id: r.id }]
      });
      if (!doc) {
        doc = await CitizenReport.create({
          report_code: r.report_code,
          user_id: idMap.users[r.user_id],
          shared_issue_id: r.shared_issue_id ? idMap.shared_issues[r.shared_issue_id] || null : null,
          title: r.title,
          category: r.category,
          description: r.description,
          severity: r.severity || 'Medium',
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          address: r.address,
          status: r.status || 'Pending',
          similarity_match_score: r.similarity_match_score !== null ? Number(r.similarity_match_score) : null,
          link_type: r.link_type || 'original',
          legacy_id: r.id,
          created_at: r.created_at ? new Date(r.created_at) : new Date()
        });
      }
      idMap.citizen_reports[r.id] = doc._id;
    }
    stats.mongoMigratedCounts.citizen_reports = await CitizenReport.countDocuments();

    // 6. Migrate Infrastructure Incidents
    console.log('[6/14] Migrating Infrastructure Incidents...');
    const sqliteIncidents = getAllRows('SELECT * FROM infrastructure_incidents ORDER BY id ASC');
    stats.sqliteCounts.infrastructure_incidents = sqliteIncidents.length;
    for (const inc of sqliteIncidents) {
      let doc = await InfrastructureIncident.findOne({
        $or: [{ incident_code: inc.incident_code }, { legacy_id: inc.id }]
      });
      if (!doc) {
        doc = await InfrastructureIncident.create({
          incident_code: inc.incident_code,
          infrastructure_id: idMap.infrastructure_assets[inc.infrastructure_id],
          shared_issue_id: inc.shared_issue_id ? idMap.shared_issues[inc.shared_issue_id] || null : null,
          incident_type: inc.incident_type,
          description: inc.description,
          started_at: inc.started_at ? new Date(inc.started_at) : new Date(),
          resolved_at: inc.resolved_at ? new Date(inc.resolved_at) : null,
          recurrence_sequence: Number(inc.recurrence_sequence || 1),
          legacy_id: inc.id,
          created_at: inc.created_at ? new Date(inc.created_at) : new Date()
        });
      }
      idMap.infrastructure_incidents[inc.id] = doc._id;
    }
    stats.mongoMigratedCounts.infrastructure_incidents = await InfrastructureIncident.countDocuments();

    // 7. Migrate Repair Records
    console.log('[7/14] Migrating Repair Records...');
    const sqliteRepairs = getAllRows('SELECT * FROM repair_records ORDER BY id ASC');
    stats.sqliteCounts.repair_records = sqliteRepairs.length;
    for (const rep of sqliteRepairs) {
      let doc = await RepairRecord.findOne({
        $or: [{ repair_code: rep.repair_code }, { legacy_id: rep.id }]
      });
      if (!doc) {
        doc = await RepairRecord.create({
          repair_code: rep.repair_code,
          infrastructure_id: idMap.infrastructure_assets[rep.infrastructure_id],
          incident_id: rep.incident_id ? idMap.infrastructure_incidents[rep.incident_id] || null : null,
          shared_issue_id: rep.shared_issue_id ? idMap.shared_issues[rep.shared_issue_id] || null : null,
          repaired_by_user_id: idMap.users[rep.repaired_by_user_id],
          department_id: idMap.departments[rep.department_id],
          repair_type: rep.repair_type,
          cost_amount: rep.cost_amount !== null ? Number(rep.cost_amount) : null,
          cost_unavailable: Boolean(rep.cost_unavailable),
          materials_used: rep.materials_used || null,
          work_summary: rep.work_summary,
          completed_at: rep.completed_at ? new Date(rep.completed_at) : new Date(),
          next_inspection_due: rep.next_inspection_due ? new Date(rep.next_inspection_due) : null,
          recurrence_observed: Boolean(rep.recurrence_observed),
          days_until_next_incident: rep.days_until_next_incident !== null ? Number(rep.days_until_next_incident) : null,
          legacy_id: rep.id,
          created_at: rep.created_at ? new Date(rep.created_at) : new Date()
        });
      }
      idMap.repair_records[rep.id] = doc._id;
    }
    stats.mongoMigratedCounts.repair_records = await RepairRecord.countDocuments();

    // 8. Migrate Report Images
    console.log('[8/14] Migrating Report Images...');
    const sqliteImages = getAllRows('SELECT * FROM report_images ORDER BY id ASC');
    stats.sqliteCounts.report_images = sqliteImages.length;
    for (const img of sqliteImages) {
      const existing = await ReportImage.findOne({
        $or: [{ legacy_id: img.id }, { image_url: img.image_url, image_type: img.image_type }]
      });
      if (!existing) {
        await ReportImage.create({
          report_id: img.report_id ? idMap.citizen_reports[img.report_id] || null : null,
          shared_issue_id: img.shared_issue_id ? idMap.shared_issues[img.shared_issue_id] || null : null,
          repair_id: img.repair_id ? idMap.repair_records[img.repair_id] || null : null,
          image_url: img.image_url,
          caption: img.caption || null,
          image_type: img.image_type || 'evidence',
          legacy_id: img.id,
          created_at: img.created_at ? new Date(img.created_at) : new Date()
        });
      }
    }
    stats.mongoMigratedCounts.report_images = await ReportImage.countDocuments();

    // 9. Migrate Status History (Idempotent by legacy_id)
    console.log('[9/14] Migrating Status History...');
    const sqliteHistory = getAllRows('SELECT * FROM status_history ORDER BY id ASC');
    stats.sqliteCounts.status_history = sqliteHistory.length;
    for (const h of sqliteHistory) {
      if (idMap.shared_issues[h.shared_issue_id] && idMap.users[h.changed_by_user_id]) {
        const existing = await StatusHistory.findOne({ legacy_id: h.id });
        if (!existing) {
          await StatusHistory.create({
            shared_issue_id: idMap.shared_issues[h.shared_issue_id],
            old_status: h.old_status,
            new_status: h.new_status,
            changed_by_user_id: idMap.users[h.changed_by_user_id],
            comments: h.comments || null,
            legacy_id: h.id,
            created_at: h.created_at ? new Date(h.created_at) : new Date()
          });
        }
      }
    }
    stats.mongoMigratedCounts.status_history = await StatusHistory.countDocuments();

    // 10. Migrate Citizen Verifications (Idempotent by legacy_id)
    console.log('[10/14] Migrating Citizen Verifications...');
    const sqliteVerifications = getAllRows('SELECT * FROM citizen_verifications ORDER BY id ASC');
    stats.sqliteCounts.citizen_verifications = sqliteVerifications.length;
    for (const v of sqliteVerifications) {
      if (idMap.shared_issues[v.shared_issue_id] && idMap.users[v.user_id]) {
        const existing = await CitizenVerification.findOne({ legacy_id: v.id });
        if (!existing) {
          await CitizenVerification.create({
            shared_issue_id: idMap.shared_issues[v.shared_issue_id],
            user_id: idMap.users[v.user_id],
            is_effective: Boolean(v.is_effective),
            feedback: v.feedback || null,
            legacy_id: v.id,
            created_at: v.created_at ? new Date(v.created_at) : new Date()
          });
        }
      }
    }
    stats.mongoMigratedCounts.citizen_verifications = await CitizenVerification.countDocuments();

    // 11. Migrate Issue Follows (Idempotent by unique compound index)
    console.log('[11/14] Migrating Issue Follows...');
    const sqliteFollows = getAllRows('SELECT * FROM issue_follows ORDER BY id ASC');
    stats.sqliteCounts.issue_follows = sqliteFollows.length;
    for (const f of sqliteFollows) {
      if (idMap.shared_issues[f.shared_issue_id] && idMap.users[f.user_id]) {
        const issueId = idMap.shared_issues[f.shared_issue_id];
        const userId = idMap.users[f.user_id];
        const existing = await IssueFollow.findOne({ shared_issue_id: issueId, user_id: userId });
        if (!existing) {
          await IssueFollow.create({
            shared_issue_id: issueId,
            user_id: userId,
            legacy_id: f.id,
            created_at: f.created_at ? new Date(f.created_at) : new Date()
          });
        }
      }
    }
    stats.mongoMigratedCounts.issue_follows = await IssueFollow.countDocuments();

    // 12. Migrate Notifications (Idempotent by legacy_id)
    console.log('[12/14] Migrating Notifications...');
    const sqliteNotifications = getAllRows('SELECT * FROM notifications ORDER BY id ASC');
    stats.sqliteCounts.notifications = sqliteNotifications.length;
    for (const n of sqliteNotifications) {
      if (idMap.users[n.user_id]) {
        const existing = await Notification.findOne({ legacy_id: n.id });
        if (!existing) {
          await Notification.create({
            user_id: idMap.users[n.user_id],
            title: n.title,
            message: n.message,
            link_url: n.link_url || null,
            is_read: Boolean(n.is_read),
            legacy_id: n.id,
            created_at: n.created_at ? new Date(n.created_at) : new Date()
          });
        }
      }
    }
    stats.mongoMigratedCounts.notifications = await Notification.countDocuments();

    // 13. Migrate Audit Logs (Idempotent by legacy_id)
    console.log('[13/14] Migrating Audit Logs...');
    const sqliteLogs = getAllRows('SELECT * FROM audit_logs ORDER BY id ASC');
    stats.sqliteCounts.audit_logs = sqliteLogs.length;
    for (const l of sqliteLogs) {
      if (idMap.users[l.user_id]) {
        const existing = await AuditLog.findOne({ legacy_id: l.id });
        if (!existing) {
          await AuditLog.create({
            action: l.action,
            entity_type: l.entity_type,
            entity_id: l.entity_id,
            user_id: idMap.users[l.user_id],
            details: l.details || null,
            legacy_id: l.id,
            created_at: l.created_at ? new Date(l.created_at) : new Date()
          });
        }
      }
    }
    stats.mongoMigratedCounts.audit_logs = await AuditLog.countDocuments();

    // 14. Migrate Password Resets with Security Invalidation
    console.log('[14/14] Migrating Password Resets (with security token invalidation)...');
    const sqliteResets = getAllRows('SELECT * FROM password_resets ORDER BY id ASC');
    stats.sqliteCounts.password_resets = sqliteResets.length;
    const migrationTimestamp = new Date();
    for (const pr of sqliteResets) {
      if (idMap.users[pr.user_id]) {
        const existing = await PasswordReset.findOne({
          $or: [{ token_hash: pr.token_hash }, { legacy_id: pr.id }]
        });
        if (!existing) {
          // Security requirement: Invalidate legacy tokens so expired credentials cannot be hijacked
          const originalExpires = pr.expires_at ? new Date(pr.expires_at) : migrationTimestamp;
          const originalUsed = pr.used_at ? new Date(pr.used_at) : migrationTimestamp;
          await PasswordReset.create({
            user_id: idMap.users[pr.user_id],
            token_hash: pr.token_hash,
            expires_at: originalExpires < migrationTimestamp ? originalExpires : migrationTimestamp,
            used_at: originalUsed, // Invalidate active credentials
            legacy_id: pr.id,
            created_at: pr.created_at ? new Date(pr.created_at) : new Date()
          });
        }
      }
    }
    stats.mongoMigratedCounts.password_resets = await PasswordReset.countDocuments();

    console.log('=== Migration Summary ===');
    console.table(stats.mongoMigratedCounts);

    return {
      success: true,
      stats
    };
  } catch (err) {
    console.error('Migration encountered error:', err);
    throw err;
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('migrateSqliteToMongo.js')) {
  migrateSqliteToMongo()
    .then((res) => {
      console.log('Migration finished successfully:', res.success);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

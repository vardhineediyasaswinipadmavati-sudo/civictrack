export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  contact_email TEXT NOT NULL,
  sla_hours INTEGER NOT NULL DEFAULT 72,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('citizen', 'admin', 'department_staff')),
  department_id INTEGER,
  phone TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS infrastructure_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT NOT NULL,
  installation_date TEXT,
  last_inspected_at TEXT,
  current_health_status TEXT NOT NULL DEFAULT 'good' CHECK(current_health_status IN ('good', 'monitoring', 'warning', 'critical')),
  risk_score INTEGER NOT NULL DEFAULT 10,
  risk_level TEXT NOT NULL DEFAULT 'Low' CHECK(risk_level IN ('Low', 'Medium', 'High', 'Critical')),
  risk_reasons TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Medium' CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')),
  priority_score INTEGER NOT NULL DEFAULT 50,
  is_safety_critical INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Assigned', 'In Progress', 'Resolved', 'Reopened', 'Escalated')),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT NOT NULL,
  department_id INTEGER,
  infrastructure_id INTEGER,
  incident_id INTEGER,
  assigned_to_user_id INTEGER,
  estimated_affected_population INTEGER DEFAULT 0,
  affected_population_details TEXT,
  first_reported_at TEXT NOT NULL,
  latest_reported_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution_notes TEXT,
  resolution_type TEXT CHECK(resolution_type IS NULL OR resolution_type IN ('temporary', 'permanent', 'inspection_only', 'no_fault')),
  is_merged_into_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL,
  FOREIGN KEY (infrastructure_id) REFERENCES infrastructure_assets (id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users (id) ON DELETE SET NULL,
  FOREIGN KEY (is_merged_into_id) REFERENCES shared_issues (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS citizen_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  shared_issue_id INTEGER,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'Medium',
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  similarity_match_score REAL,
  link_type TEXT NOT NULL DEFAULT 'original' CHECK(link_type IN ('original', 'confirmed_duplicate', 'admin_merged')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (shared_issue_id) REFERENCES shared_issues (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS report_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER,
  shared_issue_id INTEGER,
  repair_id INTEGER,
  image_url TEXT NOT NULL,
  caption TEXT,
  image_type TEXT NOT NULL DEFAULT 'evidence' CHECK(image_type IN ('evidence', 'before_repair', 'after_repair')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (report_id) REFERENCES citizen_reports (id) ON DELETE CASCADE,
  FOREIGN KEY (shared_issue_id) REFERENCES shared_issues (id) ON DELETE CASCADE,
  FOREIGN KEY (repair_id) REFERENCES repair_records (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS infrastructure_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_code TEXT NOT NULL UNIQUE,
  infrastructure_id INTEGER NOT NULL,
  shared_issue_id INTEGER,
  incident_type TEXT NOT NULL,
  description TEXT NOT NULL,
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  recurrence_sequence INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (infrastructure_id) REFERENCES infrastructure_assets (id) ON DELETE CASCADE,
  FOREIGN KEY (shared_issue_id) REFERENCES shared_issues (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS repair_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_code TEXT NOT NULL UNIQUE,
  infrastructure_id INTEGER NOT NULL,
  incident_id INTEGER,
  shared_issue_id INTEGER,
  repaired_by_user_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  repair_type TEXT NOT NULL CHECK(repair_type IN ('temporary', 'permanent', 'inspection_only', 'no_fault')),
  cost_amount REAL,
  cost_unavailable INTEGER NOT NULL DEFAULT 0,
  materials_used TEXT,
  work_summary TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  next_inspection_due TEXT,
  recurrence_observed INTEGER NOT NULL DEFAULT 0,
  days_until_next_incident INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (infrastructure_id) REFERENCES infrastructure_assets (id) ON DELETE CASCADE,
  FOREIGN KEY (incident_id) REFERENCES infrastructure_incidents (id) ON DELETE SET NULL,
  FOREIGN KEY (shared_issue_id) REFERENCES shared_issues (id) ON DELETE SET NULL,
  FOREIGN KEY (repaired_by_user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shared_issue_id INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by_user_id INTEGER NOT NULL,
  comments TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shared_issue_id) REFERENCES shared_issues (id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by_user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS citizen_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shared_issue_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  is_effective INTEGER NOT NULL,
  feedback TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (shared_issue_id) REFERENCES shared_issues (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issue_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shared_issue_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(shared_issue_id, user_id),
  FOREIGN KEY (shared_issue_id) REFERENCES shared_issues (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_issues_status ON shared_issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON shared_issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_infra ON shared_issues(infrastructure_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON citizen_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_issue ON citizen_reports(shared_issue_id);
CREATE INDEX IF NOT EXISTS idx_incidents_infra ON infrastructure_incidents(infrastructure_id);
CREATE INDEX IF NOT EXISTS idx_repairs_infra ON repair_records(infrastructure_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_password_resets_hash ON password_resets(token_hash);
`;

export async function initSchema(db) {
  db.exec(SCHEMA_SQL);
}

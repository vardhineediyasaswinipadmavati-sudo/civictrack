export type UserRole = 'citizen' | 'admin' | 'department_staff';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  department_id?: number | null;
  department_name?: string | null;
  phone?: string | null;
  created_at: string;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  contact_email: string;
  sla_hours: number;
  staff_count?: number;
  active_issues_count?: number;
}

export type HealthStatus = 'good' | 'monitoring' | 'warning' | 'critical';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface InfrastructureAsset {
  id: number;
  asset_code: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  installation_date: string;
  last_inspected_at?: string | null;
  current_health_status: HealthStatus;
  risk_score: number;
  risk_level: RiskLevel;
  risk_reasons: string[];
  total_citizen_reports?: number;
  unique_incidents_count?: number;
  repair_attempts_count?: number;
  last_repair_date?: string | null;
  created_at: string;
}

export type IssueStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Resolved' | 'Reopened' | 'Escalated';
export type IssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface SharedIssue {
  id: number;
  issue_code: string;
  title: string;
  category: string;
  description: string;
  severity: IssueSeverity;
  priority_score: number;
  is_safety_critical: number | boolean;
  status: IssueStatus;
  latitude: number;
  longitude: number;
  address: string;
  department_id?: number | null;
  department_name?: string | null;
  department_code?: string | null;
  sla_hours?: number;
  infrastructure_id?: number | null;
  asset_name?: string | null;
  asset_code?: string | null;
  asset_health?: HealthStatus | null;
  asset_risk?: number | null;
  incident_id?: number | null;
  assigned_to_user_id?: number | null;
  assigned_staff_name?: string | null;
  estimated_affected_population: number;
  affected_population_details?: string | null;
  first_reported_at: string;
  latest_reported_at: string;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  resolution_type?: 'temporary' | 'permanent' | 'inspection_only' | 'no_fault' | null;
  is_merged_into_id?: number | null;
  citizen_reports_count?: number;
  primary_image?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CitizenReport {
  id: number;
  report_code: string;
  user_id: number;
  reporter_name?: string;
  reporter_email?: string;
  shared_issue_id?: number | null;
  issue_code?: string | null;
  shared_status?: IssueStatus | null;
  shared_title?: string | null;
  shared_category?: string | null;
  shared_address?: string | null;
  title: string;
  category: string;
  description: string;
  severity: string;
  latitude: number;
  longitude: number;
  address: string;
  status: IssueStatus;
  similarity_match_score?: number | null;
  link_type: 'original' | 'confirmed_duplicate' | 'admin_merged';
  primary_image?: string | null;
  evidence_image?: string | null;
  images?: ReportImage[];
  created_at: string;
}

export interface ReportImage {
  id: number;
  report_id?: number | null;
  shared_issue_id?: number | null;
  repair_id?: number | null;
  image_url: string;
  caption?: string | null;
  image_type: 'evidence' | 'before_repair' | 'after_repair';
  created_at: string;
}

export interface InfrastructureIncident {
  id: number;
  incident_code: string;
  infrastructure_id: number;
  shared_issue_id?: number | null;
  issue_code?: string | null;
  incident_type: string;
  description: string;
  started_at: string;
  resolved_at?: string | null;
  recurrence_sequence: number;
  report_count?: number;
  created_at: string;
}

export interface RepairRecord {
  id: number;
  repair_code: string;
  infrastructure_id: number;
  incident_id?: number | null;
  shared_issue_id?: number | null;
  repaired_by_user_id: number;
  repaired_by_name?: string;
  department_id: number;
  department_name?: string;
  repair_type: 'temporary' | 'permanent' | 'inspection_only' | 'no_fault';
  cost_amount?: number | null;
  cost_unavailable: number | boolean;
  materials_used?: string | null;
  work_summary: string;
  completed_at: string;
  next_inspection_due?: string | null;
  recurrence_observed: number | boolean;
  days_until_next_incident?: number | null;
  before_image?: string | null;
  after_image?: string | null;
  created_at: string;
}

export interface StatusHistoryItem {
  id: number;
  shared_issue_id: number;
  old_status: string;
  new_status: string;
  changed_by_user_id: number;
  changed_by_name: string;
  changed_by_role: string;
  comments?: string | null;
  created_at: string;
}

export interface CitizenVerification {
  id: number;
  shared_issue_id: number;
  user_id: number;
  user_name: string;
  is_effective: number | boolean;
  feedback?: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  link_url?: string | null;
  is_read: number | boolean;
  created_at: string;
}

export interface DuplicateMatchItem {
  issueId: number;
  issueCode: string;
  title: string;
  category: string;
  status: IssueStatus;
  distanceMeters: number;
  textScore: number;
  distanceScore: number;
  matchingScore: number;
  isLikelyDuplicate: boolean;
  requiresUserConfirmation: boolean;
  issue: SharedIssue;
}

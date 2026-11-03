export type UserRole = 'citizen' | 'admin' | 'department_staff';

export interface User {
  id: string | number;
  name: string;
  email: string;
  role: UserRole;
  department_id?: string | number | null;
  department_name?: string | null;
  department_code?: string | null;
  phone?: string | null;
  created_at: string;
}

export interface Department {
  id: string | number;
  name: string;
  code: string;
  contact_email: string;
  sla_hours: number;
  staff_count?: number;
  active_issues_count?: number;
  created_at?: string;
}

export type HealthStatus = 'good' | 'monitoring' | 'warning' | 'critical';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface InfrastructureAsset {
  id: string | number;
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
  department_id?: string | number | null;
  department_name?: string | null;
  department_code?: string | null;
  is_demo?: boolean;
  total_citizen_reports?: number;
  unique_incidents_count?: number;
  repair_attempts_count?: number;
  last_repair_date?: string | null;
  created_at: string;
}

export type IssueStatus = 'Pending' | 'Assigned' | 'In Progress' | 'Resolved' | 'Reopened' | 'Escalated';
export type IssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface SharedIssue {
  id: string | number;
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
  department_id?: string | number | null;
  department_name?: string | null;
  department_code?: string | null;
  sla_hours?: number;
  infrastructure_id?: string | number | null;
  asset_name?: string | null;
  asset_code?: string | null;
  asset_health?: HealthStatus | null;
  asset_risk?: number | null;
  incident_id?: string | number | null;
  assigned_to_user_id?: string | number | null;
  assigned_staff_name?: string | null;
  estimated_affected_population: number;
  affected_population_details?: string | null;
  first_reported_at: string;
  latest_reported_at: string;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  resolution_type?: 'temporary' | 'permanent' | 'inspection_only' | 'no_fault' | null;
  is_merged_into_id?: string | number | null;
  citizen_reports_count?: number;
  primary_image?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CitizenReport {
  id: string | number;
  report_code: string;
  user_id: string | number;
  reporter_name?: string;
  reporter_email?: string;
  shared_issue_id?: string | number | null;
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
  id: string | number;
  report_id?: string | number | null;
  shared_issue_id?: string | number | null;
  repair_id?: string | number | null;
  image_url: string;
  caption?: string | null;
  image_type: 'evidence' | 'before_repair' | 'after_repair';
  created_at: string;
}

export interface InfrastructureIncident {
  id: string | number;
  incident_code: string;
  infrastructure_id: string | number;
  shared_issue_id?: string | number | null;
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
  id: string | number;
  repair_code: string;
  infrastructure_id: string | number;
  incident_id?: string | number | null;
  shared_issue_id?: string | number | null;
  repaired_by_user_id: string | number;
  repaired_by_name?: string;
  department_id: string | number;
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
  id: string | number;
  shared_issue_id: string | number;
  old_status: string;
  new_status: string;
  changed_by_user_id: string | number;
  changed_by_name: string;
  changed_by_role: string;
  comments?: string | null;
  created_at: string;
}

export interface CitizenVerification {
  id: string | number;
  shared_issue_id: string | number;
  user_id: string | number;
  user_name: string;
  is_effective: number | boolean;
  feedback?: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string | number;
  user_id: string | number;
  title: string;
  message: string;
  link_url?: string | null;
  is_read: number | boolean;
  created_at: string;
}

export interface DuplicateMatchItem {
  issueId: string | number;
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

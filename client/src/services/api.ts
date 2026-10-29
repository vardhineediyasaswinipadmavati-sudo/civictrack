import {
  User,
  SharedIssue,
  CitizenReport,
  InfrastructureAsset,
  NotificationItem,
  Department,
  DuplicateMatchItem
} from '../types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('civictrack_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Auth
  async login(email: string, password: string):Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res);
  },

  async register(data: { name: string; email: string; password: string; phone?: string }): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async getCurrentUser(): Promise<{ user: User; unreadNotificationsCount: number }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async forgotPassword(email: string): Promise<{
    message: string;
    email_service_configured?: boolean;
    notice?: string;
    required_env?: string[];
  }> {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleResponse(res);
  },

  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    const res = await fetch(`${API_BASE}/auth/validate-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    return handleResponse(res);
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    return handleResponse(res);
  },

  // Duplicate Check (Feature 1B)
  async checkDuplicate(params: {
    category: string;
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
  }): Promise<{ hasDuplicates: boolean; matches: DuplicateMatchItem[] }> {
    const res = await fetch(`${API_BASE}/reports/check-duplicate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params)
    });
    return handleResponse(res);
  },

  // Submit Report
  async submitReport(data: {
    title: string;
    category: string;
    description: string;
    severity?: string;
    latitude: number;
    longitude: number;
    address?: string;
    confirmedExistingIssueId?: number | null;
    isSafetyCritical?: boolean;
    imageUrls?: string[];
  }): Promise<{ message: string; reportId: number; sharedIssueId: number; issueCode: string; isNewSharedIssue: boolean }> {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async uploadImage(file: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', file);
    const token = localStorage.getItem('civictrack_token');
    const res = await fetch(`${API_BASE}/reports/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    return handleResponse(res);
  },

  // Reports
  async getReports(params?: { category?: string; status?: string; search?: string; mineOnly?: boolean }): Promise<CitizenReport[]> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.mineOnly) searchParams.set('mineOnly', 'true');

    const res = await fetch(`${API_BASE}/reports?${searchParams.toString()}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getReportById(id: number | string): Promise<CitizenReport> {
    const res = await fetch(`${API_BASE}/reports/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Shared Issues
  async getIssues(params?: {
    category?: string;
    status?: string;
    department_id?: number | string;
    priority?: string;
    search?: string;
    mineOnly?: boolean;
  }): Promise<SharedIssue[]> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.department_id) searchParams.set('department_id', String(params.department_id));
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.mineOnly) searchParams.set('mineOnly', 'true');

    const res = await fetch(`${API_BASE}/issues?${searchParams.toString()}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getNearbyIssues(lat: number, lon: number, radiusMeters = 1000): Promise<(SharedIssue & { distanceMeters: number })[]> {
    const res = await fetch(`${API_BASE}/issues/nearby?lat=${lat}&lon=${lon}&radiusMeters=${radiusMeters}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getIssueById(id: number | string): Promise<{
    issue: SharedIssue;
    citizenReports: CitizenReport[];
    images: any[];
    history: any[];
    repairs: any[];
    verifications: any[];
    followersCount: number;
    isFollowing?: boolean;
  }> {
    const res = await fetch(`${API_BASE}/issues/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async updateIssueStatus(id: number | string, data: { status: string; comments?: string; resolutionType?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/issues/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async assignIssue(id: number | string, data: { department_id?: number; assigned_to_user_id?: number; comments?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/issues/${id}/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async reopenIssue(id: number | string, reason: string): Promise<any> {
    const res = await fetch(`${API_BASE}/issues/${id}/reopen`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    return handleResponse(res);
  },

  async verifyResolution(id: number | string, is_effective: boolean, feedback?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/issues/${id}/verify-resolution`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ is_effective: is_effective ? 1 : 0, feedback })
    });
    return handleResponse(res);
  },

  async toggleFollowIssue(id: number | string): Promise<{ following: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/issues/${id}/follow`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async mergeIssues(targetId: number | string, sourceIssueId: number | string, reason?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/issues/${targetId}/merge`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sourceIssueId, reason })
    });
    return handleResponse(res);
  },

  async separateReport(sharedIssueId: number | string, reportId: number | string, reason?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/issues/${sharedIssueId}/separate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reportId, reason })
    });
    return handleResponse(res);
  },

  // Infrastructure
  async getInfrastructure(params?: { category?: string; health_status?: string; risk_level?: string; search?: string }): Promise<InfrastructureAsset[]> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.health_status) searchParams.set('health_status', params.health_status);
    if (params?.risk_level) searchParams.set('risk_level', params.risk_level);
    if (params?.search) searchParams.set('search', params.search);

    const res = await fetch(`${API_BASE}/infrastructure?${searchParams.toString()}`);
    return handleResponse(res);
  },

  async getInfrastructureById(id: number | string): Promise<{
    asset: InfrastructureAsset;
    stats: {
      totalCitizenReports: number;
      uniqueIncidentsCount: number;
      repairAttemptsCount: number;
      mtbfDays: number | null;
      totalRepairCost: number;
      unrecordedCostCount: number;
    };
    incidents: any[];
    repairs: any[];
    activeIssues: SharedIssue[];
    timeline: any[];
  }> {
    const res = await fetch(`${API_BASE}/infrastructure/${id}`);
    return handleResponse(res);
  },

  async recordRepair(assetId: number | string, data: {
    shared_issue_id?: number | null;
    incident_id?: number | null;
    department_id?: number;
    repair_type: string;
    cost_amount?: number | null;
    cost_unavailable?: boolean;
    materials_used?: string;
    work_summary: string;
    before_image_url?: string;
    after_image_url?: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/infrastructure/${assetId}/repairs`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  // Analytics
  async getAnalyticsOverview(): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/overview`);
    return handleResponse(res);
  },

  async getRepairEffectiveness(): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/repair-effectiveness`);
    return handleResponse(res);
  },

  async getMaintenanceWaste(): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/maintenance-waste`);
    return handleResponse(res);
  },

  async getSeasonalTrends(): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/seasonal-trends`);
    return handleResponse(res);
  },

  async getDepartmentPerformance(): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/department-performance`);
    return handleResponse(res);
  },

  async getInfrastructureRisk(): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/infrastructure-risk`);
    return handleResponse(res);
  },

  // Departments
  async getDepartments(): Promise<Department[]> {
    const res = await fetch(`${API_BASE}/departments`);
    return handleResponse(res);
  },

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async markNotificationRead(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async markAllNotificationsRead(): Promise<any> {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  }
};

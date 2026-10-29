import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { SharedIssue, Department } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { MergeIssuesModal } from '../components/MergeIssuesModal';
import {
  ShieldAlert,
  GitMerge,
  Clock,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  Activity,
  UserCheck,
  RefreshCw,
  FileText
} from 'lucide-react';
import { formatIndianNumber } from '../utils/currency';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [issues, setIssues] = useState<SharedIssue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [mergeTarget, setMergeTarget] = useState<SharedIssue | null>(null);
  const [assignIssue, setAssignIssue] = useState<SharedIssue | null>(null);
  const [assignDeptId, setAssignDeptId] = useState<number | ''>('');
  const [assigning, setAssigning] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, allIssues, depts] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getIssues(),
        api.getDepartments()
      ]);
      setStats(overview);
      setIssues(allIssues || []);
      setDepartments(depts || []);
    } catch (err: any) {
      console.error('Failed to load admin dashboard', err);
      setError(err?.message || 'Failed to fetch administrator metrics and issues from municipal server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignIssue || !assignDeptId) return;
    setAssigning(true);
    try {
      await api.assignIssue(assignIssue.id, { department_id: Number(assignDeptId) });
      setAssignIssue(null);
      await loadData();
    } catch (err: any) {
      console.error('Assign error', err);
      alert(err?.message || 'Failed to assign department.');
    } finally {
      setAssigning(false);
    }
  };

  const filteredIssues = issues.filter((i) => {
    const term = search.toLowerCase();
    const matchesSearch = !search ||
      i.title.toLowerCase().includes(term) ||
      i.issue_code.toLowerCase().includes(term) ||
      (i.address && i.address.toLowerCase().includes(term));
    const matchesCat = !selectedCategory || i.category === selectedCategory;
    const matchesStat = !selectedStatus || i.status === selectedStatus;
    return matchesSearch && matchesCat && matchesStat;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Bhimavaram Municipal Command Center</span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
              Demonstration Environment
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Administrator Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Monitor unified civic issues across Bhimavaram, consolidate duplicate reports, track infrastructure degradation, and enforce department SLAs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/analytics"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4 text-civic-400" /> Lifecycle Analytics
          </Link>
          <Link
            to="/map"
            className="px-4 py-2.5 rounded-xl bg-civic-600 hover:bg-civic-500 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
          >
            <Activity className="w-4 h-4" /> Live Health Map
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-civic-50 text-civic-600 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Loading Operations Command Data</h3>
            <p className="text-xs text-slate-500 mt-1">Retrieving verified municipal issues, consolidation ratios, and department workloads...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-rose-900 text-base">Unable to Load Operations Dashboard</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Loading Dashboard</span>
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* KPI Cards - Real backend metrics without fabricated defaults */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Citizen Reports</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {formatIndianNumber(stats?.totalCitizenReports ?? 0)}
              </p>
              <span className="text-[10px] text-slate-400">Total verified submissions</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-civic-600 uppercase">Unique Issues</p>
              <p className="text-2xl font-extrabold text-civic-700 mt-1">
                {formatIndianNumber(stats?.uniqueCivicIssues ?? 0)}
              </p>
              <span className="text-[10px] text-civic-600 font-medium">Distinct physical tickets</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-indigo-600 uppercase">Consolidation</p>
              <p className="text-2xl font-extrabold text-indigo-700 mt-1">
                {stats?.consolidationRatio ? `${stats.consolidationRatio}x` : '1.0x'}
              </p>
              <span className="text-[10px] text-slate-400">Reports per master issue</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-amber-600 uppercase">Recurring Incidents</p>
              <p className="text-2xl font-extrabold text-amber-700 mt-1">
                {formatIndianNumber(stats?.recurringIncidentsCount ?? 0)}
              </p>
              <span className="text-[10px] text-slate-400">Repeat failure cycles</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-rose-600 uppercase">High-Risk Assets</p>
              <p className="text-2xl font-extrabold text-rose-700 mt-1">
                {formatIndianNumber(stats?.highRiskAssets ?? 0)}
              </p>
              <span className="text-[10px] text-slate-400">Preventive review needed</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[11px] font-semibold text-purple-600 uppercase">Overdue SLA</p>
              <p className="text-2xl font-extrabold text-purple-700 mt-1">
                {formatIndianNumber(stats?.escalatedIssues ?? 0)}
              </p>
              <span className="text-[10px] text-rose-500 font-semibold">Target hours exceeded</span>
            </div>
          </div>

          {/* Potential Duplicate & Merge Alert Banner */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200/80 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600 text-white shrink-0 mt-0.5 shadow-sm">
                <GitMerge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Duplicate Review & Master Issue Consolidation
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-3xl">
                  Authorized administrators can consolidate duplicate reports into master records while maintaining an immutable audit log, preserving each citizen's evidence, photos, and timestamps.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-purple-700 bg-white px-3 py-1.5 rounded-xl border border-purple-200 shadow-sm shrink-0 text-center">
              Consolidation Audit Active
            </span>
          </div>

          {/* Main Issue Management Section */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Master Civic Issue Inventory</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidated civic tickets with linked reporter counts, priority metrics, and department assignments in Bhimavaram
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search issues, address, code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-civic-500"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700"
                >
                  <option value="">All Categories</option>
                  <option value="Roads and potholes">Roads and potholes</option>
                  <option value="Streetlights and electrical infrastructure">Streetlights & Electrical</option>
                  <option value="Water supply and leakage">Water Supply</option>
                  <option value="Drainage and sewage">Drainage and sewage</option>
                  <option value="Solid Waste and Sanitation">Garbage & Sanitation</option>
                </select>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700"
                >
                  <option value="">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Escalated">Escalated</option>
                </select>
              </div>
            </div>

            {issues.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-800 text-sm">No Civic Issues Recorded</h3>
                <p>There are currently no active civic issues in the municipal database.</p>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No civic issues match your search or filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5">Master Code</th>
                      <th className="px-6 py-3.5">Issue Title & Category</th>
                      <th className="px-6 py-3.5">Location & Asset</th>
                      <th className="px-6 py-3.5">Linked Reports</th>
                      <th className="px-6 py-3.5">Priority Score</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Department</th>
                      <th className="px-6 py-3.5 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredIssues.map((issue) => (
                      <tr key={issue.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {issue.issue_code}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            to={`/issues/${issue.id}`}
                            className="font-bold text-slate-900 hover:text-civic-600 block max-w-xs truncate"
                          >
                            {issue.title}
                          </Link>
                          <span className="text-[11px] text-slate-500">{issue.category}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-900 max-w-xs truncate font-medium">{issue.address}</div>
                          {issue.asset_code && (
                            <Link
                              to={`/infrastructure/${issue.infrastructure_id}`}
                              className="text-[11px] text-civic-700 font-mono hover:underline"
                            >
                              Asset: {issue.asset_code}
                            </Link>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                            {issue.citizen_reports_count || 1} report{(issue.citizen_reports_count || 1) > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <PriorityBadge score={issue.priority_score} isSafetyCritical={issue.is_safety_critical} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={issue.status} size="sm" />
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-800">
                            {issue.department_name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => { setAssignIssue(issue); setAssignDeptId(issue.department_id || ''); }}
                              className="p-1.5 text-slate-600 hover:text-civic-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Reassign Department"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setMergeTarget(issue)}
                              className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Merge duplicate into this issue"
                            >
                              <GitMerge className="w-4 h-4" />
                            </button>
                            <Link
                              to={`/issues/${issue.id}`}
                              className="px-2.5 py-1 text-xs font-semibold text-civic-600 hover:bg-civic-50 rounded-lg transition-colors inline-flex items-center gap-1"
                            >
                              Details <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Assign Modal */}
      {assignIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Assign Department for {assignIssue.issue_code}
            </h3>
            <p className="text-slate-500 mb-4">{assignIssue.title}</p>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Responsible Municipal Department</label>
                <select
                  required
                  value={assignDeptId}
                  onChange={(e) => setAssignDeptId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code} - SLA: {d.sla_hours}h)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignIssue(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-4 py-2 bg-civic-600 text-white rounded-xl font-bold hover:bg-civic-700 transition-colors shadow-sm"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeTarget && (
        <MergeIssuesModal
          targetIssue={mergeTarget}
          onSuccess={async () => {
            setMergeTarget(null);
            await loadData();
          }}
          onClose={() => setMergeTarget(null)}
        />
      )}
    </div>
  );
};

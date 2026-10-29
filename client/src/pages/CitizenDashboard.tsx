import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { CitizenReport, SharedIssue } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Calendar,
  ArrowRight,
  BookmarkCheck,
  Search,
  Filter,
  Users,
  RefreshCw,
  Compass,
  AlertTriangle
} from 'lucide-react';

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [followedIssues, setFollowedIssues] = useState<SharedIssue[]>([]);
  const [communityIssues, setCommunityIssues] = useState<SharedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [myReports, myTrackedIssues, allIssues] = await Promise.all([
        api.getReports({ mineOnly: true }),
        api.getIssues({ mineOnly: true }),
        api.getIssues()
      ]);

      setReports(myReports || []);
      setFollowedIssues(myTrackedIssues || []);
      // Filter community issues to show others in Bhimavaram (not already followed)
      const myTrackedIds = new Set((myTrackedIssues || []).map((i) => i.id));
      const discoverable = (allIssues || []).filter((i) => !myTrackedIds.has(i.id)).slice(0, 4);
      setCommunityIssues(discoverable);
    } catch (err: any) {
      console.error('Failed to load citizen dashboard data', err);
      setError(err?.message || 'Failed to load your citizen dashboard. Please verify municipal server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const totalReports = reports.length;
  const pendingReports = reports.filter((r) => (r.shared_status || r.status) === 'Pending').length;
  const inProgressReports = reports.filter((r) => ['Assigned', 'In Progress', 'Escalated'].includes(r.shared_status || r.status)).length;
  const resolvedReports = reports.filter((r) => (r.shared_status || r.status) === 'Resolved').length;

  const filteredReports = reports.filter((r) => {
    const term = search.toLowerCase();
    const matchesSearch = !search ||
      r.title.toLowerCase().includes(term) ||
      r.report_code.toLowerCase().includes(term) ||
      (r.address && r.address.toLowerCase().includes(term));
    const effectiveStatus = r.shared_status || r.status;
    const matchesStatus = !statusFilter || effectiveStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-civic-900 via-civic-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-civic-500/20 text-civic-300 text-xs font-semibold mb-2">
            <span>Citizen Operations Hub • Bhimavaram Dataset</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name || user?.email || 'Citizen'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Track your submitted civic complaints, monitor municipal repair progress, and follow shared infrastructure issues in Bhimavaram.
          </p>
        </div>

        <Link
          to="/report"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-civic-500 hover:bg-civic-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-civic-500/30 transition-all hover:scale-105 active:scale-95 shrink-0"
        >
          <PlusCircle className="w-5 h-5" /> Report a Civic Issue
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-civic-50 text-civic-600 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Loading Your Citizen Dashboard</h3>
            <p className="text-xs text-slate-500 mt-1">Retrieving your complaints, tracked issues, and municipal progress updates...</p>
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
            <h3 className="font-bold text-rose-900 text-base">Unable to Load Dashboard</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <button
            onClick={loadDashboardData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Loading Dashboard</span>
          </button>
        </div>
      )}

      {/* Dashboard Content */}
      {!loading && !error && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">My Reports Submitted</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalReports}</p>
              <span className="text-[11px] text-slate-400">Total verified submissions</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-amber-600">Pending Review</p>
              <p className="text-2xl font-extrabold text-amber-700 mt-1">{pendingReports}</p>
              <span className="text-[11px] text-slate-400">Awaiting department triage</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-indigo-600">In Remediation</p>
              <p className="text-2xl font-extrabold text-indigo-700 mt-1">{inProgressReports}</p>
              <span className="text-[11px] text-slate-400">Work crews dispatched</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-emerald-600">Resolved</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">{resolvedReports}</p>
              <span className="text-[11px] text-slate-400">Repairs completed & verified</span>
            </div>
          </div>

          {/* Followed & Reported Shared Civic Issues (Section 5 Feature 1E) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookmarkCheck className="w-5 h-5 text-civic-600" />
                  <span>Tracked Shared Civic Issues</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Master civic tickets you reported or subscribed to for synchronized updates in Bhimavaram
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {followedIssues.length} tracked
              </span>
            </div>

            {followedIssues.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                <BookmarkCheck className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="max-w-md mx-auto">
                  <p className="font-semibold text-slate-700 text-sm">No Tracked Shared Issues</p>
                  <p className="text-slate-500 text-xs mt-1">
                    You are not currently following any shared issues. When you submit a complaint or click "Follow Issue" on any public report in Bhimavaram, live repair updates and photo verifications will appear here.
                  </p>
                </div>
                <div className="pt-1 flex items-center justify-center gap-3">
                  <Link
                    to="/report"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <PlusCircle className="w-4 h-4" /> Report an Issue
                  </Link>
                  <Link
                    to="/map"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
                  >
                    <Compass className="w-4 h-4 text-civic-600" /> Explore Public Map
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {followedIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.id}`}
                    className="p-5 rounded-2xl border border-slate-200 hover:border-civic-400 hover:shadow-md transition-all group bg-white flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {issue.issue_code}
                        </span>
                        <StatusBadge status={issue.status} size="sm" />
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-civic-600 transition-colors line-clamp-1">
                        {issue.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" /> {issue.address}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-civic-600" /> {issue.citizen_reports_count || 1} community reports
                      </span>
                      <span className="text-civic-600 font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                        View Progress <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* My Submitted Reports Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">My Complaint Submissions</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Original citizen records preserved with individual photos, geolocation, and timestamps
                </p>
              </div>

              {reports.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search my reports..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-civic-500"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700"
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Reopened">Reopened</option>
                  </select>
                </div>
              )}
            </div>

            {reports.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-3 bg-slate-50/50">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="max-w-md mx-auto">
                  <h3 className="font-bold text-slate-800 text-sm">No Complaint Submissions Recorded</h3>
                  <p className="text-slate-500 text-xs mt-1">
                    You have not registered any civic complaints under this account ({user?.email}). If you notice damaged roads, broken streetlights, or drainage overflow in Bhimavaram, submit a report to alert municipal crews.
                  </p>
                </div>
                <div>
                  <Link
                    to="/report"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <PlusCircle className="w-4 h-4" /> Report Issue Now
                  </Link>
                </div>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No complaints match your search or filter criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5">Report Ref</th>
                      <th className="px-6 py-3.5">Issue Title & Category</th>
                      <th className="px-6 py-3.5">Location</th>
                      <th className="px-6 py-3.5">Master Issue</th>
                      <th className="px-6 py-3.5">Current Status</th>
                      <th className="px-6 py-3.5">Submitted</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredReports.map((r) => {
                      const effectiveStatus = r.shared_status || r.status;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-slate-900">{r.report_code}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900 max-w-xs truncate">{r.title}</div>
                            <div className="text-[11px] text-slate-500">{r.shared_category || r.category}</div>
                          </td>
                          <td className="px-6 py-4 max-w-xs truncate text-slate-600">{r.address}</td>
                          <td className="px-6 py-4">
                            {r.issue_code ? (
                              <Link
                                to={`/issues/${r.shared_issue_id}`}
                                className="font-mono text-xs font-bold text-civic-700 hover:underline inline-flex items-center gap-1"
                              >
                                {r.issue_code}
                                <span className="text-[10px] font-medium text-slate-500 font-sans">
                                  ({r.link_type === 'confirmed_duplicate' ? 'Joined' : 'Original'})
                                </span>
                              </Link>
                            ) : (
                              <span className="text-slate-400 italic">Unlinked</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={effectiveStatus} size="sm" />
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.shared_issue_id && (
                              <Link
                                to={`/issues/${r.shared_issue_id}`}
                                className="px-2.5 py-1 text-xs font-semibold text-civic-600 hover:text-civic-800 hover:bg-civic-50 rounded-lg inline-flex items-center gap-1"
                              >
                                Details <ArrowRight className="w-3 h-3" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Community Issues in Bhimavaram to Discover */}
          {communityIssues.length > 0 && (
            <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-civic-600" />
                    <span>Explore Community Issues in Bhimavaram</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Other issues reported nearby that you can inspect or follow for synchronized alerts
                  </p>
                </div>
                <Link
                  to="/map"
                  className="text-xs font-bold text-civic-600 hover:underline inline-flex items-center gap-1"
                >
                  View Health Map <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {communityIssues.map((ci) => (
                  <Link
                    key={ci.id}
                    to={`/issues/${ci.id}`}
                    className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-civic-400 hover:shadow-sm transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                          {ci.issue_code}
                        </span>
                        <StatusBadge status={ci.status} size="sm" />
                      </div>
                      <h4 className="font-semibold text-xs text-slate-900 group-hover:text-civic-600 line-clamp-1">
                        {ci.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {ci.address}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-civic-600 font-semibold">
                      <span>{ci.citizen_reports_count || 1} report{(ci.citizen_reports_count || 1) > 1 ? 's' : ''}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">Inspect &rarr;</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

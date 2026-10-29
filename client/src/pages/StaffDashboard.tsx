import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { SharedIssue, InfrastructureAsset } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { RecordRepairModal } from '../components/RecordRepairModal';
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Building2,
  MapPin,
  Calendar,
  Layers,
  History,
  FileText,
  RefreshCw,
  Search
} from 'lucide-react';
import { formatIndianNumber } from '../utils/currency';

export const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<SharedIssue[]>([]);
  const [assets, setAssets] = useState<InfrastructureAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [search, setSearch] = useState('');

  // Repair Modal
  const [activeRepairIssue, setActiveRepairIssue] = useState<SharedIssue | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // If user has a department_id, filter by department_id
      const [allIssues, allAssets] = await Promise.all([
        api.getIssues({ department_id: user?.department_id || undefined }),
        api.getInfrastructure()
      ]);
      setIssues(allIssues || []);
      setAssets(allAssets || []);
    } catch (err: any) {
      console.error('Staff dashboard load error', err);
      setError(err?.message || 'Failed to fetch department work orders from municipal server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const activeWorkOrders = issues.filter((i) => i.status !== 'Resolved');
  const completedWorkOrders = issues.filter((i) => i.status === 'Resolved');

  const displayedIssues = (tab === 'active' ? activeWorkOrders : completedWorkOrders).filter((i) => {
    const term = search.toLowerCase();
    return !search ||
      i.title.toLowerCase().includes(term) ||
      i.issue_code.toLowerCase().includes(term) ||
      (i.address && i.address.toLowerCase().includes(term));
  });

  const departmentTitle = user?.department_name ||
    (user?.department_id ? `Department #${user.department_id}` : 'Municipal Department Operations');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-civic-500/20 text-civic-300 text-xs font-semibold">
              <Wrench className="w-3.5 h-3.5 text-civic-400" />
              <span>Field Engineering & Maintenance Triage</span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
              Bhimavaram Dataset (Demonstration)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Department Work Orders
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Department: <strong>{departmentTitle}</strong>. Dispatch maintenance crews, log temporary patches vs permanent reconstructions, and submit verification evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/infrastructure"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <History className="w-4 h-4 text-civic-400" /> Monitored Assets
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
            <h3 className="font-bold text-slate-800 text-base">Loading Department Work Orders</h3>
            <p className="text-xs text-slate-500 mt-1">Retrieving assigned maintenance tickets and infrastructure status...</p>
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
            <h3 className="font-bold text-rose-900 text-base">Unable to Load Department Tickets</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Loading Work Orders</span>
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Total Work Orders</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {formatIndianNumber(issues.length)}
              </p>
              <span className="text-[11px] text-slate-400">Assigned to department</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-amber-600">Active Work Orders</p>
              <p className="text-2xl font-extrabold text-amber-700 mt-1">
                {formatIndianNumber(activeWorkOrders.length)}
              </p>
              <span className="text-[11px] text-slate-400">Investigation / repair required</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-rose-600">Urgent Safety Flags</p>
              <p className="text-2xl font-extrabold text-rose-700 mt-1">
                {formatIndianNumber(issues.filter((i) => i.is_safety_critical && i.status !== 'Resolved').length)}
              </p>
              <span className="text-[11px] text-slate-400">Immediate hazard intervention</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-emerald-600">Completed Repairs</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                {formatIndianNumber(completedWorkOrders.length)}
              </p>
              <span className="text-[11px] text-slate-400">Verified & logged</span>
            </div>
          </div>

          {/* Work Orders Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Department Maintenance Inventory</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Work orders assigned to {departmentTitle} in Bhimavaram
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Tabs */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                  <button
                    onClick={() => setTab('active')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      tab === 'active'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Active Work Orders ({activeWorkOrders.length})
                  </button>
                  <button
                    onClick={() => setTab('completed')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      tab === 'completed'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Completed ({completedWorkOrders.length})
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-civic-500"
                  />
                </div>
              </div>
            </div>

            {displayedIssues.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2 bg-slate-50/50">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-800 text-sm">
                  {tab === 'active' ? 'No Active Work Orders' : 'No Completed Repairs'}
                </h3>
                <p className="max-w-md mx-auto text-slate-500">
                  {tab === 'active'
                    ? `No active tickets are currently assigned to ${departmentTitle}. When issues are assigned by municipal administrators, they will appear here.`
                    : 'No completed repair orders recorded under this department yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5">Master Ticket</th>
                      <th className="px-6 py-3.5">Issue Title</th>
                      <th className="px-6 py-3.5">Target Asset</th>
                      <th className="px-6 py-3.5">Linked Citizens</th>
                      <th className="px-6 py-3.5">Priority</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {displayedIssues.map((issue) => (
                      <tr key={issue.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-slate-900">
                          <span className="bg-slate-100 px-2 py-0.5 rounded">{issue.issue_code}</span>
                        </td>
                        <td className="px-6 py-4">
                          <Link to={`/issues/${issue.id}`} className="font-bold text-slate-900 hover:text-civic-600 block max-w-xs truncate">
                            {issue.title}
                          </Link>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" /> {issue.address}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {issue.asset_code ? (
                            <Link to={`/infrastructure/${issue.infrastructure_id}`} className="font-mono text-xs text-civic-700 hover:underline">
                              {issue.asset_code}
                            </Link>
                          ) : (
                            <span className="text-slate-400 italic">No asset linked</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                            {issue.citizen_reports_count || 1} report{(issue.citizen_reports_count || 1) > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <PriorityBadge score={issue.priority_score} isSafetyCritical={issue.is_safety_critical} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={issue.status} size="sm" />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {issue.status !== 'Resolved' && (
                              <button
                                onClick={() => setActiveRepairIssue(issue)}
                                className="px-3 py-1.5 bg-civic-600 hover:bg-civic-700 text-white font-bold rounded-xl shadow-sm transition-all text-xs inline-flex items-center gap-1.5"
                              >
                                <Wrench className="w-3.5 h-3.5" />
                                <span>Complete Repair</span>
                              </button>
                            )}
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

      {/* Record Repair Modal */}
      {activeRepairIssue && (
        <RecordRepairModal
          assetId={activeRepairIssue.infrastructure_id || 1}
          assetName={activeRepairIssue.title}
          sharedIssueId={activeRepairIssue.id}
          incidentId={activeRepairIssue.incident_id || null}
          onSuccess={async () => {
            setActiveRepairIssue(null);
            await loadData();
          }}
          onClose={() => setActiveRepairIssue(null)}
        />
      )}
    </div>
  );
};

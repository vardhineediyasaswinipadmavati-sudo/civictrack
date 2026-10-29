import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { InfrastructureAsset, SharedIssue } from '../types';
import { RiskBadge, HealthStatusBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { RecordRepairModal } from '../components/RecordRepairModal';
import { formatINR } from '../utils/currency';
import {
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  History,
  Wrench,
  IndianRupee,
  TrendingDown,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Camera,
  Activity,
  CheckCircle2,
  Clock,
  Layers
} from 'lucide-react';

export const InfrastructureDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<{
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
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [showRepairModal, setShowRepairModal] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      const res = await api.getInfrastructureById(id);
      setData(res);
    } catch (err) {
      console.error('Failed to load asset profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading asset failure history...</div>;
  }

  if (!data) {
    return <div className="p-12 text-center text-xs text-rose-500">Asset not found.</div>;
  }

  const { asset, stats, incidents, repairs, activeIssues, timeline } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <button
        type="button"
        onClick={() => {
          if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
          } else {
            navigate('/infrastructure');
          }
        }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to previous page</span>
      </button>

      {/* Asset Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-extrabold px-3 py-1 rounded-xl bg-slate-900 text-white">
              {asset.asset_code}
            </span>
            <HealthStatusBadge status={asset.current_health_status} />
            <RiskBadge level={asset.risk_level} score={asset.risk_score} />
          </div>

          {(user?.role === 'admin' || user?.role === 'department_staff') && (
            <button
              onClick={() => setShowRepairModal(true)}
              className="px-4 py-2.5 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold text-xs shadow transition-all flex items-center gap-1.5"
            >
              <Wrench className="w-4 h-4" /> Log Maintenance / Repair
            </button>
          )}
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {asset.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{asset.category}</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-slate-400" /> {asset.address}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-slate-400" /> Commissioned {asset.installation_date}
            </span>
          </div>
        </div>

        {/* Diagnostic Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Citizen Reports</span>
            <p className="text-xl font-bold text-slate-900 mt-1">{stats.totalCitizenReports}</p>
            <span className="text-[10px] text-slate-400">Total community complaints</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Distinct Incidents</span>
            <p className="text-xl font-bold text-amber-600 mt-1">{stats.uniqueIncidentsCount}</p>
            <span className="text-[10px] text-slate-400">Physical failure cycles</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Repair Attempts</span>
            <p className="text-xl font-bold text-indigo-600 mt-1">{stats.repairAttemptsCount}</p>
            <span className="text-[10px] text-slate-400">Maintenance interventions</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Average MTBF</span>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {stats.mtbfDays ? `${stats.mtbfDays} days` : 'N/A'}
            </p>
            <span className="text-[10px] text-slate-400">Mean Time Between Failures</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500 font-medium">Total Repair Spend</span>
            <p className="text-xl font-bold text-emerald-700 mt-1">
              {formatINR(stats.totalRepairCost)}
            </p>
            <span className="text-[10px] text-slate-400">
              {stats.unrecordedCostCount > 0 ? `(${stats.unrecordedCostCount} records unpriced)` : 'Cumulative ledger'}
            </span>
          </div>
        </div>

        {/* Explainable Risk Indicators (Section 5 Feature 6) */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Rule-Based Risk Score Diagnostic ({asset.risk_score}/100 - {asset.risk_level} Risk)</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
            {asset.risk_reasons && asset.risk_reasons.map((reason, idx) => (
              <li key={idx} className="leading-relaxed">{reason}</li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 italic pt-1">
            * Note: Statistics are strictly derived from stored municipal records. Duplicate citizen reports do not artificially inflate infrastructure failure counts.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Unified Chronological Timeline (Section 5 Feature 3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-civic-600" />
                  Chronological Incident & Repair Lifecycle History
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Full chronological ledger tracking failures, recurrence cycles, temporary patches, and permanent repairs
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {timeline.length} Events
              </span>
            </div>

            <div className="relative pl-8 space-y-6 border-l-2 border-slate-200 text-xs">
              {timeline.map((item, idx) => (
                <div key={idx} className="relative group">
                  {/* Dot */}
                  <div
                    className={`absolute -left-[41px] top-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow ${
                      item.type === 'incident' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {item.type === 'incident' ? <AlertTriangle className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                  </div>

                  {/* Card */}
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      item.type === 'incident'
                        ? 'border-amber-200 bg-amber-50/30'
                        : 'border-emerald-200 bg-emerald-50/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                          {item.code}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{item.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <p className="mt-1.5 text-slate-700 leading-relaxed font-normal">
                      {item.description}
                    </p>

                    {item.type === 'repair' && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span><strong>Department:</strong> {item.department}</span>
                        {item.materials && <span><strong>Materials:</strong> {item.materials}</span>}
                        <span>
                          <strong>Cost:</strong>{' '}
                          {item.costUnavailable ? 'Cost data unavailable' : formatINR(item.cost)}
                        </span>
                        {item.daysUntilNextIncident && (
                          <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Failure recurred in {item.daysUntilNextIncident} days
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Active Issues & Photos */}
        <div className="space-y-6">
          {/* Active Civic Complaints */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-civic-600" />
              Active Tickets on this Asset ({activeIssues.length})
            </h3>
            {activeIssues.length === 0 ? (
              <p className="text-slate-400 italic">No unresolved tickets currently open on this asset.</p>
            ) : (
              <div className="space-y-3">
                {activeIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.id}`}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-civic-400 block transition-all bg-slate-50/50 hover:bg-white group"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono font-bold text-slate-800">{issue.issue_code}</span>
                      <StatusBadge status={issue.status} size="sm" />
                    </div>
                    <p className="font-semibold text-slate-900 group-hover:text-civic-600 transition-colors line-clamp-1">
                      {issue.title}
                    </p>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {issue.citizen_reports_count || 1} linked reports
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Repair Modal */}
      {showRepairModal && (
        <RecordRepairModal
          assetId={asset.id}
          assetName={asset.name}
          onSuccess={async () => {
            setShowRepairModal(false);
            await loadData();
          }}
          onClose={() => setShowRepairModal(false)}
        />
      )}
    </div>
  );
};

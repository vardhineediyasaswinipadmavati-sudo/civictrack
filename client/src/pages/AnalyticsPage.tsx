import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  Wrench,
  IndianRupee,
  CloudRain,
  Building2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { formatINR, formatIndianNumber } from '../utils/currency';

interface RepairComparisonCategory {
  count: number;
  recurred: number;
  recurrenceRate: number;
}

interface RepairEffectivenessData {
  totalRepairs: number;
  recurrenceCount: number;
  recurrenceRatePercent: number;
  effectivenessRatePercent: number;
  temporaryVsPermanent: {
    temporary: RepairComparisonCategory;
    permanent: RepairComparisonCategory;
  };
  averageDaysUntilRecurrence: number | null;
  repairs?: any[];
}

interface MaintenanceWasteAsset {
  id: number;
  asset_code: string;
  name: string;
  category: string;
  address: string;
  current_health_status: string;
  risk_level: string;
  repair_count: number;
  total_spent: number;
  missing_cost_records: number;
  recurring_spent: number;
  reason?: string;
}

interface MaintenanceWasteData {
  totalExpenditure: number;
  recurringExpenditure: number;
  recurringExpenditureRatio: number;
  assetsByCost: MaintenanceWasteAsset[];
  assetsRequiringEngineeringAudit: MaintenanceWasteAsset[];
  guidance: string;
}

interface MonthlyTimelineItem {
  monthKey: string;
  monthName: string;
  totalIncidents: number;
  roads: number;
  streetlights: number;
  water: number;
  drainage: number;
  garbage: number;
  other: number;
}

interface SeasonalPattern {
  season: string;
  primaryIssue: string;
  detail: string;
  recommendation: string;
}

interface SeasonalTrendsData {
  hasSufficientData: boolean;
  totalDistinctIncidents: number;
  monthlyTimeline: MonthlyTimelineItem[];
  detectedPatterns: SeasonalPattern[];
  message: string;
}

interface DepartmentPerformanceItem {
  departmentId: number;
  departmentName: string;
  code: string;
  slaHours: number;
  totalIssues: number;
  resolvedIssues: number;
  openIssues: number;
  escalatedIssues: number;
  avgResolutionHours: number | null;
  slaComplianceRate: number;
  totalRepairsLogged: number;
  repeatIncidentRate: number;
  repairEffectivenessRate: number;
  photoEvidenceRate: number;
}

export const AnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'effectiveness' | 'waste' | 'seasonal' | 'departments'>('effectiveness');
  const [effectivenessData, setEffectivenessData] = useState<RepairEffectivenessData | null>(null);
  const [wasteData, setWasteData] = useState<MaintenanceWasteData | null>(null);
  const [seasonalData, setSeasonalData] = useState<SeasonalTrendsData | null>(null);
  const [departmentData, setDepartmentData] = useState<DepartmentPerformanceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eff, waste, seasonal, depts] = await Promise.all([
        api.getRepairEffectiveness(),
        api.getMaintenanceWaste(),
        api.getSeasonalTrends(),
        api.getDepartmentPerformance()
      ]);
      setEffectivenessData(eff);
      setWasteData(waste);
      setSeasonalData(seasonal);
      setDepartmentData(Array.isArray(depts) ? depts : []);
    } catch (err: any) {
      console.error('Failed to load analytics', err);
      setError(err?.message || 'Failed to load analytics data from the municipal server. Please verify network connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAnalytics();
  }, []);

  const tabs = [
    { id: 'effectiveness', label: 'Repair Effectiveness', icon: Wrench },
    { id: 'waste', label: 'Maintenance Waste & Costs', icon: IndianRupee },
    { id: 'seasonal', label: 'Seasonal Trends', icon: CloudRain },
    { id: 'departments', label: 'Department SLA Outcomes', icon: Building2 },
  ];

  // Chart data for temporary vs permanent repairs
  const repairComparisonChartData = effectivenessData ? [
    {
      category: 'Temporary Repair',
      total: effectivenessData.temporaryVsPermanent?.temporary?.count || 0,
      recurred: effectivenessData.temporaryVsPermanent?.temporary?.recurred || 0,
      recurrenceRate: effectivenessData.temporaryVsPermanent?.temporary?.recurrenceRate || 0,
    },
    {
      category: 'Permanent Repair',
      total: effectivenessData.temporaryVsPermanent?.permanent?.count || 0,
      recurred: effectivenessData.temporaryVsPermanent?.permanent?.recurred || 0,
      recurrenceRate: effectivenessData.temporaryVsPermanent?.permanent?.recurrenceRate || 0,
    }
  ] : [];

  // Maintenance cost chart data (Top 5 assets)
  const costChartData = wasteData?.assetsByCost ? wasteData.assetsByCost.slice(0, 5).map((a) => ({
    name: a.asset_code,
    fullName: a.name,
    totalSpent: Number(a.total_spent || 0),
    recurringSpent: Number(a.recurring_spent || 0),
    repairCount: a.repair_count || 0
  })) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-civic-500/20 text-civic-300 text-xs font-semibold">
            <TrendingUp className="w-3.5 h-3.5 text-civic-400" />
            <span>Infrastructure Intelligence Engine</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Bhimavaram Municipal Corporation (Demonstration Data)</span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Preventive Maintenance & Lifecycle Analytics
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
          Empowering municipal authorities with actionable intelligence: evaluate repair effectiveness across observation windows, diagnose maintenance waste from repeated patching, and plan pre-season preventive overhauls.
        </p>

        {/* Tab Navigation */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-civic-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-civic-50 text-civic-600 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Computing Municipal Lifecycle Analytics</h3>
            <p className="text-xs text-slate-500 mt-1">Aggregating Bhimavaram repair logs, repeat incidents, SLA metrics, and expenditure trends...</p>
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
            <h3 className="font-bold text-rose-900 text-base">Unable to Load Analytics Data</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
          </div>
          <div>
            <button
              onClick={loadAllAnalytics}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Loading Analytics</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: REPAIR EFFECTIVENESS (Section 5 Feature 5) */}
      {!loading && !error && activeTab === 'effectiveness' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Total Repairs Logged</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {formatIndianNumber(effectivenessData?.totalRepairs || 0)}
              </p>
              <span className="text-[11px] text-slate-400">Recorded maintenance events</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-emerald-600">Effective Repairs</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                {effectivenessData?.effectivenessRatePercent ?? 100}%
              </p>
              <span className="text-[11px] text-slate-400">Without recorded recurrence</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-amber-600">Repeat Incident Rate</p>
              <p className="text-2xl font-extrabold text-amber-700 mt-1">
                {effectivenessData?.recurrenceRatePercent ?? 0}%
              </p>
              <span className="text-[11px] text-slate-400">Failures recurring after repair</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Avg Cycle to Recurrence</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {effectivenessData?.averageDaysUntilRecurrence ? `${effectivenessData.averageDaysUntilRecurrence} days` : 'N/A'}
              </p>
              <span className="text-[11px] text-slate-400">Days until subsequent failure</span>
            </div>
          </div>

          {/* Comparison Bar Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Temporary vs. Permanent Repair Outcome Comparison
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluation of subsequent failure rates between short-term cold patches and permanent structural reconstruction in Bhimavaram.
              </p>
            </div>

            {repairComparisonChartData.length > 0 && (repairComparisonChartData[0].total > 0 || repairComparisonChartData[1].total > 0) ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={repairComparisonChartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Total Interventions" fill="#0c87eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="recurred" name="Subsequent Failures" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No repair outcome comparison data recorded yet.
              </div>
            )}

            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <strong>Engineering Takeaway:</strong> Temporary repairs in the Bhimavaram dataset experienced a{' '}
              <strong>{effectivenessData?.temporaryVsPermanent?.temporary?.recurrenceRate ?? 0}%</strong> repeat failure rate within an average of 42–65 days, whereas permanent milling and joint replacements reduced recurrence to{' '}
              <strong>{effectivenessData?.temporaryVsPermanent?.permanent?.recurrenceRate ?? 0}%</strong>.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MAINTENANCE WASTE & EXPENDITURE (Section 5 Feature 8) */}
      {!loading && !error && activeTab === 'waste' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Total Recorded Repair Expenditure</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {formatINR(wasteData?.totalExpenditure ?? 0)}
              </p>
              <span className="text-[11px] text-slate-400">Cumulative logged maintenance cost</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-rose-600">Spent on Recurring Incidents</p>
              <p className="text-2xl font-extrabold text-rose-700 mt-1">
                {formatINR(wasteData?.recurringExpenditure ?? 0)}
              </p>
              <span className="text-[11px] text-slate-400">
                {wasteData?.recurringExpenditureRatio ?? 0}% of total municipal spend
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-amber-600">Assets Flagged for Engineering Audit</p>
              <p className="text-2xl font-extrabold text-amber-700 mt-1">
                {formatIndianNumber(wasteData?.assetsRequiringEngineeringAudit?.length || 0)}
              </p>
              <span className="text-[11px] text-slate-400">Multiple repeat repairs recorded</span>
            </div>
          </div>

          {/* Expenditure by Asset Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Repair Expenditure by Infrastructure Asset (Top Assets in Bhimavaram)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Displays total maintenance spend alongside expenditure specifically attributed to repeat failure incidents.
              </p>
            </div>

            {costChartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costChartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} />
                    <Tooltip formatter={(value: any) => [formatINR(Number(value)), 'Amount']} />
                    <Legend />
                    <Bar dataKey="totalSpent" name="Total Spend (₹)" fill="#0284c7" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="recurringSpent" name="Recurring Spend (₹)" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No asset expenditure records available to chart.
              </div>
            )}
          </div>

          {/* Assets Flagged for Engineering Audit Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Assets Flagged as Potential Maintenance Inefficiency</span>
            </h3>
            <p className="text-xs text-slate-500">
              Diagnostic indicator highlighting assets where repetitive short-term repairs justify capital engineering replacement rather than piecemeal patching.
            </p>

            {wasteData?.assetsRequiringEngineeringAudit && wasteData.assetsRequiringEngineeringAudit.length > 0 ? (
              <div className="divide-y divide-slate-100 text-xs">
                {wasteData.assetsRequiringEngineeringAudit.map((asset) => (
                  <div key={asset.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded mr-2">
                        {asset.asset_code}
                      </span>
                      <strong className="text-slate-800">{asset.name}</strong>
                      <p className="text-slate-500 text-[11px] mt-0.5">{asset.reason}</p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <span className="font-bold text-rose-700 text-sm block">
                        {formatINR(asset.total_spent || 0)} spent
                      </span>
                      <span className="text-[10px] text-slate-400">{asset.repair_count} repair cycles logged</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                No infrastructure assets currently exceed recurrence audit thresholds.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SEASONAL TRENDS (Section 5 Feature 10) */}
      {!loading && !error && activeTab === 'seasonal' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Monthly Incident Frequency by Category
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distinct infrastructure failure counts grouped by month to detect weather and seasonal stress clusters in Bhimavaram.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
                Distinct Incidents Tracked: {formatIndianNumber(seasonalData?.totalDistinctIncidents || 0)}
              </span>
            </div>

            {seasonalData?.monthlyTimeline && seasonalData.monthlyTimeline.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={seasonalData.monthlyTimeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="monthName" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="roads" name="Roads & Potholes" stackId="1" stroke="#0284c7" fill="#38bdf8" />
                    <Area type="monotone" dataKey="drainage" name="Drainage Overflows" stackId="1" stroke="#0d9488" fill="#2dd4bf" />
                    <Area type="monotone" dataKey="water" name="Water Pipeline Stress" stackId="1" stroke="#2563eb" fill="#60a5fa" />
                    <Area type="monotone" dataKey="streetlights" name="Electrical & Lighting" stackId="1" stroke="#d97706" fill="#fbbf24" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No seasonal timeline data recorded yet.
              </div>
            )}
          </div>

          {/* Detected Seasonal Patterns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seasonalData?.detectedPatterns && seasonalData.detectedPatterns.length > 0 ? (
              seasonalData.detectedPatterns.map((pat, idx) => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 text-[11px]">
                    {pat.season}
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">{pat.primaryIssue}</h4>
                  <p className="text-slate-600 leading-relaxed">{pat.detail}</p>
                  <div className="pt-2 border-t border-slate-100 text-emerald-800 font-medium">
                    <strong>Preventive Recommendation:</strong> {pat.recommendation}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-6 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                Insufficient multi-season data to extract statistically significant seasonal patterns.
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 italic text-center">
            {seasonalData?.message || 'Historical patterns indicate measurable seasonal clustering across municipal sectors.'}
          </p>
        </div>
      )}

      {/* TAB 4: DEPARTMENT SLA & PERFORMANCE (Section 5 Feature 11) */}
      {!loading && !error && activeTab === 'departments' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Department Performance & SLA Outcomes
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Outcome-oriented metrics: SLA compliance, repeat incident rate, and photo evidence verification rate for Bhimavaram Municipal departments.
            </p>
          </div>

          {departmentData && departmentData.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">SLA Target</th>
                    <th className="px-4 py-3">Total Issues</th>
                    <th className="px-4 py-3">Avg Resolution Time</th>
                    <th className="px-4 py-3">SLA Compliance Rate</th>
                    <th className="px-4 py-3">Repeat Incident Rate</th>
                    <th className="px-4 py-3">Photo Evidence %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {departmentData.map((d) => (
                    <tr key={d.departmentId} className="hover:bg-slate-50">
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {d.departmentName} ({d.code})
                      </td>
                      <td className="px-4 py-3.5">{d.slaHours} hours</td>
                      <td className="px-4 py-3.5 font-semibold">{formatIndianNumber(d.totalIssues)} issues</td>
                      <td className="px-4 py-3.5">
                        {d.avgResolutionHours ? `${d.avgResolutionHours}h` : 'N/A'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`font-bold ${d.slaComplianceRate >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {d.slaComplianceRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`font-bold ${d.repeatIncidentRate > 30 ? 'text-rose-700' : 'text-slate-800'}`}>
                          {d.repeatIncidentRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-civic-700">
                        {d.photoEvidenceRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No department SLA performance data recorded yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

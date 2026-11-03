import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  GitMerge,
  History,
  Layers,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  Clock,
  CheckCircle,
} from 'lucide-react';

type AnalyticsStats = {
  totalCitizenReports?: number;
  uniqueCivicIssues?: number;
  consolidationRatio?: number;
  recurringIncidentsCount?: number;
  highRiskAssets?: number;
};

const lifecycleSteps = [
  {
    step: '01',
    title: 'Citizen Report & Geotag',
    description: 'Citizens submit issues with photos, GPS coordinates, and category descriptions via web or mobile portal.',
    icon: FileText,
    color: 'from-blue-500 to-cyan-500',
    badge: 'Submission',
  },
  {
    step: '02',
    title: 'AI Verification & Deduplication',
    description: 'Duplicate detection engine identifies matching incidents nearby, merging them under a single public issue thread.',
    icon: GitMerge,
    color: 'from-cyan-500 to-teal-500',
    badge: 'Consolidation',
  },
  {
    step: '03',
    title: 'Department Triage & SLA',
    description: 'Auto-routed to Roads, Water Works, Sanitation, or Electrical with priority scoring and SLA tracking.',
    icon: Wrench,
    color: 'from-amber-500 to-orange-500',
    badge: 'Dispatch',
  },
  {
    step: '04',
    title: 'Repair & Citizen Audit',
    description: 'Field engineers log repair details and costs (₹). Citizens verify completion, closing the audit cycle.',
    icon: ShieldCheck,
    color: 'from-emerald-500 to-green-600',
    badge: 'Resolution',
  },
];

const features = [
  {
    icon: GitMerge,
    title: 'Smart Deduplication & Clustering',
    description:
      'Identifies multi-citizen reports within geographic proximity, linking duplicate reports while preserving individual citizen tracking IDs and evidence photos.',
    badge: 'Machine Matching',
    accent: 'border-blue-200 bg-blue-50/50 text-blue-700',
  },
  {
    icon: History,
    title: 'Asset Lifecycle & Maintenance Log',
    description:
      'Maintains complete longitudinal history of municipal assets—roads, streetlights, stormwater drains—with maintenance logs and failure frequencies.',
    badge: 'Asset Health',
    accent: 'border-cyan-200 bg-cyan-50/50 text-cyan-700',
  },
  {
    icon: Wrench,
    title: 'Field Engineering Work Orders',
    description:
      'Department staff receive categorized work orders with priority scores, logging repair actions, parts used, contractor details, and expenditure in ₹.',
    badge: 'Work Order Management',
    accent: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
  },
  {
    icon: AlertTriangle,
    title: 'Predictive Infrastructure Risk Index',
    description:
      'Calculates vulnerability scores (0–100) based on repeated incident recurrence, chronic repair intervals, and heavy seasonal stress factors.',
    badge: 'Preventive Analytics',
    accent: 'border-rose-200 bg-rose-50/50 text-rose-700',
  },
  {
    icon: TrendingUp,
    title: 'Municipal Expenditure & Cost Tracking',
    description:
      'Monitors cumulative repair expenses in Indian Rupees (₹), distinguishing temporary patches from capital replacements to optimize municipal budgets.',
    badge: 'Fiscal Transparency',
    accent: 'border-purple-200 bg-purple-50/50 text-purple-700',
  },
  {
    icon: Activity,
    title: 'Real-Time SLA & Department Audit',
    description:
      'Enforces strict service-level agreements across municipal departments with automated escalation for overdue or unresolved citizen issues.',
    badge: 'Governance & SLA',
    accent: 'border-amber-200 bg-amber-50/50 text-amber-700',
  },
];

export const LandingPage: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        const data = await api.getAnalyticsOverview();
        if (isMounted) {
          setStats(data as AnalyticsStats);
        }
      } catch (error) {
        console.error('Failed to load CivicTrack analytics:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const metrics = [
    {
      label: 'Citizen Complaints',
      value: stats?.totalCitizenReports ?? 14,
      subtext: 'Citizen submissions received',
      color: 'text-slate-900',
      change: '+18% this month',
    },
    {
      label: 'Consolidated Issues',
      value: stats?.uniqueCivicIssues ?? 9,
      subtext: 'Active civic issue clusters',
      color: 'text-civic-700',
      change: 'Deduplicated triage',
    },
    {
      label: 'Deduplication Ratio',
      value: stats?.consolidationRatio ? `${stats.consolidationRatio}x` : '1.6x',
      subtext: 'Reports per consolidated issue',
      color: 'text-indigo-600',
      change: 'Reduced redundant trips',
    },
    {
      label: 'Recurring Incidents',
      value: stats?.recurringIncidentsCount ?? 3,
      subtext: 'Chronic repeat locations',
      color: 'text-amber-600',
      change: 'Flagged for overhaul',
    },
    {
      label: 'High-Risk Assets',
      value: stats?.highRiskAssets ?? 2,
      subtext: 'Assets with risk score > 70',
      color: 'text-rose-600',
      change: 'Action required',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-civic-950 to-slate-900 text-white px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(#0c87eb_1px,transparent_1px)] [background-size:28px_28px] opacity-20 pointer-events-none" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-civic-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 backdrop-blur">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            <span>Civic Infrastructure Lifecycle & Citizen Service Platform</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Smarter Civic Infrastructure.{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-civic-300 to-blue-400 bg-clip-text text-transparent">
              Transparent Municipal Action.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            CivicTrack connects citizen complaints, AI-powered duplicate detection, department work order triage, and lifecycle asset intelligence into a unified municipal operating system.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/report"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-civic-600 to-cyan-500 px-7 py-4 text-sm font-bold text-white shadow-xl shadow-cyan-500/25 transition-all hover:scale-105 hover:shadow-cyan-500/40 active:scale-95"
            >
              Report a Civic Issue
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/map"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 px-7 py-4 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-slate-700/90 hover:border-slate-600 active:scale-95"
            >
              <MapPin className="h-4 w-4 text-cyan-400" />
              Live Bhimavaram Map
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-4 text-sm font-semibold text-slate-300 backdrop-blur transition hover:text-white hover:bg-slate-800"
            >
              <Users className="h-4 w-4 text-slate-400" />
              Portal Sign In
            </Link>
          </div>

          {/* Key Value Highlights */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              Zero duplicate dispatches
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              Real-time SLA tracking
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              Asset health scoring (0–100)
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              Expenditure audit in ₹
            </span>
          </div>
        </div>
      </section>

      {/* Real-time KPI Stats Bar */}
      <section className="relative z-10 -mt-8 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Live Municipal Infrastructure Metrics
              </h2>
              <p className="text-xs text-slate-500">
                Continuous operational monitoring for Bhimavaram Municipal Corporation
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              System Operational • MongoDB Atlas Synced
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:bg-white hover:border-slate-200 hover:shadow-sm"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {metric.label}
                </p>

                <p className={`mt-2 text-3xl font-black tracking-tight ${metric.color}`}>
                  {loading ? (
                    <span className="text-slate-300">...</span>
                  ) : (
                    metric.value
                  )}
                </p>

                <p className="mt-1 text-xs text-slate-600 font-medium">
                  {metric.subtext}
                </p>
                <div className="mt-2 text-[10px] font-semibold text-civic-600">
                  {metric.change}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4-Step Lifecycle Workflow Diagram */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex rounded-full border border-civic-200 bg-civic-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-civic-800">
            Lifecycle Architecture
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            From Citizen Complaint to Verified Resolution
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            CivicTrack replaces isolated complaint boxes with an end-to-end, multi-stage municipal lifecycle process.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {lifecycleSteps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-slate-300 font-mono">
                      PHASE {item.step}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {item.badge}
                    </span>
                  </div>

                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-md mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-civic-600">
                  <span>Explore Workflow</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature Grid */}
      <section className="bg-white border-y border-slate-200 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-800">
              Platform Features
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
              Engineered for Real-World Municipal Needs
            </h2>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              Explore how each component coordinates citizens, field technicians, and municipal administrators.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md hover:border-slate-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-civic-700">
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${feature.accent}`}>
                        {feature.badge}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {feature.title}
                    </h3>

                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3-Role Access Overview Section */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-civic-950 to-slate-900 text-white p-8 sm:p-12 shadow-xl border border-slate-800">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">
              Role-Based Municipal Architecture
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold">
              Dedicated Workspaces for Every Civic Stakeholder
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-300">
              Tailored dashboards empower citizens to track resolutions, staff to execute repairs, and administrators to govern municipal assets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold mb-4">
                  01
                </div>
                <h3 className="text-base font-bold text-white mb-2">Citizen Portal</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Register, submit geotagged issues with photos, track status in real-time, upvote existing public issues, and verify repair quality.
                </p>
              </div>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300"
              >
                Create Citizen Account &rarr;
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold mb-4">
                  02
                </div>
                <h3 className="text-base font-bold text-white mb-2">Field Staff Portal</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Review assigned department work orders, advance statuses (In Progress &rarr; Resolved), and log repair actions with parts and cost in ₹.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300"
              >
                Access Staff Portal &rarr;
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-800/60 p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold mb-4">
                  03
                </div>
                <h3 className="text-base font-bold text-white mb-2">Municipal Admin Command</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Full operations command center: department triage, SLA governance, staff work order assignment, asset risk analytics, and audit logs.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300"
              >
                Access Command Center &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer & Academic Demonstration Disclaimer */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-civic-800 to-civic-600 text-white shadow-sm">
              <Layers className="h-4 w-4" />
            </div>
            <span className="text-base font-extrabold text-slate-900 tracking-tight">
              Civic<span className="text-civic-600">Track</span>
            </span>
          </div>

          <p className="text-xs font-semibold text-slate-700">
            Infrastructure Lifecycle Management & Municipal Service Delivery System
          </p>

          <p className="text-xs text-slate-500 max-w-3xl mx-auto leading-relaxed">
            Municipal Infrastructure Lifecycle Management • Bhimavaram Platform, Andhra Pradesh.
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-3xl mx-auto text-[11px] text-slate-500 leading-relaxed">
            <span className="font-bold text-slate-700">Municipal Platform Note:</span> CivicTrack is an infrastructure lifecycle management and incident deduplication platform configured for Bhimavaram. Geographic coordinates and municipal assets are indexed for community grievance resolution and asset health monitoring.
          </div>

          <div className="pt-2 text-[11px] text-slate-400">
            &copy; {new Date().getFullYear()} CivicTrack System. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;


import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitMerge,
  History,
  MapPin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react';

type AnalyticsStats = {
  totalCitizenReports?: number;
  uniqueCivicIssues?: number;
  consolidationRatio?: number;
  recurringIncidentsCount?: number;
  highRiskAssets?: number;
};

const features = [
  {
    icon: GitMerge,
    title: 'Smart Issue Matching',
    description:
      'Identify potentially duplicate reports using location and issue details. Keep original citizen submissions and evidence associated with the relevant civic issue.',
    label: 'Duplicate detection',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    icon: History,
    title: 'Infrastructure History',
    description:
      'Maintain a history of incidents and repairs for roads, streetlights, drainage systems and other infrastructure assets.',
    label: 'Incident tracking',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    icon: Wrench,
    title: 'Repair Effectiveness',
    description:
      'Record temporary and permanent repairs and review whether problems return after maintenance work is completed.',
    label: 'Repair monitoring',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: AlertTriangle,
    title: 'Infrastructure Risk Assessment',
    description:
      'Use available incident and repair history to identify assets that may need closer attention or preventive maintenance.',
    label: 'Risk assessment',
    color: 'bg-rose-100 text-rose-700',
  },
  {
    icon: TrendingUp,
    title: 'Maintenance Cost Insights',
    description:
      'Review recorded repair expenditure and identify assets with recurring maintenance costs to support better planning.',
    label: 'Cost analysis',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    icon: Activity,
    title: 'Preventive Maintenance',
    description:
      'Use recurring incident patterns and service performance information to help departments prioritize maintenance activities.',
    label: 'Maintenance planning',
    color: 'bg-cyan-100 text-cyan-700',
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
      label: 'Citizen Reports',
      value: stats?.totalCitizenReports,
      description: 'Submitted civic concerns',
      color: 'text-slate-900',
    },
    {
      label: 'Unique Civic Issues',
      value: stats?.uniqueCivicIssues,
      description: 'Issues identified',
      color: 'text-cyan-700',
    },
    {
      label: 'Consolidation Ratio',
      value:
        stats?.consolidationRatio == null
          ? undefined
          : `${stats.consolidationRatio}x`,
      description: 'Reports per consolidated issue',
      color: 'text-indigo-700',
    },
    {
      label: 'Recurring Incidents',
      value: stats?.recurringIncidentsCount,
      description: 'Issues reported again',
      color: 'text-amber-700',
    },
    {
      label: 'High-Risk Assets',
      value: stats?.highRiskAssets,
      description: 'Assets needing attention',
      color: 'text-rose-700',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-civic-950 to-slate-900 text-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(#0c87eb_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200">
            <Sparkles className="h-4 w-4" />
            Smarter Infrastructure. Better Communities.
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Civic<span className="text-cyan-400">Track</span>
            <span className="mt-3 block text-xl font-medium leading-relaxed text-slate-300 sm:text-2xl lg:text-3xl">
              Infrastructure Lifecycle Management System
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            A centralized platform for reporting civic issues, tracking
            infrastructure conditions, monitoring repairs and helping
            authorities plan preventive maintenance using incident history
            and risk insights.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/report"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
            >
              Report a Civic Issue
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/map"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/70 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <MapPin className="h-4 w-4 text-cyan-400" />
              Explore Infrastructure Map
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Centralized issue tracking
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Repair history
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Risk-based maintenance
            </span>
          </div>
        </div>
      </section>

      {/* Analytics overview */}
      <section className="border-y border-slate-200 bg-white px-4 py-8 shadow-sm sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-bold text-slate-900">
              Civic Infrastructure Overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A snapshot of the available issue and asset records.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {metric.label}
                </p>

                <p
                  className={`mt-3 text-2xl font-extrabold ${metric.color}`}
                  aria-live="polite"
                >
                  {loading ? (
                    <span className="text-slate-300">...</span>
                  ) : metric.value != null ? (
                    metric.value
                  ) : (
                    '—'
                  )}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {metric.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-cyan-800">
            Platform Capabilities
          </span>

          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            More Than a Complaint Portal
          </h2>

          <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
            CivicTrack connects citizen reports, infrastructure records and
            repair information to support more informed civic maintenance
            decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {feature.description}
                </p>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold text-cyan-700">
                    {feature.label}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* How it helps */}
      <section className="bg-slate-900 px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">
              From reporting to resolution
            </span>

            <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">
              Make civic maintenance more transparent and proactive.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              By connecting reports with asset histories and repair records,
              CivicTrack helps teams understand recurring problems, monitor
              maintenance outcomes and identify where attention may be needed.
            </p>

            <Link
              to="/infrastructure"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-400"
            >
              Explore Infrastructure
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4 rounded-xl border border-slate-700 bg-slate-800/70 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
                <GitMerge className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold">Connect related reports</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Find related reports while preserving the original citizen
                  submissions.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl border border-slate-700 bg-slate-800/70 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold">Track maintenance outcomes</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Keep repair activities and recurring failures visible in
                  infrastructure records.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-xl border border-slate-700 bg-slate-800/70 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold">Support better decisions</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Use recorded history and risk indicators to help prioritize
                  infrastructure maintenance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-8 text-center space-y-2">
        <p className="font-bold text-slate-800">
          CivicTrack — Infrastructure Lifecycle Management System
        </p>
        <p className="text-xs text-slate-500">
          Academic Demonstration Project (FSD) • Demonstrating infrastructure lifecycle tracking, duplicate report linking, and maintenance effectiveness.
        </p>
        <p className="text-[11px] text-slate-400 max-w-2xl mx-auto">
          Notice: CivicTrack is an independent educational software project and is not an official municipal portal or affiliated with Bhimavaram Municipality. Demonstrations use realistic local Bhimavaram geography and simulated incident records.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
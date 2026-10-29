import React from 'react';
import { RiskLevel, HealthStatus } from '../types';
import { ShieldAlert, ShieldCheck, AlertCircle, AlertTriangle } from 'lucide-react';

interface RiskProps {
  level: RiskLevel | string;
  score?: number;
}

export const RiskBadge: React.FC<RiskProps> = ({ level, score }) => {
  switch (level) {
    case 'Critical':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
          <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
          Critical Risk {score !== undefined && `(${score}/100)`}
        </span>
      );
    case 'High':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
          High Risk {score !== undefined && `(${score}/100)`}
        </span>
      );
    case 'Medium':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          Medium Risk {score !== undefined && `(${score}/100)`}
        </span>
      );
    case 'Low':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Low Risk {score !== undefined && `(${score}/100)`}
        </span>
      );
  }
};

interface HealthProps {
  status: HealthStatus | string;
}

export const HealthStatusBadge: React.FC<HealthProps> = ({ status }) => {
  switch (status) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-2 h-2 rounded-full bg-rose-600"></span>
          Structural Failure / Critical
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          Repeated Incidents / Warning
        </span>
      );
    case 'monitoring':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Requires Monitoring
        </span>
      );
    case 'good':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Good / Sound Condition
        </span>
      );
  }
};

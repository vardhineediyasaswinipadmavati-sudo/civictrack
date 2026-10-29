import React from 'react';
import { IssueStatus } from '../types';
import { Clock, CheckCircle2, AlertTriangle, ArrowUpRight, RotateCcw, UserCheck } from 'lucide-react';

interface Props {
  status: IssueStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5 font-medium'
  };

  switch (status) {
    case 'Pending':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 ${sizeClasses[size]}`}>
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Pending Review
        </span>
      );
    case 'Assigned':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 ${sizeClasses[size]}`}>
          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
          Assigned
        </span>
      );
    case 'In Progress':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 ${sizeClasses[size]}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
          </span>
          In Progress
        </span>
      );
    case 'Resolved':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 ${sizeClasses[size]}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Resolved
        </span>
      );
    case 'Reopened':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 ${sizeClasses[size]}`}>
          <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
          Reopened (Returning Issue)
        </span>
      );
    case 'Escalated':
      return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-300 animate-pulse ${sizeClasses[size]}`}>
          <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
          Escalated (SLA Exceeded)
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses[size]}`}>
          {status}
        </span>
      );
  }
};

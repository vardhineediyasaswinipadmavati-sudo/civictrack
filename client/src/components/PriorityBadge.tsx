import React from 'react';
import { AlertCircle, Flame } from 'lucide-react';

interface Props {
  score: number;
  isSafetyCritical?: number | boolean;
}

export const PriorityBadge: React.FC<Props> = ({ score, isSafetyCritical }) => {
  let level = 'Low';
  let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';

  if (score >= 80 || isSafetyCritical) {
    level = 'Critical Priority';
    badgeClasses = 'bg-red-50 text-red-700 border-red-300 font-bold';
  } else if (score >= 60) {
    level = 'High Priority';
    badgeClasses = 'bg-orange-50 text-orange-700 border-orange-200 font-semibold';
  } else if (score >= 35) {
    level = 'Medium Priority';
    badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else {
    level = 'Low Priority';
    badgeClasses = 'bg-slate-50 text-slate-600 border-slate-200';
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border ${badgeClasses}`}>
        {Boolean(isSafetyCritical) && <Flame className="w-3.5 h-3.5 text-red-600" />}
        {level} ({score} pts)
      </span>
      {Boolean(isSafetyCritical) && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-100/80 px-2 py-0.5 rounded border border-red-200">
          <AlertCircle className="w-3 h-3" /> Safety Hazard
        </span>
      )}
    </div>
  );
};

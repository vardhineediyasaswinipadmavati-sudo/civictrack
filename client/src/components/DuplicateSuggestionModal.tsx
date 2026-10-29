import React, { useState } from 'react';
import { DuplicateMatchItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { AlertTriangle, MapPin, Users, Calendar, ArrowRight, CheckCircle2, Eye, ShieldAlert } from 'lucide-react';

interface Props {
  matches: DuplicateMatchItem[];
  onConfirmExisting: (issueId: number) => void;
  onProceedAsDifferent: () => void;
  onCancel: () => void;
}

export const DuplicateSuggestionModal: React.FC<Props> = ({
  matches,
  onConfirmExisting,
  onProceedAsDifferent,
  onCancel
}) => {
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(
    matches[0] ? matches[0].issueId : null
  );
  const [detailPreview, setDetailPreview] = useState<DuplicateMatchItem | null>(null);

  const bestMatch = matches[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Alert Banner */}
        <div className="bg-amber-500/10 border-b border-amber-200/80 px-6 py-4 flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              A similar issue may already have been reported nearby
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              CivicTrack detected open reports matching your category and location. Linking your report avoids duplicate municipal work tickets while preserving your original evidence.
            </p>
          </div>
        </div>

        {/* Matches List */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Possible Matching Civic Issues ({matches.length} detected)
          </p>

          <div className="space-y-3">
            {matches.map((item) => {
              const isSelected = selectedIssueId === item.issueId;
              const issue = item.issue;
              return (
                <div
                  key={item.issueId}
                  onClick={() => setSelectedIssueId(item.issueId)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-civic-600 bg-civic-50/40 shadow-sm ring-1 ring-civic-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    {issue.primary_image ? (
                      <img
                        src={issue.primary_image}
                        alt="Issue thumbnail"
                        className="w-20 h-20 rounded-lg object-cover shrink-0 border border-slate-200"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 text-slate-400">
                        <MapPin className="w-8 h-8 opacity-40" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            {item.issueCode}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">{item.category}</span>
                        </div>
                        <StatusBadge status={item.status} size="sm" />
                      </div>

                      <h4 className="font-bold text-sm text-slate-900 mt-1 truncate">
                        {item.title}
                      </h4>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" /> ~{item.distanceMeters}m away
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {(issue.citizen_reports_count ?? 1)} citizen report{(issue.citizen_reports_count ?? 1) > 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          First reported {new Date(issue.first_reported_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-500">
                          Match confidence: <strong className="text-civic-700">{item.matchingScore}%</strong>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailPreview(item);
                          }}
                          className="text-xs font-semibold text-civic-600 hover:text-civic-800 flex items-center gap-1 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" /> Review Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-800">
              💡 How CivicTrack handles shared civic issues:
            </p>
            <p>
              Confirming this issue links your observation to Master Ticket <strong>{matches.find(m => m.issueId === selectedIssueId)?.issueCode || 'CT'}</strong>. Your photos and description remain preserved in full, and you will receive notifications as work progresses.
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {/* Action 2: Report a Different Issue */}
            <button
              type="button"
              onClick={onProceedAsDifferent}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
              title="Indicate that your problem is separate and create a distinct issue record"
            >
              Report a Different Issue
            </button>

            {/* Action 1: Confirm Existing Issue */}
            <button
              type="button"
              disabled={!selectedIssueId}
              onClick={() => selectedIssueId && onConfirmExisting(selectedIssueId)}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl bg-civic-600 text-white hover:bg-civic-700 shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm Existing Issue
            </button>
          </div>
        </div>
      </div>

      {/* Review Details Sub-Modal */}
      {detailPreview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {detailPreview.issueCode}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{detailPreview.title}</h3>
              </div>
              <StatusBadge status={detailPreview.status} size="sm" />
            </div>

            {detailPreview.issue.primary_image && (
              <img
                src={detailPreview.issue.primary_image}
                alt="Issue evidence"
                className="w-full h-48 object-cover rounded-xl mt-4 border border-slate-200"
              />
            )}

            <div className="mt-4 text-xs text-slate-600 space-y-2">
              <p><strong>Description:</strong> {detailPreview.issue.description}</p>
              <p><strong>Location:</strong> {detailPreview.issue.address}</p>
              <p><strong>Category:</strong> {detailPreview.category}</p>
              <p><strong>Report Count:</strong> {detailPreview.issue.citizen_reports_count || 1} independent reports</p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailPreview(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedIssueId(detailPreview.issueId);
                  setDetailPreview(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-civic-600 text-white rounded-lg hover:bg-civic-700"
              >
                Select This Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

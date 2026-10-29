import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SharedIssue } from '../types';
import { GitMerge, AlertCircle, Check, X } from 'lucide-react';

interface Props {
  targetIssue: SharedIssue;
  onSuccess: () => void;
  onClose: () => void;
}

export const MergeIssuesModal: React.FC<Props> = ({
  targetIssue,
  onSuccess,
  onClose
}) => {
  const [candidates, setCandidates] = useState<SharedIssue[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | ''>('');
  const [reason, setReason] = useState('Duplicate reports of same physical defect on site inspection');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCandidates() {
      try {
        const issues = await api.getIssues({ category: targetIssue.category });
        // Exclude current target issue
        setCandidates(issues.filter((i) => i.id !== targetIssue.id));
      } catch (err: any) {
        setError(err.message || 'Failed to load issues for merging');
      } finally {
        setLoading(false);
      }
    }
    loadCandidates();
  }, [targetIssue]);

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSourceId) {
      setError('Please select a secondary shared issue to merge into this master issue.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.mergeIssues(targetIssue.id, selectedSourceId, reason);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to merge issues');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
              <GitMerge className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Consolidate Master Issues</h3>
              <p className="text-xs text-slate-400">Target Issue: {targetIssue.issue_code}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleMerge} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200/70 text-blue-900 leading-relaxed">
            <p className="font-semibold mb-1">Administrative Audit Safeguards:</p>
            <p>
              Merging will re-link all associated citizen reports, timestamps, and photographs from the selected issue into <strong>{targetIssue.issue_code}</strong>. No original citizen submissions or evidence will be lost. An immutable entry will be logged into the audit ledger.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Select Secondary Issue to Merge into {targetIssue.issue_code} <span className="text-red-500">*</span>
            </label>
            {loading ? (
              <p className="text-slate-400 italic">Searching matching category issues...</p>
            ) : candidates.length === 0 ? (
              <p className="text-slate-500 italic">No other open issues in this category found.</p>
            ) : (
              <select
                required
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-civic-500"
              >
                <option value="">-- Choose issue to merge --</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.issue_code}: {c.title} ({c.citizen_reports_count || 1} report(s), {c.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Audit Reason & Engineering Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Field inspection confirmed reports represent the same physical pothole cavity at 2400 Oak Ave."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedSourceId}
              className="px-5 py-2 rounded-xl bg-purple-700 text-white font-bold hover:bg-purple-800 shadow-sm transition-all flex items-center gap-1.5"
            >
              <GitMerge className="w-4 h-4" />
              {submitting ? 'Merging...' : 'Confirm Consolidation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

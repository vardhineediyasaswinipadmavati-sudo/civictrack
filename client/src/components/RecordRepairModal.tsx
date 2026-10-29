import React, { useState } from 'react';
import { api } from '../services/api';
import { Wrench, DollarSign, Camera, Check, X, AlertCircle } from 'lucide-react';

interface Props {
  assetId: number;
  assetName: string;
  sharedIssueId?: number | null;
  incidentId?: number | null;
  onSuccess: () => void;
  onClose: () => void;
}

export const RecordRepairModal: React.FC<Props> = ({
  assetId,
  assetName,
  sharedIssueId,
  incidentId,
  onSuccess,
  onClose
}) => {
  const [repairType, setRepairType] = useState<'temporary' | 'permanent' | 'inspection_only' | 'no_fault'>('permanent');
  const [workSummary, setWorkSummary] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [costAmount, setCostAmount] = useState<string>('');
  const [costUnavailable, setCostUnavailable] = useState(false);
  const [beforeImageUrl, setBeforeImageUrl] = useState('');
  const [afterImageUrl, setAfterImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'before' | 'after') => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    try {
      const res = await api.uploadImage(e.target.files[0]);
      if (target === 'before') setBeforeImageUrl(res.imageUrl);
      else setAfterImageUrl(res.imageUrl);
    } catch (err: any) {
      setError(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workSummary || workSummary.trim().length < 5) {
      setError('Please provide a descriptive work summary (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.recordRepair(assetId, {
        shared_issue_id: sharedIssueId || null,
        incident_id: incidentId || null,
        repair_type: repairType,
        work_summary: workSummary.trim(),
        materials_used: materialsUsed.trim() || undefined,
        cost_amount: costUnavailable ? null : (costAmount ? parseFloat(costAmount) : null),
        cost_unavailable: costUnavailable,
        before_image_url: beforeImageUrl || undefined,
        after_image_url: afterImageUrl || undefined
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record repair log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-civic-500/20 text-civic-300">
              <Wrench className="w-5 h-5 text-civic-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Log Work & Repair Details</h3>
              <p className="text-xs text-slate-400 truncate max-w-sm">{assetName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 5 Feature 4: Classification */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Work Classification <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { type: 'temporary', label: 'Temporary Repair', desc: 'Quick patch / holding fix' },
                { type: 'permanent', label: 'Permanent Repair', desc: 'Structural engineering fix' },
                { type: 'inspection_only', label: 'Inspection Only', desc: 'Visual assessment' },
                { type: 'no_fault', label: 'No Fault Found', desc: 'Operating to spec' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setRepairType(item.type as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    repairType === item.type
                      ? 'border-civic-600 bg-civic-50/60 font-bold text-civic-800 ring-1 ring-civic-500'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Work Summary */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Work Summary & Findings <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={workSummary}
              onChange={(e) => setWorkSummary(e.target.value)}
              placeholder="Detail actions taken, subsurface observations, compaction passes, tests executed..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
            />
          </div>

          {/* Materials Used */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Materials Used
            </label>
            <input
              type="text"
              value={materialsUsed}
              onChange={(e) => setMaterialsUsed(e.target.value)}
              placeholder="e.g. 50kg Hot asphalt binder mix, IP68 junction casing, EPDM gasket"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs"
            />
          </div>

          {/* Section 5 Feature 8: Cost Tracking */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Recorded Maintenance Cost
              </label>
              <label className="flex items-center gap-1.5 text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={costUnavailable}
                  onChange={(e) => setCostUnavailable(e.target.checked)}
                  className="rounded text-civic-600 focus:ring-civic-500"
                />
                <span className="text-[11px]">Cost data unavailable</span>
              </label>
            </div>
            {!costUnavailable && (
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-semibold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500 text-xs bg-white"
                />
              </div>
            )}
            {costUnavailable && (
              <p className="text-[11px] text-slate-400 italic">
                Maintenance cost will be logged as "Cost data unavailable" per municipal reporting guidelines.
              </p>
            )}
          </div>

          {/* Before & After Photos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Before Repair Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'before')}
                className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
              {beforeImageUrl && (
                <img src={beforeImageUrl} alt="Before preview" className="mt-2 w-full h-20 object-cover rounded-lg border border-slate-200" />
              )}
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">After Repair Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'after')}
                className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
              {afterImageUrl && (
                <img src={afterImageUrl} alt="After preview" className="mt-2 w-full h-20 object-cover rounded-lg border border-slate-200" />
              )}
            </div>
          </div>

          {/* Action Buttons */}
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
              disabled={submitting || uploading}
              className="px-5 py-2 rounded-xl bg-civic-600 text-white font-bold hover:bg-civic-700 shadow-sm transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Recording...' : 'Save Repair Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

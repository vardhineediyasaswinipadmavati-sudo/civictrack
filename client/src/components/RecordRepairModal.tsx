import React, { useState } from 'react';
import { api } from '../services/api';
import { Wrench, DollarSign, Camera, Check, X, AlertCircle, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';

interface Props {
  assetId?: number | string | null;
  assetName?: string;
  sharedIssueId?: number | string | null;
  incidentId?: number | string | null;
  originalEvidenceImage?: string | null;
  citizenEvidenceImages?: string[];
  onSuccess: () => void;
  onClose: () => void;
}

const isPlaceholder = (text: string, minLen = 5): boolean => {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (trimmed.length < minLen) return true;
  const lower = trimmed.toLowerCase();
  const banned = [
    'done',
    'fixed',
    'test',
    'testing',
    'n/a',
    'na',
    'none',
    'nil',
    'asdf',
    'qwerty',
    'repaired',
    'repaired issue',
    'work done',
    'ok',
    'okay',
    'completed',
    'placeholder',
    'nothing',
    'no issue',
    'sample',
    'repaired it',
    'repaired defect',
    'repaired road',
    'repair done',
    'null'
  ];
  if (banned.includes(lower)) return true;
  if (/^[\s\d\W]+$/.test(trimmed)) return true;
  if (/^(.)\1+$/.test(lower)) return true;
  return false;
};

export const RecordRepairModal: React.FC<Props> = ({
  assetId,
  assetName,
  sharedIssueId,
  incidentId,
  originalEvidenceImage,
  citizenEvidenceImages = [],
  onSuccess,
  onClose
}) => {
  const [repairType, setRepairType] = useState<'temporary' | 'permanent'>('permanent');
  const [workSummary, setWorkSummary] = useState('');
  const [materialsUsed, setMaterialsUsed] = useState('');
  const [costAmount, setCostAmount] = useState<string>('');
  const [beforeImageUrl, setBeforeImageUrl] = useState('');
  const [afterImageUrl, setAfterImageUrl] = useState('');
  const [uploadingTarget, setUploadingTarget] = useState<'before' | 'after' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  // Compile list of known citizen evidence images
  const bannedEvidenceUrls = new Set<string>();
  if (originalEvidenceImage && originalEvidenceImage.trim()) {
    bannedEvidenceUrls.add(originalEvidenceImage.trim());
  }
  citizenEvidenceImages.forEach((img) => {
    if (img && img.trim()) bannedEvidenceUrls.add(img.trim());
  });

  // Field-specific validation checks
  const getWorkSummaryError = (): string | null => {
    const trimmed = workSummary.trim();
    if (!trimmed) return 'Work description explaining what was done is mandatory.';
    if (trimmed.length < 10) return `Work description must be at least 10 characters (currently ${trimmed.length}).`;
    if (isPlaceholder(workSummary, 10)) {
      return 'Meaningful work description is required. Placeholder text like "done" or "fixed" is not accepted.';
    }
    return null;
  };

  const getMaterialsError = (): string | null => {
    const trimmed = materialsUsed.trim();
    if (!trimmed) return 'Materials used information is mandatory.';
    if (trimmed.length < 3) return 'Materials used must be at least 3 characters.';
    if (isPlaceholder(materialsUsed, 3)) {
      return 'Valid materials description is required (placeholder text like "none" or "n/a" is not accepted).';
    }
    return null;
  };

  const getCostError = (): string | null => {
    if (costAmount === '' || costAmount === null || costAmount === undefined) {
      return 'Repair cost must be explicitly entered as a valid numeric amount.';
    }
    const num = Number(costAmount);
    if (isNaN(num)) return 'Repair cost must be a valid number.';
    if (num < 0) return 'Repair cost cannot be negative.';
    return null;
  };

  const getBeforeImageError = (): string | null => {
    if (!beforeImageUrl || !beforeImageUrl.trim()) {
      return 'Before-repair photograph is mandatory and must be uploaded.';
    }
    return null;
  };

  const getAfterImageError = (): string | null => {
    if (!afterImageUrl || !afterImageUrl.trim()) {
      return 'After-repair photograph is mandatory and must be uploaded.';
    }
    const trimmedAfter = afterImageUrl.trim();
    if (beforeImageUrl && trimmedAfter === beforeImageUrl.trim()) {
      return 'After-repair photograph must be distinct from the before-repair photograph.';
    }
    if (bannedEvidenceUrls.has(trimmedAfter)) {
      return 'The after-repair photograph cannot reuse the original citizen complaint photograph. Genuine post-repair evidence is required.';
    }
    return null;
  };

  const workSummaryError = getWorkSummaryError();
  const materialsError = getMaterialsError();
  const costError = getCostError();
  const beforeImageError = getBeforeImageError();
  const afterImageError = getAfterImageError();

  const isFormValid =
    !workSummaryError &&
    !materialsError &&
    !costError &&
    !beforeImageError &&
    !afterImageError &&
    (repairType === 'temporary' || repairType === 'permanent');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'before' | 'after') => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingTarget(target);
    setError(null);
    try {
      const res = await api.uploadImage(file);
      if (target === 'before') {
        setBeforeImageUrl(res.imageUrl);
        setTouched((prev) => ({ ...prev, beforeImage: true }));
      } else {
        setAfterImageUrl(res.imageUrl);
        setTouched((prev) => ({ ...prev, afterImage: true }));
      }
    } catch (err: any) {
      setError(err.message || 'Image upload failed. Please ensure a valid image is selected.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      repairType: true,
      workSummary: true,
      materials: true,
      cost: true,
      beforeImage: true,
      afterImage: true
    });

    if (!isFormValid) {
      const missingList: string[] = [];
      if (workSummaryError) missingList.push(workSummaryError);
      if (materialsError) missingList.push(materialsError);
      if (costError) missingList.push(costError);
      if (beforeImageError) missingList.push(beforeImageError);
      if (afterImageError) missingList.push(afterImageError);
      setError(`Please resolve all required fields:\n• ${missingList.join('\n• ')}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.recordRepair(assetId || null, {
        shared_issue_id: sharedIssueId || null,
        incident_id: incidentId || null,
        repair_type: repairType,
        work_summary: workSummary.trim(),
        materials_used: materialsUsed.trim(),
        cost_amount: parseFloat(costAmount),
        cost_unavailable: false,
        before_image_url: beforeImageUrl.trim(),
        after_image_url: afterImageUrl.trim()
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
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-civic-500/20 text-civic-300">
              <Wrench className="w-5 h-5 text-civic-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Log Work & Repair Details</h3>
              <p className="text-xs text-slate-400 truncate max-w-sm">
                {assetId ? (assetName || 'Monitored Asset') : `Issue: ${assetName || 'Unlinked Complaint'}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 whitespace-pre-line">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Submission Incomplete</p>
                <p className="text-[11px] leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* 1. Mandatory Work Classification */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700">
                Work Classification <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Mandatory</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { type: 'temporary', label: 'Temporary Repair', desc: 'Quick patch / holding fix' },
                { type: 'permanent', label: 'Permanent Repair', desc: 'Structural engineering fix' }
              ].map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setRepairType(item.type as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    repairType === item.type
                      ? 'border-civic-600 bg-civic-50/70 font-bold text-civic-900 ring-2 ring-civic-500/30'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-xs">{item.label}</p>
                    {repairType === item.type && <CheckCircle2 className="w-4 h-4 text-civic-600" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Mandatory Work Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                Work Description & Remediations Performed <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Min. 10 chars</span>
            </div>
            <textarea
              required
              rows={3}
              value={workSummary}
              onChange={(e) => setWorkSummary(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, workSummary: true }))}
              placeholder="Detail actions taken, subsurface observations, compaction passes, tests executed..."
              className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                touched.workSummary && workSummaryError
                  ? 'border-rose-300 bg-rose-50/30 focus:ring-rose-400'
                  : 'border-slate-200 focus:ring-civic-500'
              }`}
            />
            {touched.workSummary && workSummaryError && (
              <p className="text-rose-600 text-[11px] mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{workSummaryError}</span>
              </p>
            )}
          </div>

          {/* 3. Mandatory Materials Used */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                Materials Used <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">Min. 3 chars</span>
            </div>
            <input
              type="text"
              required
              value={materialsUsed}
              onChange={(e) => setMaterialsUsed(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, materials: true }))}
              placeholder="e.g. 50kg Hot asphalt binder mix, IP68 junction casing, EPDM gasket"
              className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                touched.materials && materialsError
                  ? 'border-rose-300 bg-rose-50/30 focus:ring-rose-400'
                  : 'border-slate-200 focus:ring-civic-500'
              }`}
            />
            {touched.materials && materialsError && (
              <p className="text-rose-600 text-[11px] mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{materialsError}</span>
              </p>
            )}
          </div>

          {/* 4. Mandatory Explicit Repair Cost */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Actual Repair Cost <span className="text-red-500">*</span></span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Explicit entry required (₹)</span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 font-bold text-xs">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, cost: true }))}
                placeholder="Enter explicit repair cost amount (e.g. 4500)"
                className={`w-full pl-7 pr-3 py-2 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 ${
                  touched.cost && costError
                    ? 'border-rose-300 bg-rose-50/30 focus:ring-rose-400'
                    : 'border-slate-200 focus:ring-civic-500'
                }`}
              />
            </div>
            {touched.cost && costError && (
              <p className="text-rose-600 text-[11px] flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{costError}</span>
              </p>
            )}
            <p className="text-[10px] text-slate-400 leading-tight">
              Per municipal accountability guidelines, silent defaulting to ₹0 or cost omission is prohibited. Enter the exact maintenance expense.
            </p>
          </div>

          {/* 5 & 6. Mandatory Before & After Photographs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Before Photo */}
            <div className={`p-3 rounded-xl border transition-all ${
              touched.beforeImage && beforeImageError
                ? 'border-rose-300 bg-rose-50/20'
                : beforeImageUrl
                ? 'border-emerald-200 bg-emerald-50/20'
                : 'border-slate-200 bg-white'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-civic-600" />
                  <span>Before Photo <span className="text-red-500">*</span></span>
                </label>
                {beforeImageUrl && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Uploaded
                  </span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingTarget !== null}
                onChange={(e) => handleFileUpload(e, 'before')}
                className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
              />
              {uploadingTarget === 'before' && (
                <div className="mt-2 p-2 bg-slate-100 rounded-lg flex items-center justify-center gap-1.5 text-slate-600 text-[11px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-civic-600" />
                  <span>Uploading before-photo to Cloudinary...</span>
                </div>
              )}
              {beforeImageUrl && (
                <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200">
                  <img src={beforeImageUrl} alt="Before preview" className="w-full h-24 object-cover" />
                  <div className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                    Pre-repair evidence
                  </div>
                </div>
              )}
              {touched.beforeImage && beforeImageError && (
                <p className="text-rose-600 text-[11px] mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{beforeImageError}</span>
                </p>
              )}
            </div>

            {/* After Photo */}
            <div className={`p-3 rounded-xl border transition-all ${
              touched.afterImage && afterImageError
                ? 'border-rose-300 bg-rose-50/20'
                : afterImageUrl && !afterImageError
                ? 'border-emerald-200 bg-emerald-50/20'
                : 'border-slate-200 bg-white'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-civic-600" />
                  <span>After Photo <span className="text-red-500">*</span></span>
                </label>
                {afterImageUrl && !afterImageError && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Uploaded
                  </span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingTarget !== null}
                onChange={(e) => handleFileUpload(e, 'after')}
                className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
              />
              {uploadingTarget === 'after' && (
                <div className="mt-2 p-2 bg-slate-100 rounded-lg flex items-center justify-center gap-1.5 text-slate-600 text-[11px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-civic-600" />
                  <span>Uploading after-photo to Cloudinary...</span>
                </div>
              )}
              {afterImageUrl && (
                <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200">
                  <img src={afterImageUrl} alt="After preview" className="w-full h-24 object-cover" />
                  <div className="absolute bottom-1 right-1 bg-emerald-900/80 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                    Post-repair evidence
                  </div>
                </div>
              )}
              {touched.afterImage && afterImageError && (
                <p className="text-rose-600 text-[11px] mt-1.5 flex items-start gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{afterImageError}</span>
                </p>
              )}
            </div>
          </div>

          {/* Validation Checklist / Guidance */}
          {!isFormValid && (
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[11px] text-amber-800 space-y-1">
              <p className="font-bold flex items-center gap-1 text-amber-900">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Required to enable submission:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px]">
                <span className={workSummaryError ? 'text-amber-700' : 'text-emerald-700 font-semibold'}>
                  {workSummaryError ? '○ Work description (≥10 chars)' : '✓ Work description complete'}
                </span>
                <span className={materialsError ? 'text-amber-700' : 'text-emerald-700 font-semibold'}>
                  {materialsError ? '○ Materials used (≥3 chars)' : '✓ Materials recorded'}
                </span>
                <span className={costError ? 'text-amber-700' : 'text-emerald-700 font-semibold'}>
                  {costError ? '○ Explicit cost amount (₹)' : '✓ Cost recorded'}
                </span>
                <span className={beforeImageError ? 'text-amber-700' : 'text-emerald-700 font-semibold'}>
                  {beforeImageError ? '○ Before-repair photograph' : '✓ Before-photo uploaded'}
                </span>
                <span className={afterImageError ? 'text-amber-700' : 'text-emerald-700 font-semibold'}>
                  {afterImageError ? '○ After-repair photograph' : '✓ After-photo uploaded'}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || submitting || uploadingTarget !== null}
              title={!isFormValid ? 'All mandatory fields must be completed before submission' : 'Submit repair log'}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 ${
                !isFormValid || submitting || uploadingTarget !== null
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-civic-600 text-white hover:bg-civic-700 hover:shadow-md active:scale-[0.98]'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Repair Log...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Repair Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

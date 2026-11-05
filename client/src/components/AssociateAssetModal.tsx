import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SharedIssue, InfrastructureAsset } from '../types';
import { Building2, X, Search, Check, AlertCircle, Link2, MapPin, Activity } from 'lucide-react';
import { RiskBadge, HealthStatusBadge } from './RiskBadge';

interface Props {
  issue: SharedIssue;
  onSuccess: () => void;
  onClose: () => void;
}

export const AssociateAssetModal: React.FC<Props> = ({ issue, onSuccess, onClose }) => {
  const [assets, setAssets] = useState<InfrastructureAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | number>(issue.infrastructure_id || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAssets() {
      try {
        const data = await api.getInfrastructure();
        setAssets(data || []);
      } catch (err) {
        console.error('Failed to load assets', err);
      } finally {
        setLoading(false);
      }
    }
    loadAssets();
  }, []);

  const isCategoryCompatible = (assetCategory: string) => {
    if (!issue.category || !assetCategory) return true;
    const ic = issue.category.toLowerCase();
    const ac = assetCategory.toLowerCase();
    if (ic === ac) return true;
    if ((ic.includes('road') || ic.includes('pothole')) && (ac.includes('road') || ac.includes('pothole'))) return true;
    if ((ic.includes('light') || ic.includes('electr')) && (ac.includes('light') || ac.includes('electr'))) return true;
    if ((ic.includes('water') || ic.includes('leak')) && (ac.includes('water') || ac.includes('pipe') || ac.includes('drain'))) return true;
    if ((ic.includes('drain') || ic.includes('sewag')) && (ac.includes('drain') || ac.includes('sewag') || ac.includes('water'))) return true;
    if ((ic.includes('build') || ic.includes('facil') || ic.includes('struct')) && (ac.includes('build') || ac.includes('facil') || ac.includes('struct'))) return true;
    if ((ic.includes('garb') || ic.includes('sanit') || ic.includes('waste')) && (ac.includes('garb') || ac.includes('sanit') || ac.includes('waste'))) return true;
    return false;
  };

  const filteredAssets = assets.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.asset_code.toLowerCase().includes(q) ||
      a.address.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    // Sort compatible category assets first
    const aComp = isCategoryCompatible(a.category);
    const bComp = isCategoryCompatible(b.category);
    if (aComp && !bComp) return -1;
    if (!aComp && bComp) return 1;
    return 0;
  });

  const selectedAsset = assets.find((a) => String(a.id) === String(selectedAssetId));

  const handleAssociate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setError('Please select an infrastructure asset to link.');
      return;
    }

    if (selectedAsset && !isCategoryCompatible(selectedAsset.category)) {
      setError(`Cannot link a "${issue.category}" complaint to a "${selectedAsset.category}" asset. Please choose a compatible asset.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.associateIssueAsset(issue.id, selectedAssetId);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to associate infrastructure asset.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-civic-500/20 text-civic-300">
              <Link2 className="w-5 h-5 text-civic-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Associate Infrastructure Asset</h3>
              <p className="text-xs text-slate-400">Link Complaint {issue.issue_code} to a monitored municipal asset</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleAssociate} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Issue Summary Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-800 text-[11px]">{issue.issue_code}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                {issue.category}
              </span>
            </div>
            <p className="font-bold text-slate-900 text-xs">{issue.title}</p>
            <p className="text-slate-500 text-[11px] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {issue.address}
            </p>
            <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-600 flex items-center justify-between">
              <span>Current Status:</span>
              <span className="font-semibold text-slate-800">
                {issue.asset_code ? `${issue.asset_code} (${issue.asset_name})` : 'Unlinked (No asset profile)'}
              </span>
            </div>
          </div>

          {/* Asset Search */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Select Infrastructure Asset
            </label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search asset by code, road name, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-civic-500 text-xs"
              />
            </div>

            {loading ? (
              <div className="p-6 text-center text-slate-400">Loading asset registry...</div>
            ) : filteredAssets.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                No infrastructure assets found matching your query.
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
                {filteredAssets.map((asset) => {
                  const compatible = isCategoryCompatible(asset.category);
                  const isSelected = String(asset.id) === String(selectedAssetId);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`p-3 cursor-pointer transition-all flex items-center justify-between gap-3 text-xs ${
                        isSelected
                          ? 'bg-civic-50/80 border-l-4 border-civic-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                            {asset.asset_code}
                          </span>
                          <span className="font-bold text-slate-900 truncate">{asset.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{asset.address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-600 font-medium">{asset.category}</span>
                          {!compatible && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Category mismatch
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <HealthStatusBadge status={asset.current_health_status} />
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'bg-civic-600 border-civic-600 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Asset Confirmation Preview */}
          {selectedAsset && (
            <div className="p-3.5 rounded-2xl bg-civic-50/50 border border-civic-200 text-xs space-y-1">
              <span className="text-[11px] font-bold text-civic-900 block">Target Asset Linked Preview:</span>
              <p className="font-bold text-slate-900">
                {selectedAsset.asset_code} — {selectedAsset.name}
              </p>
              <p className="text-slate-600 text-[11px]">
                Health: <strong className="capitalize">{selectedAsset.current_health_status}</strong> (Risk Score: {selectedAsset.risk_score}/100)
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedAssetId}
              className="px-5 py-2 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              {submitting ? 'Associating...' : 'Associate Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

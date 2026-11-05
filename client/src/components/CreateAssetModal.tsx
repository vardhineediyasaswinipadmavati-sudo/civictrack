import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Department } from '../types';
import { Plus, X, Building2, MapPin, Calendar, Layers, ShieldCheck, AlertCircle } from 'lucide-react';

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

const CATEGORIES = [
  'Roads and potholes',
  'Streetlights and electrical infrastructure',
  'Water supply and leakage',
  'Drainage and sewage',
  'Solid Waste and Sanitation',
  'Public buildings and facilities',
  'Parks and public spaces'
];

export const CreateAssetModal: React.FC<Props> = ({ onSuccess, onClose }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('16.5449');
  const [longitude, setLongitude] = useState('81.5212');
  const [departmentId, setDepartmentId] = useState('');
  const [installationDate, setInstallationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDepartments()
      .then((depts) => {
        setDepartments(depts || []);
        if (depts && depts.length > 0) {
          setDepartmentId(String(depts[0].id));
        }
      })
      .catch((err) => console.error('Failed to load departments', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for the infrastructure asset.');
      return;
    }
    if (!address.trim()) {
      setError('Please provide an address or physical location.');
      return;
    }
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lonNum)) {
      setError('Please enter valid numeric latitude and longitude coordinates.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createInfrastructureAsset({
        asset_code: assetCode.trim() || undefined,
        name: name.trim(),
        category,
        latitude: latNum,
        longitude: lonNum,
        address: address.trim(),
        department_id: departmentId || null,
        installation_date: installationDate,
        description: description.trim() || undefined
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to register new infrastructure asset.');
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
              <Building2 className="w-5 h-5 text-civic-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Register New Infrastructure Asset</h3>
              <p className="text-xs text-slate-400">Add a monitored municipal asset to the Bhimavaram registry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Asset Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. PP Road Arterial Corridor (km 3.2 - 4.0)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-civic-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Responsible Department <span className="text-rose-500">*</span>
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-civic-500"
              >
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Address / Location <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Near Town Hall, Market Yard Road, Bhimavaram"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Latitude <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-civic-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Longitude <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-civic-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Commissioned Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={installationDate}
                onChange={(e) => setInstallationDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Asset Code <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Auto-generated if blank (e.g. AST-RD-101)"
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-civic-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Description / Diagnostic Notes
            </label>
            <textarea
              rows={3}
              placeholder="Physical asset specifications, structural condition notes, materials used..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-civic-500"
            />
          </div>

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
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Registering...' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

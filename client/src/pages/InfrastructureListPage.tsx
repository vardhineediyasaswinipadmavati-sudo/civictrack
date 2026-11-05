import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { InfrastructureAsset } from '../types';
import { RiskBadge, HealthStatusBadge } from '../components/RiskBadge';
import { CreateAssetModal } from '../components/CreateAssetModal';
import {
  Building2,
  MapPin,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Wrench,
  History,
  Activity,
  Plus
} from 'lucide-react';

export const InfrastructureListPage: React.FC = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<InfrastructureAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadAssets = async () => {
    try {
      const data = await api.getInfrastructure();
      setAssets(data);
    } catch (err) {
      console.error('Failed to load infrastructure assets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const filtered = assets.filter((a) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q ||
      a.name.toLowerCase().includes(q) ||
      a.asset_code.toLowerCase().includes(q) ||
      a.address.toLowerCase().includes(q) ||
      (a.category && a.category.toLowerCase().includes(q)) ||
      (a.department_name && a.department_name.toLowerCase().includes(q));

    let matchesCat = true;
    if (categoryFilter) {
      matchesCat = a.category === categoryFilter ||
        (categoryFilter.startsWith('Streetlights') && (a.category?.startsWith('Streetlights') || false)) ||
        (categoryFilter.startsWith('Water') && (a.category?.startsWith('Water') || false));
    }
    const matchesHealth = !healthFilter || a.current_health_status === healthFilter;
    return matchesSearch && matchesCat && matchesHealth;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Infrastructure Asset Registry
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
              {assets.length} Monitored
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Monitored municipal assets with failure histories, recurrence cycles, and rule-based risk ratings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Create New Asset
            </button>
          )}

          <Link
            to="/map"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-bold text-xs shadow-sm"
          >
            <Activity className="w-4 h-4" /> View on GIS Health Map
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by asset code, road name, address, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-civic-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700"
        >
          <option value="">All Categories</option>
          <option value="Roads and potholes">Roads and Potholes</option>
          <option value="Streetlights and electrical infrastructure">Streetlights & Electrical</option>
          <option value="Water supply and leakage">Water Supply</option>
          <option value="Drainage and sewage">Drainage & Sewage</option>
          <option value="Garbage and sanitation">Garbage & Sanitation</option>
          <option value="Public buildings and facilities">Public Buildings & Facilities</option>
          <option value="Parks and public spaces">Parks & Public Spaces</option>
        </select>

        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700"
        >
          <option value="">All Health Statuses</option>
          <option value="good">Good Condition</option>
          <option value="monitoring">Requires Monitoring</option>
          <option value="warning">Repeated Incidents (Warning)</option>
          <option value="critical">High Recurring Risk (Critical)</option>
        </select>

        {(search || categoryFilter || healthFilter) && (
          <button
            onClick={() => { setSearch(''); setCategoryFilter(''); setHealthFilter(''); }}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading infrastructure registry...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-3">
          <p className="text-sm font-semibold text-slate-700">No infrastructure assets matched your filters.</p>
          <p className="text-slate-400">Try adjusting your search terms, category selection, or health status filter.</p>
          {(search || categoryFilter || healthFilter) && (
            <button
              onClick={() => { setSearch(''); setCategoryFilter(''); setHealthFilter(''); }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                      {asset.asset_code}
                    </span>
                    {asset.is_demo && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                        Demo
                      </span>
                    )}
                  </div>
                  <RiskBadge level={asset.risk_level} score={asset.risk_score} />
                </div>

                <Link
                  to={`/infrastructure/${asset.id}`}
                  className="font-bold text-base text-slate-900 hover:text-civic-600 transition-colors block line-clamp-1"
                >
                  {asset.name}
                </Link>

                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 line-clamp-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {asset.address}
                </p>

                <div className="mt-3">
                  <HealthStatusBadge status={asset.current_health_status} />
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center text-xs">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Incidents</span>
                    <strong className="text-slate-900">{asset.unique_incidents_count || 0}</strong>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Repairs</span>
                    <strong className="text-slate-900">{asset.repair_attempts_count || 0}</strong>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Reports</span>
                    <strong className="text-slate-900">{asset.total_citizen_reports || 0}</strong>
                  </div>
                </div>

                {/* Risk Reasons Preview */}
                {asset.risk_reasons && asset.risk_reasons.length > 0 && (
                  <div className="mt-3 text-[11px] text-slate-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    <span className="font-semibold text-amber-900 block mb-0.5">Risk Diagnostic:</span>
                    <p className="line-clamp-2">{asset.risk_reasons[0]}</p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  Commissioned {asset.installation_date}
                </span>
                <Link
                  to={`/infrastructure/${asset.id}`}
                  className="font-bold text-civic-600 hover:text-civic-800 flex items-center gap-1 group"
                >
                  Failure Profile <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create New Asset Modal (Admin Only) */}
      {showCreateModal && (
        <CreateAssetModal
          onSuccess={async () => {
            setShowCreateModal(false);
            await loadAssets();
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../services/api';
import { InfrastructureAsset } from '../types';
import { RiskBadge, HealthStatusBadge } from '../components/RiskBadge';
import {
  MapPin,
  Filter,
  Layers,
  ArrowRight,
  ShieldAlert,
  Activity,
  History,
  Info
} from 'lucide-react';

// Color marker generators for Leaflet
function createColorPin(colorHex: string) {
  return L.divIcon({
    className: 'custom-pin-marker',
    html: `<div style="
      background-color: ${colorHex};
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      border: 2px solid white;
      cursor: pointer;
    ">
      <div style="width: 10px; height: 10px; background-color: white; border-radius: 50%; transform: rotate(45deg);"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

const pinColors = {
  good: createColorPin('#10b981'),      // Green
  monitoring: createColorPin('#f59e0b'),// Yellow
  warning: createColorPin('#f97316'),   // Orange
  critical: createColorPin('#ef4444'),  // Red
};

export const HealthMapPage: React.FC = () => {
  const [assets, setAssets] = useState<InfrastructureAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getInfrastructure();
        setAssets(data);
      } catch (err) {
        console.error('Failed to load map data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredAssets = assets.filter((a) => {
    const matchesCat = !categoryFilter || a.category === categoryFilter;
    const matchesRisk = !riskFilter || a.risk_level === riskFilter;
    return matchesCat && matchesRisk;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-civic-500/10 text-civic-700 text-xs font-semibold mb-2">
            <Activity className="w-3.5 h-3.5 text-civic-600" />
            <span>GIS Municipal Health Sensor</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Infrastructure Health Map
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Geographic condition visualization reflecting stored failure incidents, recurrence frequency, and rule-based risk levels.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium focus:ring-1 focus:ring-civic-500"
          >
            <option value="">All Categories</option>
            <option value="Roads and potholes">Roads and potholes</option>
            <option value="Streetlights and electrical infrastructure">Streetlights & Electrical</option>
            <option value="Water supply and leakage">Water Supply</option>
            <option value="Drainage and sewage">Drainage & Sewage</option>
            <option value="Public buildings and facilities">Public Facilities</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium focus:ring-1 focus:ring-civic-500"
          >
            <option value="">All Risk Levels</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
            <option value="Critical">Critical Risk</option>
          </select>
        </div>
      </div>

      {/* Map Container & Legend */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-100 h-[620px]">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
            Loading GIS infrastructure markers...
          </div>
        ) : (
          <MapContainer
            center={[16.5449, 81.5212]}
            zoom={14}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {filteredAssets.map((asset) => {
              const markerIcon = pinColors[asset.current_health_status] || pinColors.good;
              return (
                <Marker
                  key={asset.id}
                  position={[asset.latitude, asset.longitude]}
                  icon={markerIcon}
                >
                  <Popup>
                    <div className="p-4 w-72 space-y-3 text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {asset.asset_code}
                        </span>
                        <RiskBadge level={asset.risk_level} score={asset.risk_score} />
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">{asset.name}</h4>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {asset.address}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center text-[11px]">
                        <div>
                          <span className="text-slate-400 block">Unique Failures</span>
                          <strong className="text-slate-800">{asset.unique_incidents_count || 0} incidents</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Citizen Reports</span>
                          <strong className="text-slate-800">{asset.total_citizen_reports || 0} reports</strong>
                        </div>
                      </div>

                      {asset.last_repair_date && (
                        <p className="text-[11px] text-slate-500">
                          Last repair: <strong>{new Date(asset.last_repair_date).toLocaleDateString()}</strong>
                        </p>
                      )}

                      <Link
                        to={`/infrastructure/${asset.id}`}
                        className="w-full py-1.5 px-3 bg-civic-600 hover:bg-civic-700 text-white font-bold rounded-lg text-center flex items-center justify-center gap-1 shadow-sm"
                      >
                        View Failure Profile <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}

        {/* Interactive Floating Legend (Section 5 Feature 7) */}
        <div className="absolute top-4 right-4 z-[400] bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 text-xs space-y-2.5 max-w-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-civic-600" /> Condition Legend
            </span>
            <span className="text-[10px] text-slate-400">{filteredAssets.length} Assets</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700"><strong>Green:</strong> Sound / No recurring defect</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700"><strong>Yellow:</strong> Requires Monitoring</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-orange-500 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700"><strong>Orange:</strong> Repeated Incidents</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700"><strong>Red:</strong> High Recurring Risk</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-tight">
            Map displays stored infrastructure records within city boundaries for preventive engineering oversight.
          </div>
        </div>
      </div>
    </div>
  );
};

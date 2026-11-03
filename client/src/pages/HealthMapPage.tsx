import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../services/api';
import { InfrastructureAsset, SharedIssue } from '../types';
import { RiskBadge } from '../components/RiskBadge';
import {
  MapPin,
  Layers,
  ArrowRight,
  Activity,
  Plus,
  Minus,
  RotateCcw,
  Crosshair,
  Compass,
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Wrench
} from 'lucide-react';

const BHIMAVARAM_CENTER: [number, number] = [16.5449, 81.5212];
const DEFAULT_ZOOM = 14;

// 1. Color marker generator for Infrastructure Assets
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

// 2. Category & status-based marker generator for Civic Complaints (Shared Issues)
function createComplaintPin(category: string, status: string) {
  let bgColor = '#0284c7'; // default sky-blue
  const cat = (category || '').toLowerCase();
  if (cat.includes('road') || cat.includes('pothole')) bgColor = '#d97706'; // Amber/Orange
  else if (cat.includes('light') || cat.includes('electr')) bgColor = '#eab308'; // Gold
  else if (cat.includes('water') || cat.includes('drain') || cat.includes('sewag')) bgColor = '#0284c7'; // Sky Blue
  else if (cat.includes('sanit') || cat.includes('garb') || cat.includes('waste')) bgColor = '#10b981'; // Green
  else if (cat.includes('build') || cat.includes('facil')) bgColor = '#8b5cf6'; // Purple

  const isResolved = status === 'Resolved';
  const ringColor = isResolved ? '#10b981' : '#ffffff';

  return L.divIcon({
    className: 'custom-complaint-marker',
    html: `<div style="
      background: ${bgColor};
      width: 30px;
      height: 30px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.32);
      border: 2px solid ${ringColor};
      cursor: pointer;
    ">
      <div style="width: 10px; height: 10px; border-radius: 50%; background: white; transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
        <div style="width: 5px; height: 5px; border-radius: 50%; background: ${bgColor};"></div>
      </div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
}

// 3. User Geolocation pulse marker
const userLocationPin = L.divIcon({
  className: 'custom-user-location-marker',
  html: `<div style="
    position: relative;
    width: 20px;
    height: 20px;
    background: #0284c7;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 10px rgba(2, 132, 199, 0.8);
  ">
    <div style="
      position: absolute;
      top: -5px;
      left: -5px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(2, 132, 199, 0.3);
      animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
    "></div>
  </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

// Map Controller Component for visible controls, safe zooming & geolocation
interface MapControlsProps {
  initialCenter: [number, number];
  initialZoom: number;
  userLocation: [number, number] | null;
  setUserLocation: (pos: [number, number] | null) => void;
}

function MapControlsController({ initialCenter, initialZoom, userLocation, setUserLocation }: MapControlsProps) {
  const map = useMap();
  const [currentCenter, setCurrentCenter] = useState<[number, number]>(initialCenter);
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);
  const [locating, setLocating] = useState(false);

  useMapEvents({
    move() {
      const c = map.getCenter();
      setCurrentCenter([Number(c.lat.toFixed(4)), Number(c.lng.toFixed(4))]);
    },
    zoomend() {
      setCurrentZoom(map.getZoom());
    }
  });

  // Ensure wheel events over the map never trigger document/browser zoom when Ctrl is held,
  // and keep mouse wheel zooms smoothly confined to the map canvas.
  useEffect(() => {
    const container = map.getContainer();
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
      e.stopPropagation();
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [map]);

  const handleZoomIn = () => {
    map.zoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
  };

  const handleReset = () => {
    map.flyTo(initialCenter, initialZoom, { duration: 0.8 });
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        map.flyTo(coords, 16, { duration: 1 });
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation failed or denied:', err.message);
        setLocating(false);
        alert('Could not access current location. Please verify location permissions.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <>
      {/* Floating Control Bar inside map (Top Left) */}
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-slate-200">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          aria-label="Zoom In"
          className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-civic-700 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 font-bold"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-civic-700 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 font-bold"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-200 my-0.5" />
        <button
          type="button"
          onClick={handleReset}
          title="Reset View to Bhimavaram Center"
          aria-label="Reset View to Bhimavaram Center"
          className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-civic-700 hover:bg-slate-100 rounded-xl transition-colors active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleLocateMe}
          title="Center on My Location"
          aria-label="Center on My Location"
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors active:scale-95 ${
            locating ? 'text-amber-600 bg-amber-50 animate-pulse' : 'text-slate-700 hover:text-civic-700 hover:bg-slate-100'
          }`}
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic Coordinates Indicator Badge (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-[11px] font-mono text-slate-600 flex items-center gap-2 pointer-events-none">
        <Compass className="w-3.5 h-3.5 text-civic-600 shrink-0" />
        <span>Bhimavaram Center: {currentCenter[0].toFixed(4)}°N, {currentCenter[1].toFixed(4)}°E</span>
        <span className="text-slate-300">•</span>
        <span className="font-semibold text-slate-800">Zoom {currentZoom}</span>
      </div>
    </>
  );
}

export const HealthMapPage: React.FC = () => {
  const [assets, setAssets] = useState<InfrastructureAsset[]>([]);
  const [issues, setIssues] = useState<SharedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [layerType, setLayerType] = useState<'all' | 'complaints' | 'assets'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [assetsData, issuesData] = await Promise.all([
          api.getInfrastructure().catch(() => []),
          api.getIssues().catch(() => [])
        ]);
        setAssets(Array.isArray(assetsData) ? assetsData : []);
        setIssues(Array.isArray(issuesData) ? issuesData : []);
      } catch (err) {
        console.error('Failed to load map data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredAssets = assets.filter((a) => {
    if (layerType === 'complaints') return false;
    const matchesCat = !categoryFilter || a.category === categoryFilter;
    const matchesRisk = !riskFilter || a.risk_level === riskFilter;
    const hasValidCoords = typeof a.latitude === 'number' && typeof a.longitude === 'number' && !isNaN(a.latitude) && !isNaN(a.longitude);
    return matchesCat && matchesRisk && hasValidCoords;
  });

  const filteredIssues = issues.filter((iss) => {
    if (layerType === 'assets') return false;
    const matchesCat = !categoryFilter || iss.category === categoryFilter;
    const matchesRisk = !riskFilter || iss.severity === riskFilter;
    const hasValidCoords = typeof iss.latitude === 'number' && typeof iss.longitude === 'number' && !isNaN(iss.latitude) && !isNaN(iss.longitude);
    return matchesCat && matchesRisk && hasValidCoords;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-civic-500/10 text-civic-700 text-xs font-semibold mb-2">
            <Activity className="w-3.5 h-3.5 text-civic-600" />
            <span>GIS Municipal Sensor & Incident Map</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Infrastructure Health & Incident Map
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Interactive GIS viewer combining infrastructure asset health and citizen-reported civic complaints across Bhimavaram.
          </p>
        </div>

        {/* Layer & Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Layer Mode Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLayerType('all')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                layerType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Layers
            </button>
            <button
              type="button"
              onClick={() => setLayerType('complaints')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                layerType === 'complaints' ? 'bg-white text-civic-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Complaints ({filteredIssues.length})
            </button>
            <button
              type="button"
              onClick={() => setLayerType('assets')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                layerType === 'assets' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Assets ({filteredAssets.length})
            </button>
          </div>

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
            <option value="Solid waste and sanitation">Sanitation & Waste</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium focus:ring-1 focus:ring-civic-500"
          >
            <option value="">All Severity / Risk</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Map Container & Legend */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-100 h-[540px] sm:h-[620px] lg:h-[680px] w-full isolation-auto select-none">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
            Loading GIS infrastructure markers and complaints...
          </div>
        ) : (
          <MapContainer
            center={BHIMAVARAM_CENTER}
            zoom={DEFAULT_ZOOM}
            minZoom={11}
            maxZoom={18}
            scrollWheelZoom={true}
            wheelDebounceTime={40}
            wheelPxPerZoomLevel={120}
            zoomSnap={0.5}
            zoomDelta={0.5}
            zoomControl={false}
            dragging={true}
            doubleClickZoom={true}
            touchZoom={true}
            className="w-full h-full"
            style={{ touchAction: 'pan-x pan-y' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Custom Interactive Controls & Safe Geolocation Controller */}
            <MapControlsController
              initialCenter={BHIMAVARAM_CENTER}
              initialZoom={DEFAULT_ZOOM}
              userLocation={userLocation}
              setUserLocation={setUserLocation}
            />

            {/* User Location Marker */}
            {userLocation && (
              <Marker position={userLocation} icon={userLocationPin}>
                <Popup>
                  <div className="p-2 text-xs font-semibold text-slate-800">
                    Your Current Location ({userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)})
                  </div>
                </Popup>
              </Marker>
            )}

            {/* 1. Infrastructure Assets Markers */}
            {filteredAssets.map((asset) => {
              const markerIcon = pinColors[asset.current_health_status] || pinColors.good;
              return (
                <Marker
                  key={`asset-${asset.id}`}
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
                        <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 mb-0.5">
                          <Wrench className="w-3 h-3" /> Infrastructure Asset
                        </div>
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

            {/* 2. Civic Complaints (Shared Issues) Markers */}
            {filteredIssues.map((issue) => {
              const markerIcon = createComplaintPin(issue.category, issue.status);
              return (
                <Marker
                  key={`issue-${issue.id}`}
                  position={[issue.latitude, issue.longitude]}
                  icon={markerIcon}
                >
                  <Popup>
                    <div className="p-4 w-72 space-y-3 text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-slate-800 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                          {issue.issue_code}
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          issue.status === 'Resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : issue.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {issue.status}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-600 mb-0.5">
                          <AlertCircle className="w-3 h-3" /> Civic Complaint
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">{issue.title}</h4>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {issue.address}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center text-[11px]">
                        <div>
                          <span className="text-slate-400 block">Severity</span>
                          <strong className="text-slate-800">{issue.severity}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Reports Filed</span>
                          <strong className="text-slate-800">{issue.citizen_reports_count || (issue as any).report_count || 1} citizens</strong>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {issue.description}
                      </p>

                      <Link
                        to={`/issues/${issue.id}`}
                        className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-center flex items-center justify-center gap-1 shadow-sm"
                      >
                        Inspect Civic Issue <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        )}

        {/* Interactive Floating Legend (Top Right) */}
        <div className="absolute top-4 right-4 z-[400] bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 text-xs space-y-2.5 max-w-xs pointer-events-auto">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-civic-600" /> Map Legend
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {filteredAssets.length} Assets • {filteredIssues.length} Complaints
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-0.5">
              Infrastructure Condition
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700"><strong>Green:</strong> Sound condition</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700"><strong>Yellow:</strong> Requires monitoring</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700"><strong>Red:</strong> High recurring failure risk</span>
            </div>

            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-1.5 border-t border-slate-100">
              Civic Complaints
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-600 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700">Roads & Potholes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-sky-600 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700">Water Supply & Sewage</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white shadow-sm shrink-0" />
              <span className="text-slate-700">Electrical & Streetlights</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-tight">
            Use the mouse wheel or on-screen controls to zoom. Drag to pan in any direction across Bhimavaram.
          </div>
        </div>
      </div>
    </div>
  );
};

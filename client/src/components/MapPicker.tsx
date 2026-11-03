import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  MapContainer,
  Marker,
  useMap,
  useMapEvents
} from 'react-leaflet';
import { MapTileLayer } from './MapTileLayer';
import L from 'leaflet';
import {
  MapPin,
  Plus,
  Minus,
  RotateCcw,
  Crosshair,
  Search,
  Loader2,
  X
} from 'lucide-react';

const BHIMAVARAM_DEFAULT: [number, number] = [16.5449, 81.5212];

// Custom modern SVG marker icon with crisp drop shadow
const pinIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div style="
    background-color: #0284c7;
    width: 34px;
    height: 34px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.45);
    border: 2.5px solid white;
    cursor: grab;
  ">
    <div style="width: 10px; height: 10px; background-color: white; border-radius: 50%; transform: rotate(45deg);"></div>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34]
});

interface Props {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lon: number) => void;
  onAddressChange?: (address: string, requestTimestamp?: number) => void;
  onGeocodingLoading?: (loading: boolean) => void;
  height?: string;
}

interface SearchResult {
  name: string;
  lat: number;
  lon: number;
  address: string;
}

// Format reverse-geocoded address into clean municipal location string
function formatAddress(data: any): string {
  if (!data) return '';
  const a = data.address;
  if (a) {
    const parts = [
      a.building || a.amenity || a.shop || a.office,
      a.house_number,
      a.road || a.pedestrian || a.path || a.street,
      a.neighbourhood || a.suburb || a.residential,
      a.city_district || a.ward,
      a.city || a.town || a.village || 'Bhimavaram',
      a.postcode,
      a.state || 'Andhra Pradesh'
    ].filter(Boolean);

    if (parts.length >= 2) {
      return parts.join(', ');
    }
  }
  return data.display_name || '';
}

// Robust multi-tier reverse geocoding with strict 4-second timeout and fallback
async function reverseGeocodeCoords(
  lat: number,
  lon: number,
  signal: AbortSignal
): Promise<string> {
  // Strategy 1: BigDataCloud client reverse geocoding (fast, free, client-side friendly, no 403 on cloud deployments)
  try {
    const bdcUrl = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
    bdcUrl.searchParams.set('latitude', String(lat));
    bdcUrl.searchParams.set('longitude', String(lon));
    bdcUrl.searchParams.set('localityLanguage', 'en');

    const bdcRes = await fetch(bdcUrl.toString(), { signal });
    if (bdcRes.ok) {
      const data = await bdcRes.json();
      const rawParts = [
        data.locality,
        data.city && data.city !== data.locality ? data.city : null,
        data.principalSubdivision || 'Andhra Pradesh',
        data.postcode
      ].filter(Boolean);
      const uniqueParts = Array.from(new Set(rawParts));

      if (uniqueParts.length >= 2) {
        return uniqueParts.join(', ');
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // Strategy 2: Komoot Photon Reverse Geocode (free, fast, based on OSM data)
  try {
    const photonUrl = new URL('https://photon.komoot.io/reverse');
    photonUrl.searchParams.set('lat', String(lat));
    photonUrl.searchParams.set('lon', String(lon));

    const pRes = await fetch(photonUrl.toString(), { signal });
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pData && pData.features && pData.features.length > 0) {
        const prop = pData.features[0].properties || {};
        const parts = [
          prop.housenumber,
          prop.street,
          prop.district || prop.suburb,
          prop.city || prop.town || 'Bhimavaram',
          prop.state || 'Andhra Pradesh'
        ].filter(Boolean);
        if (parts.length >= 2) return parts.join(', ');
        if (prop.name) return `${prop.name}, Bhimavaram, Andhra Pradesh`;
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // Strategy 3: OpenStreetMap Nominatim reverse
  try {
    const nomUrl = new URL('https://nominatim.openstreetmap.org/reverse');
    nomUrl.searchParams.set('format', 'jsonv2');
    nomUrl.searchParams.set('lat', String(lat));
    nomUrl.searchParams.set('lon', String(lon));
    nomUrl.searchParams.set('addressdetails', '1');

    const nomRes = await fetch(nomUrl.toString(), { signal });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const formatted = formatAddress(nomData);
      if (formatted) return formatted;
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // Fallback: Return clean coordinate representation so form is never stuck empty
  return `Near Coordinates (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E), Bhimavaram`;
}

// Draggable & clickable marker component
function DraggableLocationMarker({
  position,
  onChange
}: {
  position: [number, number];
  onChange: (lat: number, lon: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  // Click anywhere on map to reposition pin
  useMapEvents({
    click(e) {
      onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    }
  });

  // Drag pin to fine-tune exact location
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          onChange(Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6)));
        }
      }
    }),
    [onChange]
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={pinIcon}
    />
  );
}

// Location search bar component inside the map canvas
function LocationSearch({
  onSelect,
  onAddressChange
}: {
  onSelect: (lat: number, lon: number) => void;
  onAddressChange?: (address: string, requestTimestamp?: number) => void;
}) {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setSearching(true);
    setError('');
    setResults([]);
    setIsOpen(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      // 1. Try Photon Geocoding with Bhimavaram coordinate bias
      const photonUrl = new URL('https://photon.komoot.io/api/');
      photonUrl.searchParams.set('q', cleanQuery);
      photonUrl.searchParams.set('limit', '5');
      photonUrl.searchParams.set('lat', String(BHIMAVARAM_DEFAULT[0]));
      photonUrl.searchParams.set('lon', String(BHIMAVARAM_DEFAULT[1]));

      const response = await fetch(photonUrl.toString(), { signal: controller.signal });
      if (response.ok) {
        const data = await response.json();
        const places: SearchResult[] = (data.features || []).map((feature: any) => {
          const p = feature.properties || {};
          const coords = feature.geometry.coordinates;
          const address = [
            p.housenumber,
            p.street,
            p.suburb || p.district,
            p.city || p.town || p.village || 'Bhimavaram',
            p.state || 'Andhra Pradesh'
          ].filter(Boolean).join(', ');

          return {
            name: p.name || p.street || address || 'Search location',
            lat: Number(coords[1].toFixed(6)),
            lon: Number(coords[0].toFixed(6)),
            address: address || p.name || ''
          };
        });

        if (places.length > 0) {
          setResults(places);
          setSearching(false);
          clearTimeout(timeoutId);
          return;
        }
      }

      // 2. Fallback to OpenStreetMap Nominatim search
      const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
      nominatimUrl.searchParams.set('format', 'jsonv2');
      nominatimUrl.searchParams.set('q', `${cleanQuery}, Bhimavaram`);
      nominatimUrl.searchParams.set('limit', '5');
      nominatimUrl.searchParams.set('addressdetails', '1');

      const nomRes = await fetch(nominatimUrl.toString(), { signal: controller.signal });
      if (nomRes.ok) {
        const nomData = await nomRes.json();
        const nomPlaces: SearchResult[] = (nomData || []).map((item: any) => ({
          name: item.name || item.display_name.split(',')[0],
          lat: Number(parseFloat(item.lat).toFixed(6)),
          lon: Number(parseFloat(item.lon).toFixed(6)),
          address: formatAddress(item)
        }));

        if (nomPlaces.length > 0) {
          setResults(nomPlaces);
        } else {
          setError('No locations found in Bhimavaram. Try another keyword.');
        }
      } else {
        setError('Location search currently unavailable.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Geocoding search error:', err);
      }
      setError('Search lookup failed. You can click anywhere on the map directly.');
    } finally {
      clearTimeout(timeoutId);
      setSearching(false);
    }
  };

  const handleSelect = (place: SearchResult) => {
    map.flyTo([place.lat, place.lon], 16, { duration: 0.8 });
    onSelect(place.lat, place.lon);
    if (onAddressChange && place.address) {
      onAddressChange(place.address, Date.now());
    }
    setQuery(place.name);
    setIsOpen(false);
    setResults([]);
    setError('');
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError('');
  };

  return (
    <div
      ref={searchBoxRef}
      className="absolute top-3 left-3 z-[500] w-[min(340px,calc(100%-88px))] pointer-events-auto"
    >
      <form
        onSubmit={handleSearch}
        className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-1.5 transition-all focus-within:ring-2 focus-within:ring-civic-500 focus-within:border-civic-500"
      >
        <Search className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) setIsOpen(false);
          }}
          placeholder="Search street, area or landmark..."
          className="min-w-0 flex-1 outline-none text-xs text-slate-800 bg-transparent placeholder:text-slate-400"
          aria-label="Search landmark or area"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="bg-civic-600 hover:bg-civic-700 disabled:opacity-50 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 flex items-center gap-1"
        >
          {searching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            'Find'
          )}
        </button>
      </form>

      {/* Results Dropdown */}
      {isOpen && (results.length > 0 || error) && (
        <div className="mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-60 overflow-y-auto">
          {results.map((place, index) => (
            <button
              key={`${place.lat}-${place.lon}-${index}`}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full text-left px-3.5 py-2.5 hover:bg-civic-50/70 border-b last:border-0 border-slate-100 flex items-start gap-2.5 transition-colors group"
            >
              <MapPin className="w-3.5 h-3.5 text-civic-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {place.name}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {place.address}
                </p>
              </div>
            </button>
          ))}

          {error && (
            <div className="p-3 text-[11px] text-amber-700 bg-amber-50/60 text-center">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Map picker internal controls toolbar
function PickerControlsController({
  position,
  onChange
}: {
  position: [number, number];
  onChange: (lat: number, lon: number) => void;
}) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  // Prevent browser window zoom on Ctrl + mouse wheel over map
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

  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();

  const handleRecenter = () => {
    map.flyTo(BHIMAVARAM_DEFAULT, 15, { duration: 0.7 });
    onChange(BHIMAVARAM_DEFAULT[0], BHIMAVARAM_DEFAULT[1]);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        map.flyTo([lat, lon], 16, { duration: 0.8 });
        onChange(lat, lon);
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation failed:', err.message);
        setLocating(false);
        alert('Could not retrieve current location. Please verify location permissions.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-slate-200">
      <button
        type="button"
        onClick={handleZoomIn}
        title="Zoom In"
        aria-label="Zoom In"
        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-civic-700 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 font-bold"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={handleZoomOut}
        title="Zoom Out"
        aria-label="Zoom Out"
        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-civic-700 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 font-bold"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <div className="h-px bg-slate-200 my-0.5" />
      <button
        type="button"
        onClick={handleRecenter}
        title="Recenter to Bhimavaram"
        aria-label="Recenter to Bhimavaram"
        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-civic-700 hover:bg-slate-100 rounded-xl transition-colors active:scale-95"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={handleLocateMe}
        title="Pin My Current Location"
        aria-label="Pin My Current Location"
        className={`w-7 h-7 flex items-center justify-center rounded-xl transition-colors active:scale-95 ${
          locating ? 'text-amber-600 bg-amber-50 animate-pulse' : 'text-slate-700 hover:text-civic-700 hover:bg-slate-100'
        }`}
      >
        <Crosshair className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export const MapPicker: React.FC<Props> = ({
  latitude,
  longitude,
  onChange,
  onAddressChange,
  onGeocodingLoading,
  height = '300px'
}) => {
  const [detecting, setDetecting] = useState(false);

  // Keep references to latest callbacks so changes don't retrigger effects
  const onAddressChangeRef = useRef(onAddressChange);
  const onGeocodingLoadingRef = useRef(onGeocodingLoading);
  useEffect(() => {
    onAddressChangeRef.current = onAddressChange;
    onGeocodingLoadingRef.current = onGeocodingLoading;
  });

  const position: [number, number] = [
    typeof latitude === 'number' && !isNaN(latitude) && latitude !== 0 ? latitude : BHIMAVARAM_DEFAULT[0],
    typeof longitude === 'number' && !isNaN(longitude) && longitude !== 0 ? longitude : BHIMAVARAM_DEFAULT[1]
  ];

  // Track initial mount and last geocoded position to avoid redundant requests
  const isFirstMountRef = useRef(true);
  const prevGeocodedCoordsRef = useRef<[number, number]>([position[0], position[1]]);
  const activeControllerRef = useRef<AbortController | null>(null);

  // Automatic reverse geocoding with debounce whenever marker moves
  useEffect(() => {
    // If onAddressChange is not provided, nothing to do
    if (!onAddressChangeRef.current) return;

    // On initial mount, don't re-geocode if parent already has initial coordinates
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    const [curLat, curLon] = position;
    const [prevLat, prevLon] = prevGeocodedCoordsRef.current;

    // Check if coordinates moved significantly (more than ~1 meter)
    if (Math.abs(curLat - prevLat) < 0.00001 && Math.abs(curLon - prevLon) < 0.00001) {
      return;
    }

    // Cancel any in-flight request
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }

    const requestTimestamp = Date.now();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let abortTimeout: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    activeControllerRef.current = controller;

    // Debounce the fetch by 400ms so rapid dragging doesn't flood requests
    debounceTimer = setTimeout(async () => {
      // Indicate loading
      setDetecting(true);
      onGeocodingLoadingRef.current?.(true);

      // Hard safety timeout of 4 seconds
      abortTimeout = setTimeout(() => {
        controller.abort();
      }, 4000);

      try {
        const detectedAddress = await reverseGeocodeCoords(curLat, curLon, controller.signal);
        if (detectedAddress && !controller.signal.aborted) {
          prevGeocodedCoordsRef.current = [curLat, curLon];
          onAddressChangeRef.current?.(detectedAddress, requestTimestamp);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Reverse geocoding error:', err.message);
        }
      } finally {
        if (abortTimeout) clearTimeout(abortTimeout);
        setDetecting(false);
        onGeocodingLoadingRef.current?.(false);
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
        }
      }
    }, 400);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (abortTimeout) clearTimeout(abortTimeout);
      controller.abort();
      setDetecting(false);
      onGeocodingLoadingRef.current?.(false);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    };
  }, [position[0], position[1]]);

  return (
    <div
      className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative w-full select-none"
      style={{ height }}
    >
      <MapContainer
        center={position}
        zoom={14}
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
        <MapTileLayer />

        {/* Location Search Bar */}
        <LocationSearch
          onSelect={onChange}
          onAddressChange={onAddressChange}
        />

        {/* Draggable Marker */}
        <DraggableLocationMarker
          position={position}
          onChange={onChange}
        />

        {/* Zoom, Recenter & GPS Controls */}
        <PickerControlsController
          position={position}
          onChange={onChange}
        />
      </MapContainer>

      {/* Coordinate & Status Badge at bottom */}
      <div className="absolute bottom-2.5 left-2.5 z-[400] bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-[11px] font-medium text-slate-700 flex items-center gap-2 pointer-events-none">
        <MapPin className="w-3.5 h-3.5 text-civic-600 shrink-0" />
        <span>
          Pin: {position[0].toFixed(4)}°N, {position[1].toFixed(4)}°E
        </span>
        {detecting && (
          <span className="flex items-center gap-1 text-[10px] text-civic-600 font-semibold border-l border-slate-200 pl-2">
            <Loader2 className="w-3 h-3 animate-spin text-civic-600" />
            Detecting...
          </span>
        )}
      </div>
    </div>
  );
};

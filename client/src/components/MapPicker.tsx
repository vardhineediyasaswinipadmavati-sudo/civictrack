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
  onAddressChange?: (address: string, requestTimestamp?: number, isExplicitUserAction?: boolean) => void;
  onGeocodingLoading?: (loading: boolean) => void;
  height?: string;
}

export interface TypeBadge {
  label: string;
  color: string;
}

export interface SearchResult {
  name: string;
  lat: number;
  lon: number;
  subtitle: string;
  address: string;
  typeBadge: TypeBadge;
}

// Haversine distance in kilometers for proximity ranking & deduplication
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Categorize and generate visually distinct badges for search results
function getTypeBadge(category?: string, type?: string, name?: string): TypeBadge {
  const cat = (category || '').toLowerCase();
  const typ = (type || '').toLowerCase();
  const nm = (name || '').toLowerCase();

  // Colleges, Universities & Educational institutions
  if (
    typ === 'college' ||
    typ === 'university' ||
    typ === 'school' ||
    (cat === 'amenity' && (typ === 'college' || typ === 'university' || typ === 'school')) ||
    nm.includes('college') ||
    nm.includes('university') ||
    nm.includes('campus')
  ) {
    return { label: 'College / Campus', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  }

  // Railway & Transit
  if (
    cat === 'railway' ||
    typ === 'station' ||
    typ === 'halt' ||
    typ === 'bus_stop' ||
    typ === 'bus_station' ||
    nm.includes('railway') ||
    nm.includes('station') ||
    nm.includes('junction')
  ) {
    return { label: 'Railway / Transit', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }

  // Highways, Streets & Roads
  if (
    cat === 'highway' ||
    typ === 'road' ||
    typ === 'street' ||
    typ === 'primary' ||
    typ === 'secondary' ||
    typ === 'tertiary' ||
    typ === 'unclassified' ||
    typ === 'residential' ||
    typ === 'service' ||
    nm.includes('road') ||
    nm.includes('street') ||
    nm.includes('marg') ||
    nm.includes('lane') ||
    nm.includes('highway')
  ) {
    return { label: 'Road / Street', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  }

  // Mandal & Administrative Boundaries
  if (
    typ === 'administrative' ||
    cat === 'boundary' ||
    nm.includes('mandal') ||
    nm.includes('district')
  ) {
    return { label: 'Mandal / Boundary', color: 'bg-purple-50 text-purple-700 border-purple-200' };
  }

  // Villages, Towns, Cities & Localities
  if (
    typ === 'village' ||
    typ === 'hamlet' ||
    typ === 'suburb' ||
    typ === 'neighbourhood' ||
    typ === 'town' ||
    typ === 'city' ||
    cat === 'place'
  ) {
    if (typ === 'village' || typ === 'hamlet') {
      return { label: 'Village', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (typ === 'town' || typ === 'city') {
      return { label: 'Town / City', color: 'bg-sky-50 text-sky-700 border-sky-200' };
    }
    return { label: 'Locality / Area', color: 'bg-blue-50 text-blue-700 border-blue-200' };
  }

  // Healthcare / Hospitals
  if (typ === 'hospital' || typ === 'clinic' || typ === 'pharmacy' || nm.includes('hospital')) {
    return { label: 'Healthcare', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  }

  return { label: 'Landmark', color: 'bg-slate-100 text-slate-700 border-slate-200' };
}

// Format Nominatim search item into structured SearchResult
function formatNominatimSearchResult(item: any): SearchResult {
  let name = item.name || (item.display_name ? item.display_name.split(',')[0].trim() : 'Location');
  const cat = (item.category || item.class || '').toLowerCase();
  const typ = (item.type || '').toLowerCase();

  // If station name is just the town/village (e.g. "Undi" railway station), clarify as station
  if (
    (cat === 'railway' || typ === 'station') &&
    !name.toLowerCase().includes('station') &&
    !name.toLowerCase().includes('junction')
  ) {
    name = `${name} Railway Station`;
  }

  const addr = item.address || {};
  const road = addr.road || addr.pedestrian || addr.street || addr.highway || addr.path;
  const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.village || addr.hamlet;
  const town = addr.town || addr.city;
  const mandal = addr.county;
  const district = addr.state_district;
  const state = addr.state || 'Andhra Pradesh';
  const pin = addr.postcode;

  const parts: string[] = [];
  if (road && road !== name && !name.includes(road)) parts.push(road);
  if (locality && locality !== name && !name.includes(locality) && !parts.includes(locality)) parts.push(locality);
  if (town && town !== locality && !name.includes(town) && !parts.includes(town)) parts.push(town);
  if (mandal && !name.includes(mandal) && !parts.includes(mandal)) parts.push(mandal);
  if (district && !name.includes(district) && !parts.includes(district)) parts.push(district);
  if (state && !parts.includes(state)) parts.push(state);
  if (pin) parts.push(pin);

  const subtitle = parts.join(', ');
  const fullAddress = [name, subtitle].filter(Boolean).join(', ');
  const typeBadge = getTypeBadge(cat, typ, name);

  return {
    name,
    subtitle: subtitle || state,
    address: fullAddress,
    lat: Number(parseFloat(item.lat).toFixed(6)),
    lon: Number(parseFloat(item.lon).toFixed(6)),
    typeBadge
  };
}

// Format Photon search feature into structured SearchResult
function formatPhotonSearchResult(feature: any, originalQuery: string): SearchResult {
  const p = feature.properties || {};
  const coords = feature.geometry?.coordinates || [0, 0];
  let name = p.name || p.street || originalQuery;
  const cat = (p.osm_key || '').toLowerCase();
  const typ = (p.osm_value || '').toLowerCase();

  if (
    (cat === 'railway' || typ === 'station') &&
    !name.toLowerCase().includes('station') &&
    !name.toLowerCase().includes('junction')
  ) {
    name = `${name} Railway Station`;
  }

  const road = p.street;
  const locality = p.suburb || p.district || p.village;
  const town = p.city || p.town;
  const mandal = p.county;
  const state = p.state || 'Andhra Pradesh';
  const pin = p.postcode;

  const parts: string[] = [];
  if (road && road !== name && !name.includes(road)) parts.push(road);
  if (locality && locality !== name && !name.includes(locality) && !parts.includes(locality)) parts.push(locality);
  if (town && town !== locality && !name.includes(town) && !parts.includes(town)) parts.push(town);
  if (mandal && !name.includes(mandal) && !parts.includes(mandal)) parts.push(mandal);
  if (state && !parts.includes(state)) parts.push(state);
  if (pin) parts.push(pin);

  const subtitle = parts.join(', ');
  const fullAddress = [name, subtitle].filter(Boolean).join(', ');
  const typeBadge = getTypeBadge(cat, typ, name);

  return {
    name,
    subtitle: subtitle || state,
    address: fullAddress,
    lat: Number(Number(coords[1]).toFixed(6)),
    lon: Number(Number(coords[0]).toFixed(6)),
    typeBadge
  };
}

// Generate progressive search query variants for multi-part inputs
function generateQueryVariants(rawQuery: string): string[] {
  const q = rawQuery.trim();
  const variants: string[] = [q];
  const parts = q.split(',').map((p) => p.trim()).filter(Boolean);

  if (parts.length > 1) {
    // Primary landmark/entity alone (e.g. "SRKR Engineering College" or "Undi Road")
    if (parts[0] && !variants.includes(parts[0])) {
      variants.push(parts[0]);
    }
    // Primary entity + final region (e.g. "SRKR Engineering College, Bhimavaram")
    if (parts.length > 2) {
      const firstAndLast = `${parts[0]}, ${parts[parts.length - 1]}`;
      if (!variants.includes(firstAndLast)) {
        variants.push(firstAndLast);
      }
    }
  }

  // Strip trailing locality qualifiers if present
  const withoutTrailing = q.replace(/,\s*(Bhimavaram|Andhra Pradesh|AP).*$/i, '').trim();
  if (withoutTrailing && !variants.includes(withoutTrailing)) {
    variants.push(withoutTrailing);
  }

  return variants;
}

// Deduplicate identical road segments / close duplicates and rank by proximity to Bhimavaram
function deduplicateAndRank(
  items: SearchResult[],
  refLat = BHIMAVARAM_DEFAULT[0],
  refLon = BHIMAVARAM_DEFAULT[1]
): SearchResult[] {
  const sorted = [...items].sort((a, b) => {
    const distA = haversineDistanceKm(refLat, refLon, a.lat, a.lon);
    const distB = haversineDistanceKm(refLat, refLon, b.lat, b.lon);
    return distA - distB;
  });

  const filtered: SearchResult[] = [];
  for (const item of sorted) {
    const isDuplicate = filtered.some((existing) => {
      const sameName = existing.name.toLowerCase() === item.name.toLowerCase();
      const dist = haversineDistanceKm(existing.lat, existing.lon, item.lat, item.lon);

      // If same road name and within 8km, collapse duplicate road segments
      if (sameName && (dist < 8 || item.typeBadge.label === 'Road / Street')) {
        return true;
      }
      // If coordinates are nearly identical (within 150m)
      if (dist < 0.15) {
        return true;
      }
      return false;
    });

    if (!isDuplicate) {
      filtered.push(item);
    }
  }

  return filtered.slice(0, 5);
}

// Format reverse-geocoded address into clean municipal location string
function formatReverseNominatim(data: any): string {
  if (!data || !data.address) return data?.display_name || '';
  const a = data.address;

  // Prefer nearby landmark / building / amenity / road
  const landmark = a.building || a.amenity || a.shop || a.office || a.leisure || a.tourism;
  const road = a.road || a.pedestrian || a.path || a.street;
  const locality = a.suburb || a.neighbourhood || a.residential;
  const villageOrCity = a.village || a.town || a.city || 'Bhimavaram';
  const mandal = a.county;
  const district = a.state_district;
  const state = a.state || 'Andhra Pradesh';
  const pin = a.postcode;

  const parts: string[] = [];
  if (landmark) parts.push(landmark);
  if (road && !parts.includes(road)) parts.push(road);
  if (locality && !parts.includes(locality)) parts.push(locality);
  if (villageOrCity && !parts.includes(villageOrCity)) parts.push(villageOrCity);
  if (mandal && !parts.includes(mandal)) parts.push(mandal);
  if (district && !parts.includes(district)) parts.push(district);
  if (state && !parts.includes(state)) parts.push(state);
  if (pin && !parts.includes(pin)) parts.push(pin);

  return parts.length >= 2 ? parts.join(', ') : data.display_name || '';
}

interface NominatimQueueItem {
  url: string;
  options?: RequestInit;
  resolve: (res: Response) => void;
  reject: (err: any) => void;
  signal?: AbortSignal | null;
}

// Shared request queue enforcing OpenStreetMap Nominatim's usage policy (max 1 request per second)
// Across both reverse geocoding and location search
let lastNominatimRequestTime = 0;
let isProcessingQueue = false;
const nominatimQueue: NominatimQueueItem[] = [];

function createAbortError(): Error {
  const err = new Error('The user aborted a request.');
  err.name = 'AbortError';
  return err;
}

async function processNominatimQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (nominatimQueue.length > 0) {
      const item = nominatimQueue.shift()!;

      // Skip immediately if aborted while queued
      if (item.signal?.aborted) {
        continue;
      }

      // Ensure 1,050 ms interval between actual Nominatim requests
      const now = Date.now();
      const timeSinceLast = now - lastNominatimRequestTime;
      const waitTime = Math.max(0, 1050 - timeSinceLast);

      if (waitTime > 0) {
        let timerFired = false;
        await new Promise<void>((resolve) => {
          let timer: any = null;

          const onAbort = () => {
            if (!timerFired) {
              clearTimeout(timer);
              resolve();
            }
          };

          timer = setTimeout(() => {
            timerFired = true;
            if (item.signal) {
              item.signal.removeEventListener('abort', onAbort);
            }
            resolve();
          }, waitTime);

          if (item.signal) {
            item.signal.addEventListener('abort', onAbort, { once: true });
          }
        });

        // If cancelled during the throttle delay, skip fetch without advancing lastNominatimRequestTime
        if (item.signal?.aborted) {
          continue;
        }
      }

      // Dispatch the actual Nominatim request
      try {
        lastNominatimRequestTime = Date.now();
        const res = await fetch(item.url, item.options);
        item.resolve(res);
      } catch (fetchErr) {
        item.reject(fetchErr);
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

function nominatimThrottledFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const signal = options?.signal;

  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<Response>((resolve, reject) => {
    const item: NominatimQueueItem = {
      url,
      options,
      resolve,
      reject,
      signal
    };

    const onAbort = () => {
      // Remove from queue if not yet processed
      const idx = nominatimQueue.indexOf(item);
      if (idx !== -1) {
        nominatimQueue.splice(idx, 1);
      }
      // Immediately reject caller so cancelled operations never hang
      reject(createAbortError());
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    nominatimQueue.push(item);
    processNominatimQueue();
  });
}

// Robust multi-tier reverse geocoding with fine-grained local landmarks
async function reverseGeocodeCoords(
  lat: number,
  lon: number,
  signal: AbortSignal
): Promise<string> {
  // Strategy 1: OpenStreetMap Nominatim reverse (fine-grained building, road, village, mandal)
  try {
    const nomUrl = new URL('https://nominatim.openstreetmap.org/reverse');
    nomUrl.searchParams.set('format', 'jsonv2');
    nomUrl.searchParams.set('lat', String(lat));
    nomUrl.searchParams.set('lon', String(lon));
    nomUrl.searchParams.set('addressdetails', '1');
    nomUrl.searchParams.set('zoom', '18');

    const nomRes = await nominatimThrottledFetch(nomUrl.toString(), {
      signal,
      headers: { 'Accept-Language': 'en' }
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      const formatted = formatReverseNominatim(nomData);
      if (formatted) return formatted;
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // Strategy 2: Komoot Photon Reverse Geocode (free, OSM-based)
  try {
    const photonUrl = new URL('https://photon.komoot.io/reverse');
    photonUrl.searchParams.set('lat', String(lat));
    photonUrl.searchParams.set('lon', String(lon));

    const pRes = await fetch(photonUrl.toString(), { signal });
    if (pRes.ok && (pRes.headers.get('content-type') || '').includes('json')) {
      const pData = await pRes.json();
      if (pData && pData.features && pData.features.length > 0) {
        const prop = pData.features[0].properties || {};
        const parts = [
          prop.name,
          prop.street,
          prop.suburb || prop.district,
          prop.city || prop.town || 'Bhimavaram',
          prop.state || 'Andhra Pradesh',
          prop.postcode
        ].filter(Boolean);
        const unique = Array.from(new Set(parts));
        if (unique.length >= 2) return unique.join(', ');
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // Strategy 3: BigDataCloud client reverse geocoding (client-side fallback)
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
  onSelect
}: {
  onSelect: (lat: number, lon: number, address?: string) => void;
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

  const handleSelect = (place: SearchResult) => {
    map.flyTo([place.lat, place.lon], 16, { duration: 0.8 });
    onSelect(place.lat, place.lon, place.address);
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

  const handleSearch = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setSearching(true);
    setError('');
    setResults([]);
    setIsOpen(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    try {
      const variants = generateQueryVariants(cleanQuery);
      let foundPlaces: SearchResult[] = [];

      // 1. Try progressive query variants against OpenStreetMap Nominatim
      for (const variant of variants) {
        if (controller.signal.aborted) break;
        try {
          const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
          nominatimUrl.searchParams.set('format', 'jsonv2');
          nominatimUrl.searchParams.set('q', variant);
          nominatimUrl.searchParams.set('countrycodes', 'in');
          nominatimUrl.searchParams.set('limit', '8');
          nominatimUrl.searchParams.set('addressdetails', '1');
          nominatimUrl.searchParams.set('viewbox', '81.2,16.8,81.8,16.3');
          nominatimUrl.searchParams.set('bounded', '0');

          const nomRes = await nominatimThrottledFetch(nominatimUrl.toString(), {
            signal: controller.signal,
            headers: { 'Accept-Language': 'en' }
          });
          if (nomRes.ok && (nomRes.headers.get('content-type') || '').includes('json')) {
            const nomData = await nomRes.json();
            if (Array.isArray(nomData) && nomData.length > 0) {
              const mapped = nomData.map(formatNominatimSearchResult);
              foundPlaces = deduplicateAndRank(mapped);
              if (foundPlaces.length > 0) {
                break;
              }
            }
          }
        } catch (nomErr: any) {
          if (nomErr.name === 'AbortError') throw nomErr;
        }
      }

      // 2. Fallback to Komoot Photon if Nominatim returned 0 results
      if (foundPlaces.length === 0 && !controller.signal.aborted) {
        for (const variant of variants) {
          if (controller.signal.aborted) break;
          try {
            const photonUrl = new URL('https://photon.komoot.io/api/');
            photonUrl.searchParams.set('q', variant);
            photonUrl.searchParams.set('limit', '8');
            photonUrl.searchParams.set('lat', String(BHIMAVARAM_DEFAULT[0]));
            photonUrl.searchParams.set('lon', String(BHIMAVARAM_DEFAULT[1]));

            const pRes = await fetch(photonUrl.toString(), { signal: controller.signal });
            if (pRes.ok && (pRes.headers.get('content-type') || '').includes('json')) {
              const pData = await pRes.json();
              const features = (pData.features || []).filter(
                (f: any) => !f.properties?.countrycode || f.properties.countrycode.toUpperCase() === 'IN'
              );
              if (features.length > 0) {
                const mapped = features.map((f: any) => formatPhotonSearchResult(f, variant));
                foundPlaces = deduplicateAndRank(mapped);
                if (foundPlaces.length > 0) {
                  break;
                }
              }
            }
          } catch (pErr: any) {
            if (pErr.name === 'AbortError') throw pErr;
          }
        }
      }

      // Result handling:
      if (foundPlaces.length === 1) {
        handleSelect(foundPlaces[0]);
        clearTimeout(timeoutId);
        return;
      }

      if (foundPlaces.length > 1) {
        setResults(foundPlaces);
        setIsOpen(true);
        clearTimeout(timeoutId);
        return;
      }

      // 0 results found
      setError(`No locations found for "${cleanQuery}". Please check the spelling or try another landmark.`);
      setResults([]);
      setIsOpen(true);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Geocoding search error:', err);
      }
      setError(`Search lookup for "${cleanQuery}" was unavailable. You can click anywhere on the map directly.`);
      setResults([]);
      setIsOpen(true);
    } finally {
      clearTimeout(timeoutId);
      setSearching(false);
    }
  };

  return (
    <div
      ref={searchBoxRef}
      className="absolute top-3 left-3 z-[500] w-[min(360px,calc(100%-88px))] pointer-events-auto"
    >
      <div
        className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-1.5 transition-all focus-within:ring-2 focus-within:ring-civic-500 focus-within:border-civic-500"
      >
        <Search className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) {
              setIsOpen(false);
              setResults([]);
              setError('');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleSearch();
            }
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
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSearch();
          }}
          disabled={searching || !query.trim()}
          className="bg-civic-600 hover:bg-civic-700 disabled:opacity-50 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 flex items-center gap-1"
          title="Find location"
        >
          {searching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            'Find'
          )}
        </button>
      </div>

      {/* Results Dropdown */}
      {isOpen && (results.length > 0 || error) && (
        <div className="mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
          {results.map((place, index) => (
            <button
              key={`${place.lat}-${place.lon}-${index}`}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full text-left px-3.5 py-2.5 hover:bg-civic-50/70 border-b last:border-0 border-slate-100 flex items-start gap-2.5 transition-colors group"
            >
              <MapPin className="w-3.5 h-3.5 text-civic-600 shrink-0 mt-1 group-hover:scale-110 transition-transform" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-800">
                    {place.name}
                  </span>
                  <span
                    className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${place.typeBadge.color}`}
                  >
                    {place.typeBadge.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {place.subtitle || place.address}
                </p>
              </div>
            </button>
          ))}

          {error && (
            <div className="p-3 text-[11px] text-amber-700 bg-amber-50/60 text-center font-medium">
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
          onSelect={(lat, lon, addr) => {
            prevGeocodedCoordsRef.current = [lat, lon];
            onChange(lat, lon);
            if (onAddressChangeRef.current && addr) {
              onAddressChangeRef.current(addr, Date.now(), true);
            }
          }}
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

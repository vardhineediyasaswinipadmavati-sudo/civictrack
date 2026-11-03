import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Plus, Minus, RotateCcw, Crosshair } from 'lucide-react';

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
  height?: string;
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

  // Click map to reposition
  useMapEvents({
    click(e) {
      onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    }
  });

  // Drag marker to fine-tune position
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

// Map picker internal controls controller
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
    <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200">
      <button
        type="button"
        onClick={handleZoomIn}
        title="Zoom In"
        aria-label="Zoom In"
        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-civic-700 hover:bg-slate-100 rounded-lg transition-colors active:scale-95 font-bold"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={handleZoomOut}
        title="Zoom Out"
        aria-label="Zoom Out"
        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-civic-700 hover:bg-slate-100 rounded-lg transition-colors active:scale-95 font-bold"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <div className="h-px bg-slate-200 my-0.5" />
      <button
        type="button"
        onClick={handleRecenter}
        title="Recenter to Bhimavaram"
        aria-label="Recenter to Bhimavaram"
        className="w-7 h-7 flex items-center justify-center text-slate-700 hover:text-civic-700 hover:bg-slate-100 rounded-lg transition-colors active:scale-95"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={handleLocateMe}
        title="Pin My Current Location"
        aria-label="Pin My Current Location"
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors active:scale-95 ${
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
  height = '300px'
}) => {
  const position: [number, number] = [
    typeof latitude === 'number' && !isNaN(latitude) && latitude !== 0 ? latitude : BHIMAVARAM_DEFAULT[0],
    typeof longitude === 'number' && !isNaN(longitude) && longitude !== 0 ? longitude : BHIMAVARAM_DEFAULT[1]
  ];

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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableLocationMarker position={position} onChange={onChange} />
        <PickerControlsController position={position} onChange={onChange} />
      </MapContainer>

      {/* Instructional helper badge at bottom */}
      <div className="absolute bottom-2.5 left-2.5 z-[400] bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-[11px] font-medium text-slate-700 flex items-center gap-1.5 pointer-events-none">
        <MapPin className="w-3.5 h-3.5 text-civic-600 shrink-0" />
        <span>Click or drag pin to position ({position[0].toFixed(4)}, {position[1].toFixed(4)})</span>
      </div>
    </div>
  );
};

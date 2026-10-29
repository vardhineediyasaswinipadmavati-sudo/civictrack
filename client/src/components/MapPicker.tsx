import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

// Custom modern SVG marker icon to prevent broken standard Leaflet png paths
const pinIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div style="background-color: #0c87eb; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid white;">
    <div style="width: 10px; height: 10px; background-color: white; border-radius: 50%; transform: rotate(45deg);"></div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

interface Props {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lon: number) => void;
  height?: string;
}

function LocationMarker({ position, onChange }: { position: [number, number]; onChange: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });

  return <Marker position={position} icon={pinIcon} />;
}

export const MapPicker: React.FC<Props> = ({
  latitude,
  longitude,
  onChange,
  height = '300px'
}) => {
  const mapCenter: [number, number] = [
    latitude || 16.5449,
    longitude || 81.5212
  ];

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner relative" style={{ height }}>
      <MapContainer
        center={mapCenter}
        zoom={14}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={mapCenter} onChange={onChange} />
      </MapContainer>
      <div className="absolute bottom-2 left-2 z-[400] bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-[11px] font-medium text-slate-700 flex items-center gap-1.5 pointer-events-none">
        <MapPin className="w-3.5 h-3.5 text-civic-600" />
        <span>Click anywhere on the map to pin issue location ({latitude.toFixed(4)}, {longitude.toFixed(4)})</span>
      </div>
    </div>
  );
};

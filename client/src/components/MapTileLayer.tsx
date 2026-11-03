import React from 'react';
import { TileLayer } from 'react-leaflet';
import { MAP_TILE_CONFIG } from '../config/mapConfig';

interface MapTileLayerProps {
  maxZoom?: number;
  minZoom?: number;
  opacity?: number;
}

/**
 * Reusable TileLayer component connecting both CivicTrack maps to
 * verified Esri World Street Map tiles.
 */
export const MapTileLayer: React.FC<MapTileLayerProps> = ({
  maxZoom = MAP_TILE_CONFIG.maxZoom,
  minZoom = MAP_TILE_CONFIG.minZoom,
  opacity = 1
}) => {
  return (
    <TileLayer
      url={MAP_TILE_CONFIG.url}
      attribution={MAP_TILE_CONFIG.attribution}
      maxZoom={maxZoom}
      minZoom={minZoom}
      opacity={opacity}
    />
  );
};

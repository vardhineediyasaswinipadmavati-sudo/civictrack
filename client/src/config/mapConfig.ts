/**
 * Shared production basemap configuration for Leaflet maps in CivicTrack.
 *
 * Provider: Esri World Street Map
 * Endpoint: https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}
 *
 * - No API key required
 * - No paid subscription required
 * - Global CDN edge caching with 24h client cache
 * - Full CORS support (Access-Control-Allow-Origin: *)
 * - High resolution street-level coverage for Andhra Pradesh / Bhimavaram
 * - Compatible with cloud deployment on Render (no 403 access blocked errors)
 */
export const MAP_TILE_CONFIG = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012',
  maxZoom: 19,
  minZoom: 1,
} as const;

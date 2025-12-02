// Mapbox token - loaded from environment variable
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

if (!MAPBOX_TOKEN) {
  console.warn('Warning: NEXT_PUBLIC_MAPBOX_TOKEN is not set');
}

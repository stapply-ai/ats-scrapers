export const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || '';

if (!MAPBOX_TOKEN) {
  console.warn('No Mapbox token found. Please set MAPBOX_TOKEN in your .env file');
}

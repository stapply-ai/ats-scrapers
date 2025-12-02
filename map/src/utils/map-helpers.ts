import { MAPBOX_TOKEN } from '@/lib/config';

/**
 * Generate a static map image URL using Mapbox Static Images API
 * https://docs.mapbox.com/api/maps/static-images/
 *
 * @param lng - Longitude
 * @param lat - Latitude
 * @param zoom - Zoom level (default: 12)
 * @param width - Image width in pixels (default: 600)
 * @param height - Image height in pixels (default: 400)
 * @param retina - Use @2x for retina displays (default: true)
 * @returns Static map image URL
 */
export function generateStaticMapUrl(
  lng: number,
  lat: number,
  zoom: number = 12,
  width: number = 600,
  height: number = 400,
  retina: boolean = true
): string {
  const retinaStr = retina ? '@2x' : '';
  const markerColor = '3b82f6'; // blue-500

  // Pin overlay format: pin-{size}+{color}({lng},{lat})
  const overlay = `pin-s+${markerColor}(${lng},${lat})`;

  // Static Images API format:
  // /styles/v1/{username}/{style_id}/static/{overlay}/{lng},{lat},{zoom}/{width}x{height}{@2x}
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlay}/${lng},${lat},${zoom}/${width}x${height}${retinaStr}?access_token=${MAPBOX_TOKEN}`;
}

/**
 * Generate a static map with multiple markers (heatmap-like visualization)
 * Shows all job locations as markers to create a density visualization
 * 
 * @param jobs - Array of jobs with lat/lng coordinates
 * @param width - Image width in pixels (default: 900)
 * @param height - Image height in pixels (default: 360)
 * @returns Static map image URL with all job locations as markers
 */
export function generateStaticHeatmapUrl(
  jobs: Array<{ lat: number; lng: number }>,
  width: number = 900,
  height: number = 360
): string {
  if (jobs.length === 0) {
    // Fallback to center of world if no jobs
    return generateStaticMapUrl(0, 0, 1, width, height);
  }

  // Trim outliers for a tighter viewport (use 5th-95th percentile window when we have enough points)
  const percentile = (values: number[], p: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
  };

  const latsRaw = jobs.map(job => job.lat);
  const lngsRaw = jobs.map(job => job.lng);

  const latP5 = percentile(latsRaw, 5);
  const latP95 = percentile(latsRaw, 95);
  const lngP5 = percentile(lngsRaw, 5);
  const lngP95 = percentile(lngsRaw, 95);

  let viewportJobs = jobs;
  if (jobs.length > 6) {
    viewportJobs = jobs.filter(job =>
      job.lat >= latP5 && job.lat <= latP95 && job.lng >= lngP5 && job.lng <= lngP95
    );
    if (viewportJobs.length === 0) {
      viewportJobs = jobs;
    }
  }

  const lats = viewportJobs.map(job => job.lat);
  const lngs = viewportJobs.map(job => job.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Compute geographic centroid on a sphere to handle wrap-around and clusters
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const toDegrees = (rad: number) => (rad * 180) / Math.PI;

  let x = 0;
  let y = 0;
  let z = 0;

  for (const job of viewportJobs) {
    const latRad = toRadians(job.lat);
    const lngRad = toRadians(job.lng);
    x += Math.cos(latRad) * Math.cos(lngRad);
    y += Math.cos(latRad) * Math.sin(lngRad);
    z += Math.sin(latRad);
  }

  const total = viewportJobs.length;
  x /= total;
  y /= total;
  z /= total;

  const hyp = Math.sqrt(x * x + y * y);
  // Force map to center near Greenwich for a consistent anchor
  const centerLat = 51.4779; // Greenwich Observatory latitude
  const centerLng = 0; // Prime meridian

  // Calculate appropriate zoom level based on bounding box and image size
  const latDiff = Math.max(0.000001, maxLat - minLat);
  // Handle wrap-around: choose the tightest longitudinal span (important when points are near the dateline)
  const lngs360 = lngs.map(l => ((l % 360) + 360) % 360).sort((a, b) => a - b);
  let bestSpan = 360;
  if (lngs360.length > 0) {
    for (let i = 0; i < lngs360.length; i++) {
      const j = (i + 1) % lngs360.length;
      const gap = (lngs360[j] ?? (lngs360[0] + 360)) - lngs360[i];
      const span = 360 - gap; // span that excludes the largest gap
      if (span < bestSpan) bestSpan = span;
    }
  }
  const lngDiff = Math.max(0.000001, Math.min(maxLng - minLng, bestSpan));
  const padding = 1.2; // add breathing room so pins are not on the edge
  const worldDimension = { height: height * padding, width: width * padding };
  const tileSize = 512; // Mapbox static uses 512px tiles

  const zoomLat = Math.log2((170.1022 * worldDimension.height) / (tileSize * latDiff));
  const zoomLng = Math.log2((360 * worldDimension.width) / (tileSize * lngDiff));
  // Bias toward a closer view
  const zoom = Math.max(3, Math.min(16, Math.min(zoomLat, zoomLng) + 1));

  // Create markers for all jobs
  // Mapbox Static API supports up to ~100 markers in URL, but we'll use smaller markers for better density visualization
  const markerColor = '3b82f6'; // blue-500
  const markerSize = 's'; // small markers for better density visualization

  // Limit to 100 markers to avoid URL length issues
  const jobsToShow = jobs.slice(0, 100);
  const markers = jobsToShow.map(job =>
    `pin-${markerSize}+${markerColor}(${job.lng},${job.lat})`
  ).join(',');

  const retinaStr = '@2x';
  const overlay = markers || `pin-${markerSize}+${markerColor}(${centerLng},${centerLat})`;

  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlay}/${centerLng},${centerLat},${1}/${width}x${height}${retinaStr}?access_token=${MAPBOX_TOKEN}`;
}

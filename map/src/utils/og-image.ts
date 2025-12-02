import { MAPBOX_TOKEN } from '@/lib/config';

/**
 * Generate an Open Graph image URL for a job using Mapbox Static Images API with overlays
 * This creates a map tile with the job location marked
 *
 * For text overlays, we'll use a Next.js API route that generates the image
 * with ImageResponse (Vercel OG)
 */
export function generateJobOGImageUrl(
  companySlug: string,
  valueSlug: string,
  jobTitle: string,
  companyName: string,
  location: string
): string {
  // Encode parameters for URL
  const params = new URLSearchParams({
    company: companySlug,
    value: valueSlug,
    title: jobTitle,
    companyName: companyName,
    location: location,
  });

  return `/api/og/job?${params.toString()}`;
}

/**
 * Generate a static map background for OG images
 * This is used as the base layer in the OG image generation
 */
export function generateOGMapBackground(
  lng: number,
  lat: number,
  zoom: number = 11,
  width: number = 1200,
  height: number = 630
): string {
  const markerColor = '3b82f6'; // blue-500

  // Pin overlay format: pin-s+{color}({lng},{lat})
  const overlay = `pin-l+${markerColor}(${lng},${lat})`;

  // Static Images API format for OG images (1200x630 is standard OG size)
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlay}/${lng},${lat},${zoom}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
}

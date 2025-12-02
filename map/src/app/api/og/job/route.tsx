import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { Buffer } from 'buffer';
import { loadJobsWithCoordinatesServer } from '@/utils/data-processor-server';
import { generateHash, slugify } from '@/lib/slug-utils';
import { generateOGMapBackground } from '@/utils/og-image';
import { formatSalary } from '@/utils/salary-format';

// Use Node.js runtime for better image processing support in production
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companySlug = searchParams.get('company');
    const valueSlug = searchParams.get('value');

    if (!companySlug || !valueSlug) {
      return new Response('Missing parameters', { status: 400 });
    }

    // Load jobs and find the matching one
    const allJobs = await loadJobsWithCoordinatesServer('/ai.csv');

    // Extract hash from value slug
    const hashParts = valueSlug.split('-');
    const hash = hashParts.length > 0 ? hashParts[hashParts.length - 1] : null;

    if (!hash) {
      return new Response('Invalid job slug', { status: 400 });
    }

    // Find job matching company slug and hash
    const job = allJobs.find(j =>
      slugify(j.company) === companySlug && generateHash(j.id) === hash
    );

    if (!job) {
      return new Response('Job not found', { status: 404 });
    }

    // Generate map background URL
    const mapUrl = generateOGMapBackground(job.lng, job.lat, 4, 1200, 630);

    // Fetch the map image and convert to data URL for ImageResponse compatibility
    let mapImageDataUrl = mapUrl;
    try {
      const mapImageResponse = await fetch(mapUrl);
      if (mapImageResponse.ok) {
        const mapImageBuffer = await mapImageResponse.arrayBuffer();
        // Convert ArrayBuffer to base64 (Node.js runtime supports Buffer)
        const base64 = Buffer.from(mapImageBuffer).toString('base64');
        mapImageDataUrl = `data:image/png;base64,${base64}`;
      } else {
        console.warn(`Failed to fetch map image: ${mapImageResponse.status} ${mapImageResponse.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching map image:', error);
      // Fallback to URL if fetch fails - ImageResponse might handle it
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          {/* Map background */}
          <img
            src={mapImageDataUrl}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          {/* Gradient overlay for better text readability */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
            }}
          />

          {/* StapplyLogo in the top left */}
          <div
            style={{
              position: 'absolute',
              top: 48,
              left: 48,
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              zIndex: 2,
            }}
          >
            <svg
              width="38"
              height="38"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="3" y="6" width="14" height="16" rx="2" fill="#3b82f6" opacity="0.3" />
              <rect x="4" y="4" width="14" height="16" rx="2" fill="#3b82f6" opacity="0.8" />
              <rect x="5" y="2" width="14" height="16" rx="2" fill="#2563eb" opacity="0.9" />
              <rect x="7" y="4" width="10" height="3" rx="1" fill="white" />
              <line x1="7" y1="9" x2="17" y2="9" strokeWidth="0.5" stroke="white" opacity="0.6" />
              <line x1="7" y1="11" x2="15" y2="11" strokeWidth="0.5" stroke="white" opacity="0.6" />
              <line x1="7" y1="13" x2="16" y2="13" strokeWidth="0.5" stroke="white" opacity="0.6" />
            </svg>
          </div>

          {/* Content */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '60px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Company badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '9999px',
                  padding: '8px 20px',
                  fontSize: '20px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: '500',
                  display: 'flex',
                }}
              >
                {job.company.toUpperCase()}
              </div>
            </div>

            {/* Job title */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: 'white',
                lineHeight: 1.2,
                maxWidth: '90%',
                display: 'flex',
              }}
            >
              {job.title}
            </div>

            {/* Location */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '28px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{job.location}</span>
            </div>

            {/* Salary */}
            {formatSalary(job) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '28px',
                  color: 'rgba(34, 197, 94, 0.9)',
                  fontWeight: '600',
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>{formatSalary(job)}</span>
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}

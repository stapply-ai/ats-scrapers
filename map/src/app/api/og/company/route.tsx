import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { loadJobsWithCoordinatesEdge } from '../../../../utils/data-processor-edge';
import { slugify } from '../../../../lib/slug-utils';
import { generateStaticHeatmapUrl } from '../../../../utils/map-helpers';
import { StapplyLogo } from '@/components/logo';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const companySlug = searchParams.get('company');

        if (!companySlug) {
            return new Response('Missing company parameter', { status: 400 });
        }

        // Load jobs and find matching company jobs using edge-compatible loader
        const allJobs = await loadJobsWithCoordinatesEdge('/ai.csv');
        const matchingJobs = allJobs.filter(job => slugify(job.company) === companySlug);

        if (matchingJobs.length === 0) {
            return new Response('Company not found', { status: 404 });
        }

        const companyName = matchingJobs[0].company;
        const jobCount = matchingJobs.length;
        const locations = new Set(matchingJobs.map(job => job.location));
        const locationCount = locations.size;

        // Generate heatmap map background URL
        const mapUrl = generateStaticHeatmapUrl(
            matchingJobs.map(job => ({ lat: job.lat, lng: job.lng })),
            1200,
            630
        );

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
                        src={mapUrl}
                        alt="Map"
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
                        <StapplyLogo size={38} />
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
                            gap: '20px',
                        }}
                    >
                        {/* Company name */}
                        <div
                            style={{
                                fontSize: '64px',
                                fontWeight: 'bold',
                                color: 'white',
                                lineHeight: 1.2,
                                maxWidth: '90%',
                                display: 'flex',
                                letterSpacing: '-0.02em',
                            }}
                        >
                            {companyName.toUpperCase()}
                        </div>

                        {/* Stats badges */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                flexWrap: 'wrap',
                            }}
                        >
                            {/* Job count badge */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    background: 'rgba(59, 130, 246, 0.2)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    borderRadius: '9999px',
                                    padding: '10px 24px',
                                    fontSize: '24px',
                                    color: 'rgba(255, 255, 255, 0.95)',
                                    fontWeight: '600',
                                }}
                            >
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                </svg>
                                <span>{jobCount.toLocaleString()} {jobCount === 1 ? 'role' : 'roles'}</span>
                            </div>

                            {/* Location count badge */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '9999px',
                                    padding: '10px 24px',
                                    fontSize: '24px',
                                    color: 'rgba(255, 255, 255, 0.95)',
                                    fontWeight: '600',
                                }}
                            >
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span>{locationCount} {locationCount === 1 ? 'location' : 'locations'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            }
        );
    } catch (error) {
        console.error('Error generating company OG image:', error);
        return new Response('Failed to generate image', { status: 500 });
    }
}


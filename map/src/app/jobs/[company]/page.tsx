import { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { loadJobsWithCoordinatesServer } from '@/utils/data-processor-server';
import { generateJobSlug, generateCompanySlug, slugify } from '@/lib/slug-utils';
import { generateStaticHeatmapUrl } from '@/utils/map-helpers';
import { generateBreadcrumbSchema } from '@/lib/structured-data';
import { CompanyJobList } from '@/components/company-job-list';
import { PageHeader } from '@/components/page-header';

type Params = { company: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { company } = await params;

    try {
        const jobs = await loadJobsWithCoordinatesServer('/ai.csv');
        const matchingJobs = jobs.filter(job => slugify(job.company) === company);

        if (matchingJobs.length === 0) {
            return {
                title: 'Company Jobs | Stapply',
                description: 'Explore AI jobs on Stapply.',
            };
        }

        const companyName = matchingJobs[0].company;
        const jobCount = matchingJobs.length;
        const locations = new Set(matchingJobs.map(job => job.location));
        const title = `${companyName} Jobs (${jobCount}) | Stapply`;
        const description = `View ${jobCount} open roles at ${companyName} across ${locations.size} locations on Stapply's interactive job map.`;
        const companySlug = generateCompanySlug(companyName);
        const pageUrl = `https://map.stapply.ai/jobs/${companySlug}`;

        // Generate OG image URL using the new route
        const ogImageUrl = `https://map.stapply.ai/api/og/company?company=${encodeURIComponent(companySlug)}`;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                url: pageUrl,
                type: 'website',
                images: [
                    {
                        url: ogImageUrl,
                        width: 1200,
                        height: 630,
                        alt: `${companyName} job locations map`,
                    },
                ],
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
                images: [ogImageUrl],
            },
            alternates: {
                canonical: pageUrl,
            },
        };
    } catch (error) {
        return {
            title: 'Company Jobs | Stapply',
            description: 'Explore AI jobs on Stapply.',
        };
    }
}

export default async function JobsPage({ params }: { params: Promise<Params> }) {
    const { company } = await params;

    try {
        const allJobs = await loadJobsWithCoordinatesServer('/ai.csv');
        const matchingJobs = allJobs.filter(job => slugify(job.company) === company);

        if (matchingJobs.length === 0) {
            return <CompanyNotFound />;
        }

        const companyName = matchingJobs[0].company;
        const companySlug = generateCompanySlug(companyName);
        const locations = Array.from(new Set(matchingJobs.map(job => job.location)));

        // Generate heatmap with all job locations
        const staticMapUrl = generateStaticHeatmapUrl(
            matchingJobs.map(job => ({ lat: job.lat, lng: job.lng })),
            900,
            360
        );

        // Generate breadcrumb structured data
        const pageUrl = `https://map.stapply.ai/jobs/${companySlug}`;
        const breadcrumbData = generateBreadcrumbSchema([
            { name: 'Home', url: 'https://map.stapply.ai' },
            { name: companyName, url: pageUrl },
        ]);

        return (
            <div className="h-screen overflow-y-auto bg-black text-white font-[system-ui,-apple-system,BlinkMacSystemFont,'Inter',sans-serif]">
                <Script
                    id="breadcrumb-schema"
                    type="application/ld+json"
                    strategy="beforeInteractive"
                >
                    {JSON.stringify(breadcrumbData)}
                </Script>
                <PageHeader />

                {/* Content */}
                <main className="max-w-4xl mx-auto px-5 pb-4 md:pb-6 space-y-6 pt-1">
                    <section className="space-y-2">
                        <h1 className="text-2xl md:text-3xl font-semibold tracking-[-0.04em]">{companyName.toUpperCase()}</h1>
                        <div className="flex flex-wrap items-center gap-3 text-[13px] text-white/60">
                            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                {matchingJobs.length.toLocaleString()} open role{matchingJobs.length === 1 ? '' : 's'}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                {locations.length} location{locations.length === 1 ? '' : 's'}
                            </span>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold tracking-[-0.02em] mb-1">Open roles</h2>
                            <p className="text-white/60 text-[14px] m-0">{matchingJobs.length.toLocaleString()} opportunities</p>
                        </div>

                        <CompanyJobList jobs={matchingJobs} />
                    </section>
                </main>
            </div>
        );
    } catch (error) {
        return <CompanyNotFound />;
    }
}

function CompanyNotFound() {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-[system-ui,-apple-system,BlinkMacSystemFont,'Inter',sans-serif]">
            <div className="text-center max-w-md">
                <h1 className="text-2xl font-bold mb-4 tracking-[-0.02em]">Company Not Found</h1>
                <p className="text-white/60 mb-6 text-[13px]">We could not find any roles for this company.</p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-[13px] font-medium no-underline"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to Map
                </Link>
            </div>
        </div>
    );
}

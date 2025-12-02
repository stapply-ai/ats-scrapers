import { Metadata } from 'next';
import Link from 'next/link';
import { loadJobsWithCoordinatesServer } from '@/utils/data-processor-server';
import { generateCompanySlug } from '@/lib/slug-utils';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'AI Jobs Directory | Stapply',
  description: 'Browse all AI companies and job openings on Stapply.',
};

export default async function JobsDirectoryPage() {
  try {
    const jobs = await loadJobsWithCoordinatesServer('/ai.csv');

    // Group jobs by company
    const companyMap = new Map<string, number>();
    jobs.forEach(job => {
      const count = companyMap.get(job.company) || 0;
      companyMap.set(job.company, count + 1);
    });

    // Sort companies alphabetically
    const sortedCompanies = Array.from(companyMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    return (
      <div className="h-screen overflow-y-auto bg-black text-white font-[system-ui,-apple-system,BlinkMacSystemFont,'Inter',sans-serif]">
        <PageHeader />

        <main className="max-w-4xl mx-auto px-5 pb-6 md:pb-8 space-y-10 pt-1">
          <section className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-[-0.04em]">AI JOBS DIRECTORY</h1>
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-white/60">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                {jobs.length.toLocaleString()} open roles
              </span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                {sortedCompanies.length} companies
              </span>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] mb-1">Companies</h2>
              <p className="text-white/60 text-[14px] m-0">Browse jobs by company</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedCompanies.map(([company, count]) => (
                <Link
                  key={company}
                  href={`/jobs/${generateCompanySlug(company)}`}
                  className="block p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all group no-underline"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[14px] text-white truncate pr-4 uppercase">{company}</span>
                    <span className="text-[12px] text-white/40 group-hover:text-white/60 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                      {count}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  } catch (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-[system-ui,-apple-system,BlinkMacSystemFont,'Inter',sans-serif]">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 tracking-[-0.02em]">Error Loading Directory</h1>
          <p className="text-white/60 mb-6 text-[13px]">We could not load the jobs directory at this time.</p>
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
}

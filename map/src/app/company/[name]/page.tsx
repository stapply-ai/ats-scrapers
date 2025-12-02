import { redirect } from 'next/navigation';
import { loadJobsWithCoordinatesServer } from '@/utils/data-processor-server';
import { slugify, generateCompanySlug } from '@/lib/slug-utils';

export default async function CompanyPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  let allJobs;
  try {
    allJobs = await loadJobsWithCoordinatesServer('/ai.csv');
  } catch (error) {
    console.error(`Error loading jobs for company: ${name}`, error);
    redirect('/');
  }

  // Find jobs matching the company slug
  const matchingJobs = allJobs.filter(job =>
    slugify(job.company) === generateCompanySlug(name)
  );

  if (matchingJobs.length === 0) {
    console.error(`No jobs found for company: ${name}`);
    redirect('/');
  }

  const newPath = `/jobs/${generateCompanySlug(name)}`;
  redirect(newPath);
}

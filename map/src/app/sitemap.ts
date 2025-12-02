import { MetadataRoute } from 'next';
import { loadJobsWithCoordinatesServer } from '@/utils/data-processor-server';
import { generateJobSlug, generateCompanySlug, slugify } from '@/lib/slug-utils';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://map.stapply.ai';

  // Base pages
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];

  try {
    // Load all jobs
    const jobs = await loadJobsWithCoordinatesServer('/ai.csv');

    // Add job pages to sitemap
    const jobPages: MetadataRoute.Sitemap = jobs.map((job) => {
      const slug = generateJobSlug(job.title, job.id, job.company);
      return {
        url: `${baseUrl}/jobs/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      };
    });

    // Get unique companies and add company pages to sitemap
    const companyMap = new Map<string, string>();
    jobs.forEach((job) => {
      const companySlug = generateCompanySlug(job.company);
      if (!companyMap.has(companySlug)) {
        companyMap.set(companySlug, job.company);
      }
    });

    const companyPages: MetadataRoute.Sitemap = Array.from(companyMap.keys()).map((companySlug) => ({
      url: `${baseUrl}/jobs/${companySlug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

    return [...routes, ...companyPages, ...jobPages];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return base routes if job loading fails
    return routes;
  }
}

import type { JobMarker } from '@/types';
import { formatSalary } from '@/utils/salary-format';

/**
 * Generate JobPosting structured data (JSON-LD) for SEO
 * https://schema.org/JobPosting
 */
export function generateJobPostingSchema(job: JobMarker, jobUrl: string) {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: `${job.title} position at ${job.company} in ${job.location}. Apply now to join our team. Visit Stapply to discover more AI and tech job opportunities.`,
    datePosted: new Date().toISOString().split('T')[0], // Today's date as fallback
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: job.lat,
        longitude: job.lng,
      },
    },
    applicantLocationRequirements: {
      '@type': 'Country',
      name: getCountryFromLocation(job.location),
    },
    jobLocationType: determineJobLocationType(job.location),
    employmentType: 'FULL_TIME', // Default assumption
    directApply: true,
    applicationContact: {
      '@type': 'ContactPoint',
      url: job.url,
    },
  };

  // Add salary information if available
  const salaryFormatted = formatSalary(job);
  if (salaryFormatted) {
    schema.description = `${job.title} position at ${job.company} in ${job.location}. ${salaryFormatted}. Apply now to join our team. Visit Stapply to discover more AI and tech job opportunities.`;
  }

  // Add baseSalary if we have salary data
  if (job.salary_min || job.salary_max) {
    const baseSalary: any = {
      '@type': 'MonetaryAmount',
    };

    if (job.salary_currency) {
      baseSalary.currency = job.salary_currency;
    } else {
      baseSalary.currency = 'USD'; // Default
    }

    if (job.salary_min && job.salary_max) {
      baseSalary.value = {
        '@type': 'QuantitativeValue',
        minValue: parseFloat(job.salary_min),
        maxValue: parseFloat(job.salary_max),
        unitText: job.salary_period || 'YEAR',
      };
    } else if (job.salary_min) {
      baseSalary.value = {
        '@type': 'QuantitativeValue',
        value: parseFloat(job.salary_min),
        unitText: job.salary_period || 'YEAR',
      };
    } else if (job.salary_max) {
      baseSalary.value = {
        '@type': 'QuantitativeValue',
        value: parseFloat(job.salary_max),
        unitText: job.salary_period || 'YEAR',
      };
    }

    schema.baseSalary = baseSalary;
  }

  return schema;
}

/**
 * Extract country from location string
 */
function getCountryFromLocation(location: string): string {
  // Common patterns: "City, Country" or "City, State, Country" or "Remote" or "Country"
  const parts = location.split(',').map(p => p.trim());

  // If "Remote" or similar
  if (location.toLowerCase().includes('remote')) {
    return 'Worldwide';
  }

  // Take the last part as country
  if (parts.length > 0) {
    return parts[parts.length - 1];
  }

  return location;
}

/**
 * Determine job location type based on location string
 */
function determineJobLocationType(location: string): string {
  const locationLower = location.toLowerCase();

  if (locationLower.includes('remote')) {
    return 'TELECOMMUTE';
  }

  return 'ONSITE'; // Default
}

/**
 * Generate BreadcrumbList structured data (JSON-LD) for SEO
 * https://schema.org/BreadcrumbList
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

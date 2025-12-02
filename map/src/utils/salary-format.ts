import type { JobMarker } from '@/types';

/**
 * Format salary information for display
 */
export function formatSalary(job: JobMarker): string | null {
  // If there's a summary, use it
  if (job.salary_summary) {
    return job.salary_summary;
  }

  // Try to format from min/max
  const min = job.salary_min ? parseFloat(job.salary_min) : null;
  const max = job.salary_max ? parseFloat(job.salary_max) : null;
  const currency = job.salary_currency || 'USD';
  const period = job.salary_period || 'YEAR';

  if (min === null && max === null) {
    return null;
  }

  // Format currency symbol
  const currencySymbol = getCurrencySymbol(currency);

  // Format numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}k`;
    }
    return num.toLocaleString();
  };

  // Format period
  const periodText = formatPeriod(period);

  if (min !== null && max !== null) {
    if (min === max) {
      return `${currencySymbol}${formatNumber(min)}${periodText}`;
    }
    return `${currencySymbol}${formatNumber(min)} - ${currencySymbol}${formatNumber(max)}${periodText}`;
  } else if (min !== null) {
    return `${currencySymbol}${formatNumber(min)}+${periodText}`;
  } else if (max !== null) {
    return `Up to ${currencySymbol}${formatNumber(max)}${periodText}`;
  }

  return null;
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF ',
    CNY: '¥',
    INR: '₹',
  };
  return symbols[currency.toUpperCase()] || `${currency} `;
}

function formatPeriod(period: string): string {
  const periodMap: Record<string, string> = {
    YEAR: '/year',
    MONTH: '/month',
    HOUR: '/hour',
    WEEK: '/week',
    DAY: '/day',
  };
  return periodMap[period.toUpperCase()] || '';
}



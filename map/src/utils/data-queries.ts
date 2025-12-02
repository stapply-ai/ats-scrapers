import type { JobMarker } from '@/types';
import { fuzzyMatch } from './fuzzy-match';

export interface LocationStats {
    location: string;
    count: number;
    companies: string[];
}

export interface CompanyStats {
    company: string;
    count: number;
    locations: string[];
}

/**
 * Get statistics for all locations in the job data
 */
export function getLocationStats(jobs: JobMarker[]): LocationStats[] {
    const locationMap = new Map<string, { count: number; companies: Set<string> }>();

    jobs.forEach(job => {
        const loc = job.location.trim();
        if (!locationMap.has(loc)) {
            locationMap.set(loc, { count: 0, companies: new Set() });
        }
        const stats = locationMap.get(loc)!;
        stats.count++;
        stats.companies.add(job.company);
    });

    return Array.from(locationMap.entries())
        .map(([location, data]) => ({
            location,
            count: data.count,
            companies: Array.from(data.companies),
        }))
        .sort((a, b) => b.count - a.count);
}

/**
 * Get statistics for all companies in the job data
 */
export function getCompanyStats(jobs: JobMarker[]): CompanyStats[] {
    const companyMap = new Map<string, { count: number; locations: Set<string> }>();

    jobs.forEach(job => {
        const company = job.company.trim();
        if (!companyMap.has(company)) {
            companyMap.set(company, { count: 0, locations: new Set() });
        }
        const stats = companyMap.get(company)!;
        stats.count++;
        stats.locations.add(job.location.trim());
    });

    return Array.from(companyMap.entries())
        .map(([company, data]) => ({
            company,
            count: data.count,
            locations: Array.from(data.locations),
        }))
        .sort((a, b) => b.count - a.count);
}


/**
 * Filter jobs by location (fuzzy matching)
 */
export function filterJobsByLocation(jobs: JobMarker[], locationQuery: string): JobMarker[] {
    const query = locationQuery.toLowerCase().trim();

    return jobs.filter(job => {
        const location = job.location.toLowerCase();
        // Try exact match first
        if (location.includes(query) || location.split(',').some(part => part.trim() === query)) {
            return true;
        }
        // Try fuzzy match
        return fuzzyMatch(location, query, 0.6);
    });
}

/**
 * Filter jobs by company (fuzzy matching)
 */
export function filterJobsByCompany(jobs: JobMarker[], companyQuery: string): JobMarker[] {
    const query = companyQuery.toLowerCase().trim();

    return jobs.filter(job => {
        const company = job.company.toLowerCase();
        // Try exact match first
        if (company.includes(query)) {
            return true;
        }
        // Try fuzzy match
        return fuzzyMatch(company, query, 0.6);
    });
}

/**
 * Parse boolean query with OR/AND operators and comma separators
 * Examples:
 *   "software engineer OR internship" -> OR logic
 *   "software engineer AND python" -> AND logic
 *   "software engineer, intern, applied ai" -> OR logic (comma-separated)
 *   "software engineer" -> AND logic (default)
 */
function parseBooleanQuery(query: string): { type: 'OR' | 'AND'; terms: string[] } {
    const normalized = query.toLowerCase().trim();

    // Check for OR operator (case-insensitive)
    if (/\s+or\s+/i.test(normalized)) {
        const terms = normalized.split(/\s+or\s+/i).map(t => t.trim()).filter(t => t.length > 0);
        return { type: 'OR', terms };
    }

    // Check for AND operator (case-insensitive)
    if (/\s+and\s+/i.test(normalized)) {
        const terms = normalized.split(/\s+and\s+/i).map(t => t.trim()).filter(t => t.length > 0);
        return { type: 'AND', terms };
    }

    // Check for comma separators (treat as OR logic)
    if (/,/.test(normalized)) {
        const terms = normalized.split(',').map(t => t.trim()).filter(t => t.length > 0);
        // Only use OR logic if we have multiple terms after splitting
        if (terms.length > 1) {
            return { type: 'OR', terms };
        }
    }

    // Default: split by spaces and use AND logic
    const terms = normalized.split(/\s+/).filter(t => t.length > 0);
    return { type: 'AND', terms };
}

/**
 * Check if a job title matches a single search term (with fuzzy matching)
 */
function matchesTerm(title: string, term: string): boolean {
    const normalizedTitle = title.toLowerCase();
    const normalizedTerm = term.toLowerCase().trim();

    // Try exact substring match first (faster)
    if (normalizedTitle.includes(normalizedTerm)) {
        return true;
    }

    // Try fuzzy match
    return fuzzyMatch(normalizedTitle, normalizedTerm, 0.6);
}

/**
 * Search jobs by title (fuzzy matching)
 * Supports boolean queries with OR/AND operators and comma separators:
 *   - "software engineer OR internship" - matches jobs with either term
 *   - "software engineer AND python" - matches jobs with both terms
 *   - "software engineer, intern, applied ai" - matches jobs with any term (comma-separated, OR logic)
 *   - "software engineer" - matches jobs with all words (AND logic by default)
 * Uses fuzzy matching to handle typos and variations
 */
export function searchJobsByTitle(jobs: JobMarker[], titleQuery: string): JobMarker[] {
    const query = titleQuery.toLowerCase().trim();

    // Parse boolean query
    const { type, terms } = parseBooleanQuery(query);

    return jobs.filter(job => {
        const title = job.title.toLowerCase();

        // First try fuzzy matching the entire query as a phrase
        if (fuzzyMatch(title, query, 0.7)) {
            return true;
        }

        // Apply boolean logic
        if (type === 'OR') {
            // OR logic: at least one term must match
            return terms.some(term => matchesTerm(title, term));
        } else {
            // AND logic: all terms must match
            return terms.every(term => matchesTerm(title, term));
        }
    });
}

/**
 * Get unique location count
 */
export function getUniqueLocationCount(jobs: JobMarker[]): number {
    return new Set(jobs.map(job => job.location.trim())).size;
}

/**
 * Get unique company count
 */
export function getUniqueCompanyCount(jobs: JobMarker[]): number {
    return new Set(jobs.map(job => job.company.trim())).size;
}


/**
 * Calculate geographic spread of job locations
 * Returns information about how scattered the locations are
 */
function calculateGeographicSpread(jobs: JobMarker[]): {
    isScattered: boolean;
    spreadDescription: string;
    boundingBox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
    recommendedZoom: number;
} {
    const validJobs = jobs.filter(j => !isNaN(j.lat) && !isNaN(j.lng) && j.lat !== 0 && j.lng !== 0);

    if (validJobs.length === 0) {
        return {
            isScattered: false,
            spreadDescription: 'No valid locations',
            boundingBox: null,
            recommendedZoom: 3,
        };
    }

    const lats = validJobs.map(j => j.lat);
    const lngs = validJobs.map(j => j.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;

    // Calculate approximate distance in degrees
    // Rough conversion: 1 degree latitude ≈ 111 km, longitude varies by latitude
    const avgLat = (minLat + maxLat) / 2;
    const latDistanceKm = latRange * 111;
    const lngDistanceKm = lngRange * 111 * Math.cos(avgLat * Math.PI / 180);
    const maxDistanceKm = Math.max(latDistanceKm, lngDistanceKm);

    // Determine if scattered:
    // - Very scattered: spans multiple continents (>5000 km) or very wide spread
    // - Scattered: spans large regions (>2000 km)
    // - Concentrated: smaller regions (<2000 km)
    const isScattered = maxDistanceKm > 2000 || latRange > 30 || lngRange > 60;

    let spreadDescription: string;
    let recommendedZoom: number;

    if (maxDistanceKm > 10000 || latRange > 60) {
        spreadDescription = 'very scattered across multiple continents';
        recommendedZoom = 1.5; // World view
    } else if (maxDistanceKm > 5000 || latRange > 40) {
        spreadDescription = 'scattered across multiple continents or very wide regions';
        recommendedZoom = 2; // Continental view
    } else if (maxDistanceKm > 2000 || latRange > 20) {
        spreadDescription = 'scattered across large regions';
        recommendedZoom = 3; // Regional view
    } else if (maxDistanceKm > 1000) {
        spreadDescription = 'moderately spread across a region';
        recommendedZoom = 4; // Country/region view
    } else {
        spreadDescription = 'concentrated in a specific area';
        recommendedZoom = 6; // State/country view
    }

    return {
        isScattered,
        spreadDescription,
        boundingBox: {
            minLat,
            maxLat,
            minLng,
            maxLng,
        },
        recommendedZoom,
    };
}

/**
 * Build data context for LLM
 */
export function buildDataContext(jobs: JobMarker[], viewState?: { latitude: number; longitude: number; zoom: number }) {
    const locationStats = getLocationStats(jobs);
    const companyStats = getCompanyStats(jobs);
    const geographicSpread = calculateGeographicSpread(jobs);

    return {
        totalJobs: jobs.length,
        uniqueLocations: getUniqueLocationCount(jobs),
        uniqueCompanies: getUniqueCompanyCount(jobs),
        topLocations: locationStats.slice(0, 10).map(loc => ({
            location: loc.location,
            jobCount: loc.count,
            companyCount: loc.companies.length,
        })),
        topCompanies: companyStats.slice(0, 10).map(comp => ({
            company: comp.company,
            jobCount: comp.count,
            locationCount: comp.locations.length,
        })),
        geographicSpread: {
            isScattered: geographicSpread.isScattered,
            spreadDescription: geographicSpread.spreadDescription,
            recommendedZoom: geographicSpread.recommendedZoom,
            boundingBox: geographicSpread.boundingBox,
        },
        currentView: viewState ? {
            center: { lat: viewState.latitude, lng: viewState.longitude },
            zoom: viewState.zoom,
        } : undefined,
        sampleJob: jobs[0] ? {
            title: jobs[0].title,
            company: jobs[0].company,
            location: jobs[0].location,
        } : undefined,
    };
}


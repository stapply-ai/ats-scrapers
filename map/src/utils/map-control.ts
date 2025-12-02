import type { JobMarker } from '@/types';
import { filterJobsByLocation, filterJobsByCompany, searchJobsByTitle, getLocationStats } from './data-queries';

export interface ViewState {
    longitude: number;
    latitude: number;
    zoom: number;
}

export interface MapControlCallbacks {
    flyTo: (longitude: number, latitude: number, zoom?: number) => void;
    setZoom: (zoom: number) => void;
    setFilteredJobs: (jobs: JobMarker[] | null) => void;
    getViewState: () => ViewState;
}

// Common city coordinates for quick navigation
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
    'san francisco': { lat: 37.7749, lng: -122.4194 },
    'new york': { lat: 40.7128, lng: -74.006 },
    'los angeles': { lat: 34.0522, lng: -118.2437 },
    'chicago': { lat: 41.8781, lng: -87.6298 },
    'seattle': { lat: 47.6062, lng: -122.3321 },
    'austin': { lat: 30.2672, lng: -97.7431 },
    'boston': { lat: 42.3601, lng: -71.0589 },
    'denver': { lat: 39.7392, lng: -104.9903 },
    'washington': { lat: 38.9072, lng: -77.0369 },
    'miami': { lat: 25.7617, lng: -80.1918 },
    'atlanta': { lat: 33.749, lng: -84.388 },
    'dallas': { lat: 32.7767, lng: -96.797 },
    'philadelphia': { lat: 39.9526, lng: -75.1652 },
    'phoenix': { lat: 33.4484, lng: -112.074 },
    'portland': { lat: 45.5152, lng: -122.6784 },
    'san diego': { lat: 32.7157, lng: -117.1611 },
    'minneapolis': { lat: 44.9778, lng: -93.265 },
    'detroit': { lat: 42.3314, lng: -83.0458 },
    'houston': { lat: 29.7604, lng: -95.3698 },
};

/**
 * Normalize location name for lookup
 */
function normalizeLocation(location: string): string {
    return location.toLowerCase().trim();
}

/**
 * Collect unique, alphabetized values for a given job field
 */
function collectUniqueJobValues(
    jobs: JobMarker[],
    key: keyof Pick<JobMarker, 'company' | 'location' | 'title'>
): string[] {
    const seen = new Set<string>();

    for (const job of jobs) {
        const rawValue = job[key];
        const value = typeof rawValue === 'string' ? rawValue.trim() : '';
        if (value) {
            seen.add(value);
        }
    }

    return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function normalizePagination(page?: number, pageSize?: number) {
    const safePage = Math.max(1, Math.floor(page ?? 1));
    const safeSize = Math.max(
        1,
        Math.min(MAX_PAGE_SIZE, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE))
    );
    return { page: safePage, pageSize: safeSize };
}

function paginateValues(values: string[], page?: number, pageSize?: number) {
    const { page: currentPage, pageSize: currentPageSize } = normalizePagination(page, pageSize);
    const total = values.length;
    const start = (currentPage - 1) * currentPageSize;
    const paginated = values.slice(start, start + currentPageSize);
    const totalPages = Math.max(1, Math.ceil(Math.max(1, total) / currentPageSize));

    return {
        set: paginated,
        total,
        page: currentPage,
        pageSize: currentPageSize,
        totalPages,
    };
}

/**
 * Calculate appropriate zoom level based on geographic spread of jobs
 */
function calculateAppropriateZoom(jobs: JobMarker[]): number {
    const validJobs = jobs.filter(j => !isNaN(j.lat) && !isNaN(j.lng) && j.lat !== 0 && j.lng !== 0);

    if (validJobs.length === 0) {
        return 3;
    }

    if (validJobs.length === 1) {
        return 10; // Single location, zoom to city level
    }

    const lats = validJobs.map(j => j.lat);
    const lngs = validJobs.map(j => j.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;

    // Calculate approximate distance in km
    const avgLat = (minLat + maxLat) / 2;
    const latDistanceKm = latRange * 111;
    const lngDistanceKm = lngRange * 111 * Math.cos(avgLat * Math.PI / 180);
    const maxDistanceKm = Math.max(latDistanceKm, lngDistanceKm);

    // Determine zoom level based on spread
    if (maxDistanceKm > 10000 || latRange > 60) {
        return 1.5; // World view
    } else if (maxDistanceKm > 5000 || latRange > 40) {
        return 2; // Continental view
    } else if (maxDistanceKm > 2000 || latRange > 20) {
        return 3; // Regional view
    } else if (maxDistanceKm > 1000) {
        return 4; // Country/region view
    } else if (maxDistanceKm > 500) {
        return 5; // State/province view
    } else if (maxDistanceKm > 200) {
        return 6; // Multi-city view
    } else {
        return 8; // City/metro view
    }
}

/**
 * Find coordinates for a location
 */
function findLocationCoordinates(location: string, allJobs: JobMarker[]): { lat: number; lng: number } | null {
    const normalized = normalizeLocation(location);

    // Check common cities first
    for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
        if (normalized.includes(city) || city.includes(normalized)) {
            return coords;
        }
    }

    // Try to find in job data
    const matchingJobs = filterJobsByLocation(allJobs, location);
    if (matchingJobs.length > 0) {
        // Use average coordinates of matching jobs
        const avgLat = matchingJobs.reduce((sum, job) => sum + job.lat, 0) / matchingJobs.length;
        const avgLng = matchingJobs.reduce((sum, job) => sum + job.lng, 0) / matchingJobs.length;
        return { lat: avgLat, lng: avgLng };
    }

    return null;
}

/**
 * Map control functions that can be called by the LLM
 */
export const mapControlFunctions = {
    /**
     * Navigate map to a specific location
     */
    flyToLocation: (
        location: string,
        allJobs: JobMarker[],
        callbacks: MapControlCallbacks,
        zoom?: number
    ): { success: boolean; message: string } => {
        const coords = findLocationCoordinates(location, allJobs);

        if (!coords) {
            return {
                success: false,
                message: `Could not find coordinates for location: ${location}`,
            };
        }

        const targetZoom = zoom || 10;
        callbacks.flyTo(coords.lng, coords.lat, targetZoom);

        return {
            success: true,
            message: `Navigated to ${location}`,
        };
    },

    /**
     * Set map zoom level
     */
    setZoom: (
        zoom: number,
        callbacks: MapControlCallbacks
    ): { success: boolean; message: string } => {
        const clampedZoom = Math.max(1, Math.min(15, zoom));
        callbacks.setZoom(clampedZoom);

        return {
            success: true,
            message: `Zoom set to ${clampedZoom}`,
        };
    },

    /**
     * Filter jobs by location
     */
    filterJobsByLocation: (
        location: string,
        allJobs: JobMarker[],
        callbacks: MapControlCallbacks
    ): { success: boolean; message: string; count: number } => {
        const filtered = filterJobsByLocation(allJobs, location);
        callbacks.setFilteredJobs(filtered.length > 0 ? filtered : null);

        if (filtered.length === 0) {
            return {
                success: false,
                message: `No jobs found for location: ${location}`,
                count: 0,
            };
        }

        // Fly to the location with appropriate zoom based on geographic spread
        const validJobs = filtered.filter(j => !isNaN(j.lat) && !isNaN(j.lng) && j.lat !== 0 && j.lng !== 0);
        if (validJobs.length > 0) {
            const coords = findLocationCoordinates(location, filtered);
            if (coords) {
                const appropriateZoom = calculateAppropriateZoom(validJobs);
                callbacks.flyTo(coords.lng, coords.lat, appropriateZoom);
            } else {
                // Fallback: use center of filtered jobs
                const avgLat = validJobs.reduce((sum, job) => sum + job.lat, 0) / validJobs.length;
                const avgLng = validJobs.reduce((sum, job) => sum + job.lng, 0) / validJobs.length;
                const appropriateZoom = calculateAppropriateZoom(validJobs);
                callbacks.flyTo(avgLng, avgLat, appropriateZoom);
            }
        }

        return {
            success: true,
            message: `Found ${filtered.length} jobs in ${location}`,
            count: filtered.length,
        };
    },

    /**
     * Filter jobs by company
     */
    filterJobsByCompany: (
        company: string,
        allJobs: JobMarker[],
        callbacks: MapControlCallbacks
    ): { success: boolean; message: string; count: number } => {
        const filtered = filterJobsByCompany(allJobs, company);
        callbacks.setFilteredJobs(filtered.length > 0 ? filtered : null);

        if (filtered.length === 0) {
            return {
                success: false,
                message: `No jobs found for company: ${company}`,
                count: 0,
            };
        }

        // Fly to the center of filtered jobs with appropriate zoom
        const validJobs = filtered.filter(j => !isNaN(j.lat) && !isNaN(j.lng) && j.lat !== 0 && j.lng !== 0);
        if (validJobs.length > 0) {
            const avgLat = validJobs.reduce((sum, job) => sum + job.lat, 0) / validJobs.length;
            const avgLng = validJobs.reduce((sum, job) => sum + job.lng, 0) / validJobs.length;
            const appropriateZoom = calculateAppropriateZoom(validJobs);
            callbacks.flyTo(avgLng, avgLat, appropriateZoom);
        }

        return {
            success: true,
            message: `Found ${filtered.length} jobs at ${company}`,
            count: filtered.length,
        };
    },

    /**
     * Filter jobs by title/keywords
     */
    filterJobsByTitle: (
        titleQuery: string,
        allJobs: JobMarker[],
        callbacks: MapControlCallbacks,
        location?: string
    ): { success: boolean; message: string; count: number } => {
        let filtered = searchJobsByTitle(allJobs, titleQuery);

        // If location is provided and not "world"/"globally", apply location filter
        if (location) {
            const normalizedLocation = location.toLowerCase().trim();
            if (normalizedLocation !== 'world' && normalizedLocation !== 'globally' && normalizedLocation !== 'global') {
                filtered = filterJobsByLocation(filtered, location);
            }
        }

        callbacks.setFilteredJobs(filtered.length > 0 ? filtered : null);

        if (filtered.length === 0) {
            return {
                success: false,
                message: location
                    ? `No jobs found matching "${titleQuery}" in ${location}`
                    : `No jobs found matching "${titleQuery}"`,
                count: 0,
            };
        }

        // Fly to the center of filtered jobs with appropriate zoom
        const validJobs = filtered.filter(j => !isNaN(j.lat) && !isNaN(j.lng) && j.lat !== 0 && j.lng !== 0);
        if (validJobs.length > 0) {
            const avgLat = validJobs.reduce((sum, job) => sum + job.lat, 0) / validJobs.length;
            const avgLng = validJobs.reduce((sum, job) => sum + job.lng, 0) / validJobs.length;
            const appropriateZoom = calculateAppropriateZoom(validJobs);
            callbacks.flyTo(avgLng, avgLat, appropriateZoom);
        }

        return {
            success: true,
            message: location
                ? `Found ${filtered.length} jobs matching "${titleQuery}" in ${location}`
                : `Found ${filtered.length} jobs matching "${titleQuery}"`,
            count: filtered.length,
        };
    },

    /**
     * Reset all filters
     */
    resetFilters: (callbacks: MapControlCallbacks): { success: boolean; message: string } => {
        callbacks.setFilteredJobs(null);
        return {
            success: true,
            message: 'Filters reset',
        };
    },

    /**
     * Get statistics for a location
     */
    getLocationStats: (
        location: string,
        allJobs: JobMarker[]
    ): { success: boolean; message: string; stats?: any } => {
        const filtered = filterJobsByLocation(allJobs, location);

        if (filtered.length === 0) {
            return {
                success: false,
                message: `No jobs found for location: ${location}`,
            };
        }

        const stats = getLocationStats(filtered);
        const locationStat = stats.find(s =>
            s.location.toLowerCase().includes(location.toLowerCase())
        );

        if (!locationStat) {
            return {
                success: false,
                message: `Could not get stats for location: ${location}`,
            };
        }

        return {
            success: true,
            message: `Statistics for ${location}`,
            stats: {
                location: locationStat.location,
                jobCount: locationStat.count,
                companyCount: locationStat.companies.length,
                topCompanies: locationStat.companies.slice(0, 5),
            },
        };
    },

    /**
     * List all available companies in the dataset
     */
    allAvailableCompanies: (
        allJobs: JobMarker[],
        page?: number,
        pageSize?: number
    ): {
        success: boolean;
        message: string;
        set: string[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    } => {
        const companies = collectUniqueJobValues(allJobs, 'company');
        const pagination = paginateValues(companies, page, pageSize);
        const { set, total, totalPages: availablePages } = pagination;

        return {
            success: true,
            message: total
                ? `Returning ${set.length} of ${total} companies`
                : 'No companies available',
            set,
            total,
            page: pagination.page,
            pageSize: pagination.pageSize,
            totalPages: availablePages,
        };
    },

    /**
     * List all available locations in the dataset
     */
    allAvailableLocations: (
        allJobs: JobMarker[],
        page?: number,
        pageSize?: number
    ): {
        success: boolean;
        message: string;
        set: string[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    } => {
        const locations = collectUniqueJobValues(allJobs, 'location');
        const pagination = paginateValues(locations, page, pageSize);
        const { set, total, totalPages: availablePages } = pagination;

        return {
            success: true,
            message: total
                ? `Returning ${set.length} of ${total} locations`
                : 'No locations available',
            set,
            total,
            page: pagination.page,
            pageSize: pagination.pageSize,
            totalPages: availablePages,
        };
    },

    /**
     * List all available titles in the dataset
     */
    allAvailableTitles: (
        allJobs: JobMarker[],
        page?: number,
        pageSize?: number
    ): {
        success: boolean;
        message: string;
        set: string[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    } => {
        const titles = collectUniqueJobValues(allJobs, 'title');
        const pagination = paginateValues(titles, page, pageSize);
        const { set, total, totalPages: availablePages } = pagination;

        return {
            success: true,
            message: total
                ? `Returning ${set.length} of ${total} titles`
                : 'No titles available',
            set,
            total,
            page: pagination.page,
            pageSize: pagination.pageSize,
            totalPages: availablePages,
        };
    },
};

/**
 * Function definitions for Mistral AI function calling
 */
export const mapControlFunctionDefinitions = [
    {
        name: 'flyToLocation',
        description: 'Navigate the map to a specific location (city, state, or country). Use this when the user wants to see a particular place on the map. IMPORTANT: If showing multiple scattered locations or filtered results across wide geographic areas, use lower zoom levels (1-3 for world/continental views, 3-4 for regional views) to ensure all locations are visible. Only use higher zoom (6+) for single city/region focus.',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'Location name (e.g., "San Francisco", "New York, NY", "California")',
                },
                zoom: {
                    type: 'number',
                    description: 'Zoom level (1-15). Use 1-2 for world/continental views (scattered locations), 3-4 for regional views, 6-8 for country/state views, 10+ for city views. Default is 10 for cities, 6 for states/countries, but adjust lower if showing scattered locations.',
                },
            },
            required: ['location'],
        },
    },
    {
        name: 'setZoom',
        description: 'Set the map zoom level. Use this when the user wants to zoom in or out.',
        parameters: {
            type: 'object',
            properties: {
                zoom: {
                    type: 'number',
                    description: 'Zoom level from 1 (world view) to 15 (street level)',
                },
            },
            required: ['zoom'],
        },
    },
    {
        name: 'filterJobsByLocation',
        description: 'Filter and highlight jobs in a specific location. This will show only jobs in that location and navigate to it.',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'Location to filter by (e.g., "San Francisco", "New York")',
                },
            },
            required: ['location'],
        },
    },
    {
        name: 'filterJobsByCompany',
        description: 'Filter and highlight jobs from a specific company. This will show only jobs from that company.',
        parameters: {
            type: 'object',
            properties: {
                company: {
                    type: 'string',
                    description: 'Company name to filter by',
                },
            },
            required: ['company'],
        },
    },
    {
        name: 'filterJobsByTitle',
        description: 'Filter and highlight jobs by title or keywords. Supports boolean queries with OR/AND operators and comma separators. Examples: "software engineer OR internship" (matches either term), "software engineer AND python" (matches both terms), "software engineer, intern, applied ai" (matches any term, comma-separated), "software engineer" (matches all words, AND logic by default). Can optionally filter by location as well. Use this when users want to see specific types of jobs like "show me all tech internships" or "show me software engineer jobs in San Francisco". IMPORTANT: After filtering, if the results span multiple scattered locations, automatically set an appropriate zoom level (1-3 for world/continental views) to show all matching locations.',
        parameters: {
            type: 'object',
            properties: {
                titleQuery: {
                    type: 'string',
                    description: 'Keywords or job title to search for. Supports boolean operators and comma separators: use "OR" for matching any term (e.g., "software engineer OR internship OR applied ai"), use "AND" for matching all terms (e.g., "software engineer AND python"), use commas for OR logic (e.g., "software engineer, intern, applied ai"), or just space-separated words for AND logic (e.g., "software engineer").',
                },
                location: {
                    type: 'string',
                    description: 'Optional location filter (e.g., "San Francisco", "New York", "world", "globally"). If not provided, searches all locations.',
                },
            },
            required: ['titleQuery'],
        },
    },
    {
        name: 'resetFilters',
        description: 'Reset all filters and show all jobs on the map.',
        parameters: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'getLocationStats',
        description: 'Get statistics about jobs in a specific location (job count, companies, etc.).',
        parameters: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'Location to get statistics for',
                },
            },
            required: ['location'],
        },
    },
    {
        name: 'allAvailableCompanies',
        description: 'Retrieve a sorted list of all distinct company names present in the dataset.',
        parameters: {
            type: 'object',
            properties: {
                page: {
                    type: 'number',
                    description: 'Page number (>=1). Defaults to 1.',
                },
                pageSize: {
                    type: 'number',
                    description: 'Page size (1-200). Defaults to 50.',
                },
            },
            required: [],
        },
    },
    {
        name: 'allAvailableLocations',
        description: 'Retrieve a sorted list of all distinct job locations present in the dataset.',
        parameters: {
            type: 'object',
            properties: {
                page: {
                    type: 'number',
                    description: 'Page number (>=1). Defaults to 1.',
                },
                pageSize: {
                    type: 'number',
                    description: 'Page size (1-200). Defaults to 50.',
                },
            },
            required: [],
        },
    },
    {
        name: 'allAvailableTitles',
        description: 'Retrieve a sorted list of all distinct job titles present in the dataset.',
        parameters: {
            type: 'object',
            properties: {
                page: {
                    type: 'number',
                    description: 'Page number (>=1). Defaults to 1.',
                },
                pageSize: {
                    type: 'number',
                    description: 'Page size (1-200). Defaults to 50.',
                },
            },
            required: [],
        },
    },
];


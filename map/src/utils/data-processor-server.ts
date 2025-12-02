import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import type { JobMarker } from '@/types';

export async function loadJobsWithCoordinatesServer(filePath: string): Promise<JobMarker[]> {
    // Remove leading slash if present and resolve path
    const cleanPath = filePath.replace(/^\//, '');
    const filePathResolved = path.join(process.cwd(), 'public', cleanPath);

    if (!fs.existsSync(filePathResolved)) {
        throw new Error(`CSV file not found: ${filePathResolved}`);
    }

    const csvText = fs.readFileSync(filePathResolved, 'utf-8');

    return new Promise((resolve, reject) => {
        Papa.parse<JobMarker & { lon?: number }>(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => {
                const markers: JobMarker[] = results.data
                    .map((row: any) => {
                        // Handle lat - check for number, string, or null/undefined
                        let lat: number = NaN;
                        if (typeof row.lat === 'number') {
                            lat = row.lat;
                        } else if (row.lat !== null && row.lat !== undefined && row.lat !== '') {
                            const parsed = parseFloat(String(row.lat));
                            if (!isNaN(parsed)) lat = parsed;
                        }

                        // Handle lng/lon - prefer lon (from CSV), fallback to lng
                        let lng: number = NaN;
                        const lonValue = row.lon !== undefined ? row.lon : row.lng;
                        if (typeof lonValue === 'number') {
                            lng = lonValue;
                        } else if (lonValue !== null && lonValue !== undefined && lonValue !== '') {
                            const parsed = parseFloat(String(lonValue));
                            if (!isNaN(parsed)) lng = parsed;
                        }

                        return {
                            url: String(row.url || ''),
                            title: String(row.title || ''),
                            location: String(row.location || ''),
                            company: String(row.company || ''),
                            ats_id: String(row.ats_id || ''),
                            id: String(row.id || ''),
                            lat,
                            lng,
                            salary_min: row.salary_min ? String(row.salary_min) : null,
                            salary_max: row.salary_max ? String(row.salary_max) : null,
                            salary_currency: row.salary_currency ? String(row.salary_currency) : null,
                            salary_period: row.salary_period ? String(row.salary_period) : null,
                            salary_summary: row.salary_summary ? String(row.salary_summary) : null,
                        };
                    })
                    .filter((marker) => {
                        const isValid = !isNaN(marker.lat) && !isNaN(marker.lng) &&
                            marker.lat != null && marker.lng != null &&
                            isFinite(marker.lat) && isFinite(marker.lng);
                        return isValid;
                    });

                resolve(markers);
            },
            error: (error: Error) => {
                reject(error);
            },
        });
    });
}


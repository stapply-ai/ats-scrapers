'use client';

import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { JobMarker } from '@/types';
import { generateJobSlug, generateCompanySlug } from '@/lib/slug-utils';
import { useDebounce } from '@/hooks/use-debounce';
import { formatSalary } from '@/utils/salary-format';

interface JobListSidebarProps {
  jobs: JobMarker[];
  isOpen: boolean;
  onClose: () => void;
  onJobClick?: (job: JobMarker) => void;
  filteredJobs?: JobMarker[] | null;
}

type SortOption = 'company' | 'location' | 'title';

// Normalized job data structure for faster filtering
interface NormalizedJob extends JobMarker {
  _normalized: {
    titleLower: string;
    companyLower: string;
    locationLower: string;
  };
}

// Memoized job item component to prevent unnecessary re-renders
const JobItem = memo(function JobItem({
  job,
  onJobClick
}: {
  job: NormalizedJob;
  onJobClick?: (job: JobMarker) => void;
}) {
  const handleClick = useCallback(() => {
    onJobClick?.(job);
  }, [job, onJobClick]);

  return (
    <div
      className={clsx(
        'p-4 transition-all duration-150',
        'hover:bg-white/5 cursor-pointer'
      )}
      onClick={handleClick}
    >
      {/* Company and Salary */}
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Link
          href={`/company/${generateCompanySlug(job.company)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] lg:text-[11px] xl:text-[12px] font-medium text-white/50 uppercase tracking-wider no-underline hover:text-blue-400 transition-colors"
        >
          {job.company}
        </Link>
        {formatSalary(job) && (
          <span className="text-[10px] lg:text-[11px] xl:text-[12px] text-green-400/80 font-medium">
            {formatSalary(job)}
          </span>
        )}
      </div>

      {/* Title */}
      <Link
        href={`/jobs/${generateJobSlug(job.title, job.id, job.company)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-[13px] lg:text-[14px] xl:text-[15px] font-medium text-white mb-1 leading-normal m-0 no-underline hover:text-blue-400 transition-colors block"
      >
        {job.title}
      </Link>

      {/* Location */}
      <div className="flex items-center gap-1.5 text-[12px] lg:text-[13px] xl:text-[14px] text-white/60 mb-3">
        <svg
          width="12"
          height="12"
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
        {job.location}
      </div>

      {/* View Job Button */}
      <Link
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'inline-flex items-center gap-1.5',
          'px-[10px] py-1 bg-white/8 text-white no-underline rounded-full',
          'text-[11px] lg:text-[12px] xl:text-[13px] font-medium border border-white/12',
          'transition-[border-color,background-color] duration-200 ease-in-out',
          'hover:bg-white/12 hover:border-white/20'
        )}
      >
        View Job
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </Link>
    </div>
  );
});

export function JobListSidebar({ jobs, isOpen, onClose, onJobClick, filteredJobs }: JobListSidebarProps) {
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('company');
  const parentRef = useRef<HTMLDivElement>(null);

  // Debounce search text to avoid filtering on every keystroke
  const debouncedSearchText = useDebounce(searchText, 200);

  const displayJobs = useMemo(() => {
    return filteredJobs !== null && filteredJobs !== undefined ? filteredJobs : jobs;
  }, [jobs, filteredJobs]);

  // Pre-normalize job data once (lowercase fields for faster filtering)
  const normalizedJobs = useMemo(() => {
    return displayJobs.map((job): NormalizedJob => ({
      ...job,
      _normalized: {
        titleLower: job.title.toLowerCase(),
        companyLower: job.company.toLowerCase(),
        locationLower: job.location.toLowerCase(),
      },
    }));
  }, [displayJobs]);

  // Deduplicate jobs by URL (memoized)
  const deduplicatedJobs = useMemo(() => {
    const seenUrls = new Set<string>();
    const deduplicated: NormalizedJob[] = [];

    for (const job of normalizedJobs) {
      if (!seenUrls.has(job.url)) {
        seenUrls.add(job.url);
        deduplicated.push(job);
      }
    }

    return deduplicated;
  }, [normalizedJobs]);

  // Filter and sort jobs (optimized)
  const processedJobs = useMemo(() => {
    let filtered = deduplicatedJobs;

    // Apply search filter (using pre-normalized data)
    if (debouncedSearchText.trim()) {
      const searchLower = debouncedSearchText.toLowerCase();
      // Pre-allocate array for better performance
      filtered = filtered.filter(job => {
        const norm = job._normalized;
        return (
          norm.titleLower.includes(searchLower) ||
          norm.companyLower.includes(searchLower) ||
          norm.locationLower.includes(searchLower)
        );
      });
    }

    // Sort jobs (optimize by avoiding array spread when not needed)
    if (sortBy !== 'company' || debouncedSearchText.trim()) {
      // Only create new array if we need to sort
      const sorted = [...filtered];
      switch (sortBy) {
        case 'company':
          sorted.sort((a, b) => a.company.localeCompare(b.company));
          break;
        case 'location':
          sorted.sort((a, b) => a.location.localeCompare(b.location));
          break;
        case 'title':
          sorted.sort((a, b) => a.title.localeCompare(b.title));
          break;
      }
      return sorted;
    }

    return filtered;
  }, [deduplicatedJobs, debouncedSearchText, sortBy]);

  // Group jobs by company for stats (optimized)
  const companiesCount = useMemo(() => {
    const companies = new Set<string>();
    for (const job of processedJobs) {
      companies.add(job.company);
    }
    return companies.size;
  }, [processedJobs]);

  const locationsCount = useMemo(() => {
    const locations = new Set<string>();
    for (const job of processedJobs) {
      locations.add(job.location);
    }
    return locations.size;
  }, [processedJobs]);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: processedJobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160, // Estimated height of each job item
    overscan: 5, // Render 5 extra items outside viewport
  });

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleJobClick = useCallback((job: JobMarker) => {
    onJobClick?.(job);
  }, [onJobClick]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={clsx(
          'fixed top-0 right-0 h-screen z-40',
          'bg-black backdrop-blur-2xl',
          'border-l border-white/10',
          'w-full md:w-[480px]',
          'flex flex-col',
          'font-[system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif]',
          'transition-transform duration-300 ease-in-out',
          'shadow-[0_8px_32px_rgba(0,0,0,0.8)]',
          {
            'translate-x-0': isOpen,
            'translate-x-full': !isOpen,
          }
        )}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/10 bg-black/30">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-[15px] lg:text-[16px] xl:text-[17px] font-medium text-white m-0 tracking-[-0.01em]">All Jobs</h2>
              <p className="text-[11px] lg:text-[12px] xl:text-[13px] text-white/50 mt-1 m-0">
                {processedJobs.length.toLocaleString()} jobs • {companiesCount} companies • {locationsCount} locations
              </p>
            </div>
            <button
              onClick={onClose}
              className={clsx(
                'bg-transparent border-none rounded-md',
                'w-6 h-6 flex items-center justify-center',
                'cursor-pointer text-white/40 text-xl leading-none',
                'transition-all duration-150',
                'hover:bg-white/10 hover:text-white/80'
              )}
            >
              ×
            </button>
          </div>

          {/* Search and Sort */}
          <div className="px-5 pb-4 space-y-3">
            {/* Search */}
            <div
              className={clsx(
                'bg-white/8 rounded-xl border border-white/12 overflow-hidden',
                'transition-all duration-200',
                'focus-within:border-blue-500/50 focus-within:bg-white/10'
              )}
            >
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className={clsx(
                  'w-full px-4 py-2.5',
                  'bg-transparent border-none text-white text-[13px] lg:text-[14px] outline-none',
                  'placeholder:text-white/40'
                )}
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] lg:text-[12px] xl:text-[13px] text-white/50">Sort:</span>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { value: 'company', label: 'Company' },
                  { value: 'location', label: 'Location' },
                  { value: 'title', label: 'Title' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value as SortOption)}
                    className={clsx(
                      'px-[10px] py-1 rounded-full text-[11px] lg:text-[12px] font-medium',
                      'transition-[border-color,background-color] duration-200 ease-in-out cursor-pointer',
                      sortBy === option.value
                        ? 'bg-white/12 border border-white/20 text-white'
                        : 'bg-white/8 border border-white/12 text-white/70 hover:bg-white/12 hover:border-white/20'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Job List - Virtualized */}
        <div
          ref={parentRef}
          className="flex-1 overflow-y-auto custom-scrollbar bg-black"
        >
          {processedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40 px-6 text-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-3 opacity-50"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <p className="text-[13px] lg:text-[14px] xl:text-[15px] text-white/60 m-0">No jobs found</p>
              <p className="text-[11px] lg:text-[12px] xl:text-[13px] text-white/40 mt-2 m-0">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const job = processedJobs[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <JobItem job={job} onJobClick={handleJobClick} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with stats */}
        {processedJobs.length > 0 && (
          <div className="shrink-0 border-t border-white/10 bg-black/30 px-5 py-3">
            <div className="text-[11px] lg:text-[12px] xl:text-[13px] text-white/50 text-center">
              Showing {processedJobs.length.toLocaleString()} of {jobs.length.toLocaleString()} jobs
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </>
  );
}
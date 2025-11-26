import { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import type { JobMarker } from '../types';

interface FilterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobMarker[];
  onApplyFilters: (filters: FilterState) => void;
}

export interface FilterState {
  companies: string[];
  locations: string[];
  searchText: string;
}

export function FilterDialog({ isOpen, onClose, jobs, onApplyFilters }: FilterDialogProps) {
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [companySearchText, setCompanySearchText] = useState('');
  const [locationSearchText, setLocationSearchText] = useState('');

  // Extract unique companies and locations from jobs
  const { companies, locations } = useMemo(() => {
    const companiesSet = new Set<string>();
    const locationsSet = new Set<string>();

    jobs.forEach(job => {
      if (job.company) {
        const normalized = job.company.trim();
        if (normalized) companiesSet.add(normalized);
      }
      if (job.location) {
        const normalized = job.location.trim();
        if (normalized) locationsSet.add(normalized);
      }
    });

    return {
      companies: Array.from(companiesSet).sort(),
      locations: Array.from(locationsSet).sort(),
    };
  }, [jobs]);

  // Filter companies and locations based on search
  const filteredCompanies = useMemo(() => {
    if (!companySearchText) return companies;
    return companies.filter(company =>
      company.toLowerCase().includes(companySearchText.toLowerCase())
    );
  }, [companies, companySearchText]);

  const filteredLocations = useMemo(() => {
    if (!locationSearchText) return locations;
    return locations.filter(location =>
      location.toLowerCase().includes(locationSearchText.toLowerCase())
    );
  }, [locations, locationSearchText]);

  const handleCompanyToggle = (company: string) => {
    const newSelected = new Set(selectedCompanies);
    if (newSelected.has(company)) {
      newSelected.delete(company);
    } else {
      newSelected.add(company);
    }
    setSelectedCompanies(newSelected);
  };

  const handleLocationToggle = (location: string) => {
    const newSelected = new Set(selectedLocations);
    if (newSelected.has(location)) {
      newSelected.delete(location);
    } else {
      newSelected.add(location);
    }
    setSelectedLocations(newSelected);
  };

  const handleSelectAllCompanies = () => {
    if (selectedCompanies.size === filteredCompanies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(filteredCompanies));
    }
  };

  const handleSelectAllLocations = () => {
    if (selectedLocations.size === filteredLocations.length) {
      setSelectedLocations(new Set());
    } else {
      setSelectedLocations(new Set(filteredLocations));
    }
  };

  const handleApply = () => {
    onApplyFilters({
      companies: Array.from(selectedCompanies),
      locations: Array.from(selectedLocations),
      searchText,
    });
    onClose();
  };

  const handleReset = () => {
    setSelectedCompanies(new Set());
    setSelectedLocations(new Set());
    setSearchText('');
    setCompanySearchText('');
    setLocationSearchText('');
  };

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={clsx(
          'bg-black backdrop-blur-2xl',
          'border border-white/10 rounded-2xl',
          'w-[90vw] max-w-[900px] max-h-[80vh]',
          'text-white font-[system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif]',
          'flex flex-col',
          'shadow-[0_8px_32px_rgba(0,0,0,0.8)]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/30">
          <h2 className="text-[15px] font-medium m-0 tracking-[-0.01em]">Filter Jobs</h2>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-black">
          {/* General Search */}
          <div className="mb-5">
            <label className="block text-[11px] font-medium text-white/50 mb-2">
              Search by keyword
            </label>
            <div
              className={clsx(
                'bg-white/8 rounded-xl border border-white/12 overflow-hidden',
                'transition-all duration-200',
                'focus-within:border-blue-500/50 focus-within:bg-white/10'
              )}
            >
              <input
                type="text"
                placeholder="Search job titles, companies, locations..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className={clsx(
                  'w-full px-4 py-2.5',
                  'bg-transparent border-none text-white text-[13px] outline-none',
                  'placeholder:text-white/40'
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Companies */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium text-white/50">
                  Companies ({selectedCompanies.size} selected)
                </label>
                <button
                  onClick={handleSelectAllCompanies}
                  className={clsx(
                    'text-[11px] text-white/70 border-none bg-transparent cursor-pointer',
                    'transition-colors duration-200',
                    'hover:text-white'
                  )}
                >
                  {selectedCompanies.size === filteredCompanies.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div
                className={clsx(
                  'bg-white/8 rounded-xl border border-white/12 overflow-hidden mb-2',
                  'transition-all duration-200',
                  'focus-within:border-blue-500/50 focus-within:bg-white/10'
                )}
              >
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={companySearchText}
                  onChange={(e) => setCompanySearchText(e.target.value)}
                  className={clsx(
                    'w-full px-3 py-2',
                    'bg-transparent border-none text-white text-[13px] outline-none',
                    'placeholder:text-white/40'
                  )}
                />
              </div>

              <div className={clsx(
                'border border-white/10 rounded-lg',
                'bg-white/5 max-h-[300px] overflow-y-auto',
                'custom-scrollbar'
              )}>
                {filteredCompanies.length === 0 ? (
                  <div className="p-4 text-center text-white/40 text-[13px]">
                    No companies found
                  </div>
                ) : (
                  filteredCompanies.map((company) => (
                    <label
                      key={company}
                      className={clsx(
                        'flex items-center gap-2.5 px-3 py-2',
                        'cursor-pointer transition-colors duration-150',
                        'hover:bg-white/10',
                        'border-b border-white/5 last:border-b-0'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompanies.has(company)}
                        onChange={() => handleCompanyToggle(company)}
                        className={clsx(
                          'w-3.5 h-3.5 rounded',
                          'bg-white/10 border border-white/30',
                          'checked:bg-blue-500 checked:border-blue-500',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                          'cursor-pointer transition-all'
                        )}
                      />
                      <span className="text-[13px] text-white/90">{company}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Locations */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium text-white/50">
                  Locations ({selectedLocations.size} selected)
                </label>
                <button
                  onClick={handleSelectAllLocations}
                  className={clsx(
                    'text-[11px] text-white/70 border-none bg-transparent cursor-pointer',
                    'transition-colors duration-200',
                    'hover:text-white'
                  )}
                >
                  {selectedLocations.size === filteredLocations.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div
                className={clsx(
                  'bg-white/8 rounded-xl border border-white/12 overflow-hidden mb-2',
                  'transition-all duration-200',
                  'focus-within:border-blue-500/50 focus-within:bg-white/10'
                )}
              >
                <input
                  type="text"
                  placeholder="Search locations..."
                  value={locationSearchText}
                  onChange={(e) => setLocationSearchText(e.target.value)}
                  className={clsx(
                    'w-full px-3 py-2',
                    'bg-transparent border-none text-white text-[13px] outline-none',
                    'placeholder:text-white/40'
                  )}
                />
              </div>

              <div className={clsx(
                'border border-white/10 rounded-lg',
                'bg-white/5 max-h-[300px] overflow-y-auto',
                'custom-scrollbar'
              )}>
                {filteredLocations.length === 0 ? (
                  <div className="p-4 text-center text-white/40 text-[13px]">
                    No locations found
                  </div>
                ) : (
                  filteredLocations.map((location) => (
                    <label
                      key={location}
                      className={clsx(
                        'flex items-center gap-2.5 px-3 py-2',
                        'cursor-pointer transition-colors duration-150',
                        'hover:bg-white/10',
                        'border-b border-white/5 last:border-b-0'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLocations.has(location)}
                        onChange={() => handleLocationToggle(location)}
                        className={clsx(
                          'w-3.5 h-3.5 rounded',
                          'bg-white/10 border border-white/30',
                          'checked:bg-blue-500 checked:border-blue-500',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                          'cursor-pointer transition-all'
                        )}
                      />
                      <span className="text-[13px] text-white/90">{location}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-white/10 bg-black/30">
          <button
            onClick={handleReset}
            className={clsx(
              'px-[10px] py-1 rounded-full',
              'bg-white/8 border border-white/12',
              'text-white text-[11px] font-medium',
              'hover:bg-white/12 hover:border-white/20 transition-[border-color,background-color] duration-200 cursor-pointer'
            )}
          >
            Reset All
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={clsx(
                'px-[10px] py-1 rounded-full',
                'bg-white/8 border border-white/12',
                'text-white text-[11px] font-medium',
                'hover:bg-white/12 hover:border-white/20 transition-[border-color,background-color] duration-200 cursor-pointer'
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className={clsx(
                'px-[10px] py-1 rounded-full',
                'bg-white/12 border border-white/20',
                'text-white text-[11px] font-medium',
                'hover:bg-white/16 hover:border-white/30 transition-[border-color,background-color] duration-200 cursor-pointer'
              )}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}

'use client';

import { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import type { JobMarker } from '@/types';

interface JobAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobMarker[];
}

export function JobAlertModal({ isOpen, onClose, jobs }: JobAlertModalProps) {
  const [email, setEmail] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [keywords, setKeywords] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [companySearchText, setCompanySearchText] = useState('');
  const [locationSearchText, setLocationSearchText] = useState('');
  const [existingAlert, setExistingAlert] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showExistingAlert, setShowExistingAlert] = useState(false);

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
    if (!companySearchText) return companies.slice(0, 10); // Show only first 10 by default
    return companies.filter(company =>
      company.toLowerCase().includes(companySearchText.toLowerCase())
    );
  }, [companies, companySearchText]);

  const filteredLocations = useMemo(() => {
    if (!locationSearchText) return locations.slice(0, 10); // Show only first 10 by default
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

  const handleEditExisting = () => {
    if (existingAlert) {
      // Populate form with existing data
      setSelectedCompanies(new Set(existingAlert.companies));
      setSelectedLocations(new Set(existingAlert.locations));
      setKeywords(existingAlert.keywords.join(', '));
      setFrequency(existingAlert.frequency);
      setIsEditMode(true);
      setShowExistingAlert(false);
    }
  };

  const handleDelete = async () => {
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/alerts/subscribe?email=${encodeURIComponent(email.trim())}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete alert');
      }

      setSuccess(true);

      setTimeout(() => {
        setEmail('');
        setSelectedCompanies(new Set());
        setSelectedLocations(new Set());
        setKeywords('');
        setFrequency('daily');
        setSuccess(false);
        setExistingAlert(null);
        setIsEditMode(false);
        setShowExistingAlert(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const alertData = {
        email: email.trim(),
        companies: Array.from(selectedCompanies),
        locations: Array.from(selectedLocations),
        keywords: keywords.trim().split(',').map(k => k.trim()).filter(k => k),
        frequency,
      };

      const response = await fetch('/api/alerts/subscribe', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // If alert already exists, show the existing alert options
        if (response.status === 409 && errorData.existingAlert) {
          setExistingAlert(errorData.existingAlert);
          setShowExistingAlert(true);
          setIsSubmitting(false);
          return;
        }

        throw new Error(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} alert`);
      }

      setSuccess(true);

      // Reset form after 2 seconds
      setTimeout(() => {
        setEmail('');
        setSelectedCompanies(new Set());
        setSelectedLocations(new Set());
        setKeywords('');
        setFrequency('daily');
        setSuccess(false);
        setExistingAlert(null);
        setIsEditMode(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} alert`);
    } finally {
      setIsSubmitting(false);
    }
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

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setError(null);
    } else {
      // Reset all state when modal closes
      setEmail('');
      setSelectedCompanies(new Set());
      setSelectedLocations(new Set());
      setKeywords('');
      setFrequency('daily');
      setExistingAlert(null);
      setIsEditMode(false);
      setShowExistingAlert(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className={clsx(
          'bg-black/95 border border-white/10 rounded-2xl',
          'w-[90vw] max-w-[580px] max-h-[90vh]',
          'text-white font-[system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif]',
          'flex flex-col',
          'shadow-[0_20px_60px_rgba(0,0,0,0.8)]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/8">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-[16px] font-semibold m-0 tracking-[-0.02em]">
                {isEditMode ? 'Edit Job Alert' : 'Create Job Alert'}
              </h2>
              {isEditMode && (
                <span className="text-[11px] text-blue-400 mt-1 block">
                  Modifying existing alert
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className={clsx(
                'bg-white/8 border border-white/12 rounded-lg',
                'w-7 h-7 flex items-center justify-center',
                'cursor-pointer text-white/60 text-lg leading-none',
                'transition-all duration-150',
                'hover:bg-white/12 hover:text-white/90 hover:border-white/20'
              )}
            >
              ×
            </button>
          </div>
          <p className="text-[12px] text-white/50 m-0">
            Get notified when new jobs match your criteria •{' '}
            <a
              href="https://cloud.stapply.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-500/60 transition-colors underline decoration-blue-500/20 hover:decoration-blue-500/40"
            >
              Try Stapply
            </a>
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mx-6 mt-4 p-3.5 bg-green-500/15 border border-green-500/20 rounded-xl text-[13px] text-green-300 flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Alert {isEditMode ? 'updated' : 'created'} successfully!
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-red-500/15 border border-red-500/20 rounded-xl text-[13px] text-red-300 flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Existing Alert Message */}
        {showExistingAlert && existingAlert && (
          <div className="mt-2 flex items-center justify-between px-6 mb-2">
            <span className="text-[13px] text-white/50">Alert exists for this email.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEditExisting}
                className="text-blue-300 text-[12px] hover:underline px-2 py-1"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="text-red-300 text-[12px] hover:underline px-2 py-1"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">
          {/* Email Input */}
          <div className="mb-6">
            <label className="block text-[12px] font-medium text-white/60 mb-2.5">
              Email Address *
            </label>
            <input
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={clsx(
                'w-full px-4 py-3',
                'bg-white/5 border border-white/10 rounded-xl',
                'text-white text-[14px] outline-none',
                'placeholder:text-white/30',
                'transition-all duration-200',
                'focus:border-blue-500/40 focus:bg-white/8'
              )}
              disabled={isSubmitting}
            />
          </div>

          {/* Frequency Selection */}
          <div className="mb-6">
            <label className="block text-[12px] font-medium text-white/60 mb-2.5">
              Notification Frequency
            </label>
            <div className="flex gap-2">
              {(['daily', 'weekly'] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequency(freq)}
                  disabled={isSubmitting}
                  className={clsx(
                    'no-underline flex-1',
                    'px-[10px] py-1 rounded-full',
                    'text-[11px] inline-flex items-center justify-center gap-1.5',
                    'transition-[border-color,background-color,color] duration-200 ease-in-out',
                    'cursor-pointer',
                    frequency === freq
                      ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600 hover:border-blue-600'
                      : 'bg-white/8 border border-white/12 text-white hover:bg-white/12 hover:border-white/20'
                  )}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div className="mb-6">
            <label className="block text-[12px] font-medium text-white/60 mb-2.5">
              Keywords (optional)
            </label>
            <input
              type="text"
              placeholder="e.g., engineer, senior, machine learning"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className={clsx(
                'w-full px-4 py-3',
                'bg-white/5 border border-white/10 rounded-xl',
                'text-white text-[14px] outline-none',
                'placeholder:text-white/30',
                'transition-all duration-200',
                'focus:border-blue-500/40 focus:bg-white/8'
              )}
              disabled={isSubmitting}
            />
            <p className="text-[11px] text-white/40 mt-1.5 ml-0.5">Separate multiple keywords with commas</p>
          </div>

          <div className="space-y-6">
            {/* Companies */}
            <div>
              <label className="text-[12px] font-medium text-white/60 mb-2.5 block">
                Companies {selectedCompanies.size > 0 && (
                  <span className="text-blue-400">({selectedCompanies.size} selected)</span>
                )}
              </label>

              <input
                type="text"
                placeholder="Search companies..."
                value={companySearchText}
                onChange={(e) => setCompanySearchText(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2 mb-2.5',
                  'bg-white/5 border border-white/10 rounded-lg',
                  'text-white text-[13px] outline-none',
                  'placeholder:text-white/30',
                  'transition-all duration-200',
                  'focus:border-blue-500/40 focus:bg-white/8'
                )}
                disabled={isSubmitting}
              />

              <div className={clsx(
                'border border-white/8 rounded-xl',
                'bg-white/[0.03] max-h-[180px] overflow-y-auto',
                'custom-scrollbar'
              )}>
                {filteredCompanies.length === 0 ? (
                  <div className="p-4 text-center text-white/40 text-[12px]">
                    No companies found
                  </div>
                ) : (
                  filteredCompanies.map((company) => (
                    <label
                      key={company}
                      className={clsx(
                        'flex items-center gap-3 px-3.5 py-2.5',
                        'cursor-pointer transition-all duration-150',
                        'hover:bg-white/8',
                        'border-b border-white/[0.04] last:border-b-0'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompanies.has(company)}
                        onChange={() => handleCompanyToggle(company)}
                        disabled={isSubmitting}
                        className={clsx(
                          'w-4 h-4 rounded',
                          'bg-white/10 border border-white/20',
                          'checked:bg-blue-500 checked:border-blue-500',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                          'cursor-pointer transition-all'
                        )}
                      />
                      <span className="text-[13px] text-white/80 flex-1">{company}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Locations */}
            <div>
              <label className="text-[12px] font-medium text-white/60 mb-2.5 block">
                Locations {selectedLocations.size > 0 && (
                  <span className="text-blue-400">({selectedLocations.size} selected)</span>
                )}
              </label>

              <input
                type="text"
                placeholder="Search locations..."
                value={locationSearchText}
                onChange={(e) => setLocationSearchText(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2 mb-2.5',
                  'bg-white/5 border border-white/10 rounded-lg',
                  'text-white text-[13px] outline-none',
                  'placeholder:text-white/30',
                  'transition-all duration-200',
                  'focus:border-blue-500/40 focus:bg-white/8'
                )}
                disabled={isSubmitting}
              />

              <div className={clsx(
                'border border-white/8 rounded-xl',
                'bg-white/[0.03] max-h-[180px] overflow-y-auto',
                'custom-scrollbar'
              )}>
                {filteredLocations.length === 0 ? (
                  <div className="p-4 text-center text-white/40 text-[12px]">
                    No locations found
                  </div>
                ) : (
                  filteredLocations.map((location) => (
                    <label
                      key={location}
                      className={clsx(
                        'flex items-center gap-3 px-3.5 py-2.5',
                        'cursor-pointer transition-all duration-150',
                        'hover:bg-white/8',
                        'border-b border-white/[0.04] last:border-b-0'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLocations.has(location)}
                        onChange={() => handleLocationToggle(location)}
                        disabled={isSubmitting}
                        className={clsx(
                          'w-4 h-4 rounded',
                          'bg-white/10 border border-white/20',
                          'checked:bg-blue-500 checked:border-blue-500',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                          'cursor-pointer transition-all'
                        )}
                      />
                      <span className="text-[13px] text-white/80 flex-1">{location}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 bg-black/30">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-white/40 m-0">
              Leave filters empty for all jobs
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className={clsx(
                  'text-white no-underline',
                  'bg-white/8 px-[10px] py-1 rounded-full',
                  'border border-white/12',
                  'text-[11px] inline-flex items-center justify-center gap-1.5',
                  'transition-[border-color,background-color] duration-200 ease-in-out',
                  'hover:bg-white/12 hover:border-white/20',
                  'cursor-pointer',
                  isSubmitting && 'opacity-50 cursor-not-allowed'
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={clsx(
                  'text-white no-underline',
                  'bg-blue-500/20 px-[10px] py-1 rounded-full',
                  'border border-blue-500/30',
                  'text-[11px] inline-flex items-center justify-center gap-1.5',
                  'transition-[border-color,background-color] duration-200 ease-in-out',
                  'hover:bg-blue-500/30 hover:border-blue-500/40',
                  'cursor-pointer',
                  isSubmitting && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Update Alert' : 'Create Alert'
                )}
              </button>
            </div>
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

import { useEffect, useState, useRef, useCallback } from 'react';
import { JobMap } from './components/JobMap';
import { LoadingScreen } from './components/LoadingScreen';
import { ChatInterface } from './components/ChatInterface';
import { FilterDialog, type FilterState } from './components/FilterDialog';
import { JobListSidebar } from './components/JobListSidebar';
import { loadJobsWithCoordinates, getLocationStats } from './utils/dataProcessor';
import type { JobMarker } from './types';
import { MAPBOX_TOKEN } from './config';
import { AIService } from './services/aiService';
import type { MapControlCallbacks, ViewState } from './utils/mapControl';
import { Analytics } from '@vercel/analytics/react';

function App() {
  const [jobMarkers, setJobMarkers] = useState<JobMarker[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalJobsCount, setTotalJobsCount] = useState(0);
  const [filteredJobs, setFilteredJobs] = useState<JobMarker[] | null>(null);
  const [viewState, setViewState] = useState<ViewState | null>(null);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isJobListOpen, setIsJobListOpen] = useState(false);
  const aiServiceRef = useRef<AIService>(new AIService());
  const mapControlCallbacksRef = useRef<MapControlCallbacks | null>(null);

  const handleMapControlReady = useCallback((callbacks: MapControlCallbacks) => {
    mapControlCallbacksRef.current = callbacks;

    // Initialize AI service if we have jobs
    if (jobMarkers.length > 0) {
      aiServiceRef.current.initialize(
        jobMarkers,
        {
          ...callbacks,
          setFilteredJobs: (jobs) => {
            setFilteredJobs(jobs);
            callbacks.setFilteredJobs(jobs);
          },
        },
        viewState || undefined
      );
    }
  }, [jobMarkers, viewState]);

  const handleViewStateChange = useCallback((newViewState: ViewState) => {
    setViewState(newViewState);
    // Update AI service with new view state
    if (mapControlCallbacksRef.current && jobMarkers.length > 0) {
      aiServiceRef.current.updateViewState(newViewState);
    }
  }, [jobMarkers.length]);

  // Update AI service when jobs change
  useEffect(() => {
    if (jobMarkers.length > 0 && mapControlCallbacksRef.current) {
      aiServiceRef.current.updateJobs(jobMarkers);
    }
  }, [jobMarkers]);

  const handleApplyFilters = useCallback((filters: FilterState) => {
    let filtered = jobMarkers;

    // Filter by companies
    if (filters.companies.length > 0) {
      filtered = filtered.filter(job => filters.companies.includes(job.company));
    }

    // Filter by locations
    if (filters.locations.length > 0) {
      filtered = filtered.filter(job => filters.locations.includes(job.location));
    }

    // Filter by search text
    if (filters.searchText.trim()) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(job =>
        job.title.toLowerCase().includes(searchLower) ||
        job.company.toLowerCase().includes(searchLower) ||
        job.location.toLowerCase().includes(searchLower)
      );
    }

    setFilteredJobs(filtered.length < jobMarkers.length ? filtered : null);
  }, [jobMarkers]);

  const toggleJobList = useCallback(() => {
    setIsJobListOpen((prev) => !prev);
  }, []);

  const handleJobClick = useCallback((job: JobMarker) => {
    if (mapControlCallbacksRef.current) {
      // Fly to the job location and zoom in
      mapControlCallbacksRef.current.flyTo(job.lng, job.lat, 12);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        // Load CSV with coordinates    
        const jobs = await loadJobsWithCoordinates('/jobs_minimal.csv');
        console.log(`Loaded ${jobs.length} jobs with coordinates`);

        if (jobs.length === 0) {
          throw new Error('No jobs found in CSV file');
        }

        setTotalJobsCount(jobs.length);
        setJobMarkers(jobs);

        // Get stats
        const stats = getLocationStats(jobs);
        console.log('Location stats:', stats);

        setInitialLoading(false);

        // Initialize AI service once we have jobs
        if (mapControlCallbacksRef.current) {
          aiServiceRef.current.initialize(
            jobs,
            mapControlCallbacksRef.current,
            viewState || undefined
          );
        }
      } catch (err) {
        console.error('Error loading job data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load job data');
        setInitialLoading(false);
      }
    }

    loadData();
  }, []);

  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-black text-red-500 p-5 text-center">
        <h1 className="text-2xl mb-4">Error Loading Data</h1>
        <p className="text-base text-slate-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-3 bg-blue-500 text-white border-none rounded-md cursor-pointer text-base hover:bg-blue-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (initialLoading) {
    return <LoadingScreen />;
  }

  // Show chat interface (API key is checked server-side)
  // The chat will show an error if the API key isn't configured
  const showChat = true;

  return (
    <>
      <Analytics />
      <JobMap
        jobs={jobMarkers}
        mapboxToken={MAPBOX_TOKEN}
        totalJobs={totalJobsCount}
        onMapControlReady={handleMapControlReady}
        filteredJobs={filteredJobs}
        onViewStateChange={handleViewStateChange}
        onOpenFilters={() => setIsFilterDialogOpen(true)}
        onOpenJobList={toggleJobList}
      />
      {showChat && (
        <ChatInterface
          aiService={aiServiceRef.current}
          hideButton={isJobListOpen}
        />
      )}
      <FilterDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        jobs={jobMarkers}
        onApplyFilters={handleApplyFilters}
      />
      <JobListSidebar
        jobs={jobMarkers}
        isOpen={isJobListOpen}
        onClose={() => setIsJobListOpen(false)}
        onJobClick={handleJobClick}
        filteredJobs={filteredJobs}
      />
    </>
  );
}

export default App;

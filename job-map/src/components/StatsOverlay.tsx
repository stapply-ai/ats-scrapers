import { useEffect, useState, useRef } from 'react';
import clsx from 'clsx';

interface StatsOverlayProps {
  totalJobs: number;
  displayedJobs: number;
  totalLocations: number;
  popupOpen?: boolean;
  onOpenFilters?: () => void;
  onOpenJobList?: () => void;
  hasActiveFilters?: boolean;
}

export function StatsOverlay({ totalJobs, displayedJobs, totalLocations, popupOpen = false, onOpenFilters, onOpenJobList, hasActiveFilters = false }: StatsOverlayProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Dragging logic
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  // Hide on mobile when popup is open to prevent overlap
  const shouldHide = isMobile && popupOpen;

  return (
    <div
      ref={overlayRef}
      style={{
        left: isMobile ? undefined : `${position.x}px`,
        top: isMobile ? undefined : `${position.y}px`,
      }}
      className={clsx(
        'stats-overlay',
        'absolute z-1',
        'bg-black/50 backdrop-blur-2xl',
        'border border-white/10 rounded-2xl',
        'text-white font-[system-ui,-apple-system,BlinkMacSystemFont,"Inter",sans-serif]',
        'transition-opacity duration-200 ease-in-out',
        'px-5 py-4 min-w-[200px]',
        'shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
        'max-md:top-3 max-md:left-3 max-md:px-4 max-md:py-3 max-md:min-w-[160px]',
        {
          'opacity-0 pointer-events-none': shouldHide,
          'opacity-100 pointer-events-auto': !shouldHide,
          'cursor-move': !isMobile,
          'select-none': isDragging,
        }
      )}
      onMouseDown={!isMobile ? handleMouseDown : undefined}
    >
      <div className="flex flex-col gap-3 text-[13px] tracking-[0.01em]">
        <div className="stats-number text-[32px] md:text-[32px] max-md:text-2xl font-light text-white leading-none tabular-nums">
          {displayedJobs.toLocaleString()}
        </div>

        <div className="flex gap-4 text-xs text-white/60">
          <div>
            <div className="tabular-nums">
              {totalLocations.toLocaleString()}
            </div>
            <div className="text-[10px] text-white/40">
              locations
            </div>
          </div>
          <div className="w-px bg-white/10" />
          <div>
            <div className="tabular-nums">
              {totalJobs.toLocaleString()}
            </div>
            <div className="text-[10px] text-white/40">
              total
            </div>
          </div>
        </div>
      </div>
      {/* Action Buttons */}
      {(onOpenFilters || onOpenJobList) && (
        <div className="mt-3 pt-3 border-t border-white/8 flex gap-2">
          {onOpenFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFilters();
              }}
              className={clsx(
                'text-white no-underline flex-1',
                'bg-white/8 px-[10px] py-1 rounded-full',
                'border border-white/12',
                'text-[11px] inline-flex items-center justify-center gap-1.5',
                'transition-[border-color,background-color] duration-200 ease-in-out',
                'hover:bg-white/12 hover:border-white/20',
                'cursor-pointer relative'
              )}
            >
              Filter
              {hasActiveFilters && (
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}
            </button>
          )}
          {onOpenJobList && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenJobList();
              }}
              className={clsx(
                'text-white no-underline flex-1',
                'bg-white/8 px-[10px] py-1 rounded-full',
                'border border-white/12',
                'text-[11px] inline-flex items-center justify-center gap-1.5',
                'transition-[border-color,background-color] duration-200 ease-in-out',
                'hover:bg-white/12 hover:border-white/20',
                'cursor-pointer'
              )}
            >
              All Jobs
            </button>
          )}
        </div>
      )}

      <div
        className={clsx(
          'contribution-inline',
          'mt-3 pt-3 border-t border-white/8',
          'text-[11px] text-white/65'
        )}
      >
        <a
          href="https://github.com/stapply-ai/jobs"
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            'text-white no-underline',
            'bg-white/8 px-[10px] py-1 rounded-full',
            'border border-white/12',
            'text-[11px] inline-flex items-center justify-center gap-1.5 w-full',
            'transition-[border-color,background-color] duration-200 ease-in-out',
            'hover:bg-white/12 hover:border-white/20'
          )}
        >
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
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Star the repo
        </a>
      </div>
    </div>
  );
}

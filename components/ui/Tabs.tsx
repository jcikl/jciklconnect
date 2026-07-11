import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type TabItem = string | { id: string; label: string };

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
  variant?: 'underline' | 'button';
  fullWidth?: boolean;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange, className = '', variant = 'underline', fullWidth = false }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 2);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener('resize', checkScroll);
    return () => {
      window.removeEventListener('resize', checkScroll);
      clearTimeout(timer);
    };
  }, [tabs]);

  const scrollLeft = () => scrollContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  const scrollRight = () => scrollContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' });

  if (variant === 'button') {
    return (
      <div className={`relative ${fullWidth ? 'flex-1 min-w-0' : ''} ${className}`}>
        {showLeftArrow && (
          <button onClick={scrollLeft} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm p-1 shadow-md rounded-full text-slate-600 hover:text-jci-blue transition-colors border border-slate-100" aria-label="Scroll left">
            <ChevronLeft size={16} />
          </button>
        )}
        <div ref={fullWidth ? undefined : scrollContainerRef} onScroll={fullWidth ? undefined : checkScroll} className={fullWidth ? 'py-1' : 'overflow-x-auto no-scrollbar scroll-smooth py-1'}>
          <nav className={`flex space-x-1.5 p-1 bg-slate-100 border border-slate-200/50 rounded-xl ${fullWidth ? 'w-full' : 'w-max'}`} aria-label="Tabs">
            {tabs.map((tab) => {
              const id = typeof tab === 'string' ? tab : tab.id;
              const label = typeof tab === 'string' ? tab : tab.label;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={(e) => { e.preventDefault(); onTabChange(id); }}
                  className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all ${fullWidth ? 'flex-1' : 'flex-shrink-0'} ${activeTab === id ? 'bg-jci-blue text-white shadow-sm border border-slate-200/20' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'}`}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
        {showRightArrow && (
          <button onClick={scrollRight} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm p-1 shadow-md rounded-full text-slate-600 hover:text-jci-blue transition-colors border border-slate-100" aria-label="Scroll right">
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative border-b border-slate-200 ${className}`}>
      {showLeftArrow && (
        <button onClick={scrollLeft} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm p-1 shadow-md rounded-full text-slate-600 hover:text-jci-blue transition-colors border border-slate-100" aria-label="Scroll left">
          <ChevronLeft size={16} />
        </button>
      )}
      <div ref={scrollContainerRef} onScroll={checkScroll} className="overflow-x-auto no-scrollbar scroll-smooth">
        <nav className="-mb-1px flex space-x-4 px-2" aria-label="Tabs">
          {tabs.map((tab) => {
            const id = typeof tab === 'string' ? tab : tab.id;
            const label = typeof tab === 'string' ? tab : tab.label;
            return (
              <button
                key={id}
                type="button"
                onClick={(e) => { e.preventDefault(); onTabChange(id); }}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex-shrink-0 ${activeTab === id ? 'border-jci-blue text-jci-blue' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>
      {showRightArrow && (
        <button onClick={scrollRight} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 backdrop-blur-sm p-1 shadow-md rounded-full text-slate-600 hover:text-jci-blue transition-colors border border-slate-100" aria-label="Scroll right">
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
};

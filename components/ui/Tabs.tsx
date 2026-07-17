import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type TabItem = string | { id: string; label: string; icon?: React.ReactNode; badge?: React.ReactNode; shortLabel?: string; };

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
  fullWidth?: boolean;
  mobileFallback?: 'scroll' | 'select';
}

function normalizeTab(tab: TabItem): { id: string; label: string; icon?: React.ReactNode; badge?: React.ReactNode; shortLabel?: string } {
  if (typeof tab === 'string') return { id: tab, label: tab };
  return tab;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  fullWidth = false,
  mobileFallback = 'scroll',
}) => {
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

  const normalized = tabs.map(normalizeTab);

  const mobileSelect = mobileFallback === 'select' ? (
    <div className="md:hidden mb-3 relative">
      <select
        value={activeTab}
        onChange={e => onTabChange(e.target.value)}
        aria-label="Navigate sections"
        className="w-full text-sm font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-jci-blue outline-none appearance-none cursor-pointer text-slate-800"
      >
        {normalized.map(t => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
    </div>
  ) : null;

  return (
    <div className={`relative ${fullWidth ? 'flex-1 min-w-0' : ''} ${className}`}>
      {mobileSelect}
      {showLeftArrow && (
        <button onClick={scrollLeft} className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm p-1 shadow-md rounded-full text-slate-600 hover:text-jci-blue transition-colors border border-slate-100 ${mobileFallback === 'select' ? 'hidden md:flex' : ''}`} aria-label="Scroll left">
          <ChevronLeft size={16} />
        </button>
      )}
      <div
        ref={fullWidth ? undefined : scrollContainerRef}
        onScroll={fullWidth ? undefined : checkScroll}
        className={`${mobileFallback === 'select' ? 'hidden md:block' : ''} ${fullWidth ? 'py-1' : 'overflow-x-auto no-scrollbar scroll-smooth py-1'}`}
      >
        <nav role="tablist" className={`flex space-x-1.5 p-1 bg-slate-100 border border-slate-200/50 rounded-xl ${fullWidth ? 'w-full' : 'w-max'}`} aria-label="Tabs">
          {normalized.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={(e) => { e.preventDefault(); onTabChange(tab.id); }}
              className={`whitespace-nowrap px-4 py-2 rounded-lg font-bold text-xs md:text-sm transition-all flex items-center gap-2 ${fullWidth ? 'flex-1 justify-center' : 'flex-shrink-0'} ${activeTab === tab.id ? 'bg-jci-blue text-white shadow-sm border border-slate-200/20' : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'}`}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              {tab.label}
              {tab.badge && <span className="ml-1">{tab.badge}</span>}
            </button>
          ))}
        </nav>
      </div>
      {showRightArrow && (
        <button onClick={scrollRight} className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm p-1 shadow-md rounded-full text-slate-600 hover:text-jci-blue transition-colors border border-slate-100 ${mobileFallback === 'select' ? 'hidden md:flex' : ''}`} aria-label="Scroll right">
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
};

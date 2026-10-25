import React from 'react';
import { Gift, Globe } from 'lucide-react';
import { FACET_SECTIONS, type FacetSection } from './directoryFacets';
import type { DirectoryFiltersState } from './useDirectoryFilters';

const SECTION_LABELS: Record<FacetSection, string> = {
  countries: 'Country',
  chapters: 'JCI Chapter',
  industries: 'Industry',
  categories: 'Business Categories',
  idealReferrals: 'Ideal Referral Type',
};

type PanelState = Pick<DirectoryFiltersState, 'filters' | 'facets' | 'toggleValue' | 'toggleFlag' | 'clearSection'>;

interface DirectoryFilterPanelProps extends PanelState {
  /** 'sidebar' (desktop, long lists scroll) or 'drawer' (mobile). Same sections and order either way. */
  variant: 'sidebar' | 'drawer';
}

const labelCls = 'text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500';

const Chip: React.FC<{ label: React.ReactNode; count: number; active: boolean; onClick: () => void }> = ({ label, count, active, onClick }) => {
  // An option with 0 results is disabled unless it is selected (so it can still be cleared).
  const disabled = count === 0 && !active;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex max-w-full items-center gap-1.5 rounded-xl border px-3 py-1.5 text-left text-xs font-bold transition-colors ${
        active
          ? 'border-jci-blue bg-jci-blue text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500'
      } ${disabled ? 'cursor-not-allowed opacity-40 hover:border-slate-200 dark:hover:border-slate-700' : ''}`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
        {count}
      </span>
    </button>
  );
};

/** The one filter panel of the business directory (desktop sidebar and mobile drawer). */
export const DirectoryFilterPanel: React.FC<DirectoryFilterPanelProps> = ({ variant, filters, facets, toggleValue, toggleFlag, clearSection }) => {
  const listCls = variant === 'sidebar' ? 'flex max-h-56 flex-wrap gap-2 overflow-y-auto' : 'flex flex-wrap gap-2';
  return (
    <div className="space-y-6">
      <div>
        <p className={`${labelCls} mb-3`}>Quick Filters</p>
        <div className="flex flex-wrap gap-2">
          <Chip label={<span className="flex items-center gap-1.5"><Gift size={13} /> Has Deal</span>} count={facets.hasDeal} active={filters.hasDeal} onClick={() => toggleFlag('hasDeal')} />
          <Chip label={<span className="flex items-center gap-1.5"><Globe size={13} /> Accepts International Business</span>} count={facets.acceptsIntl} active={filters.acceptsIntl} onClick={() => toggleFlag('acceptsIntl')} />
        </div>
      </div>

      {FACET_SECTIONS.map(section => {
        const options = facets[section];
        if (options.length === 0) return null;
        return (
          <div key={section}>
            <div className="mb-3 flex items-center justify-between">
              <p className={labelCls}>{SECTION_LABELS[section]}</p>
              {filters[section].length > 0 && (
                <button type="button" onClick={() => clearSection(section)} className="text-[10px] font-bold text-jci-blue hover:underline">Clear</button>
              )}
            </div>
            <div className={listCls}>
              {options.map(o => (
                <Chip key={o.value} label={o.value} count={o.count} active={filters[section].includes(o.value)} onClick={() => toggleValue(section, o.value)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

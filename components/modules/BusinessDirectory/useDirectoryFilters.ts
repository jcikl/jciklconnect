import { useCallback, useMemo, useState } from 'react';
import {
  EMPTY_DIRECTORY_FILTERS, computeDirectoryFacets, countActiveDirectoryFilters, filterDirectoryItems, toggleFacetValue,
  type DirectoryFilters, type DirectoryItem, type FacetFlag, type FacetSection,
} from './directoryFacets';

/** Filter state for the unified directory panel; the rules live in directoryFacets.ts. */
export function useDirectoryFilters(items: DirectoryItem[], search: string) {
  const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_DIRECTORY_FILTERS);

  const filtered = useMemo(() => filterDirectoryItems(items, filters, search), [items, filters, search]);
  const facets = useMemo(() => computeDirectoryFacets(items, filters, search), [items, filters, search]);

  const toggleValue = useCallback((section: FacetSection, value: string) => setFilters(f => toggleFacetValue(f, section, value)), []);
  const toggleFlag = useCallback((flag: FacetFlag) => setFilters(f => ({ ...f, [flag]: !f[flag] })), []);
  const clearSection = useCallback((section: FacetSection) => setFilters(f => ({ ...f, [section]: [] })), []);
  const reset = useCallback(() => setFilters(EMPTY_DIRECTORY_FILTERS), []);

  return {
    filters,
    filtered,
    facets,
    activeCount: countActiveDirectoryFilters(filters),
    toggleValue,
    toggleFlag,
    clearSection,
    reset,
  };
}

export type DirectoryFiltersState = ReturnType<typeof useDirectoryFilters>;

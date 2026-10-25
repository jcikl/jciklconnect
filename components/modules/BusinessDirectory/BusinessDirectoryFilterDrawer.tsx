import React from 'react';
import { FilterDrawer } from '../../ui/Common';
import { DirectoryFilterPanel } from './DirectoryFilterPanel';
import type { DirectoryFiltersState } from './useDirectoryFilters';

interface BusinessDirectoryFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Filter state from useDirectoryFilters (the same panel the desktop sidebar shows). */
  state: DirectoryFiltersState;
}

/** Mobile drawer around the unified directory filter panel. */
export const BusinessDirectoryFilterDrawer: React.FC<BusinessDirectoryFilterDrawerProps> = ({ isOpen, onClose, state }) => {
  const resultCount = state.filtered.length;
  return (
    <FilterDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Directory"
      applyLabel={`Show ${resultCount} ${resultCount === 1 ? 'Result' : 'Results'}`}
      showReset={state.activeCount > 0}
      resetLabel={`Reset all ${state.activeCount} filter${state.activeCount > 1 ? 's' : ''}`}
      onReset={state.reset}
    >
      <DirectoryFilterPanel
        variant="drawer"
        filters={state.filters}
        facets={state.facets}
        toggleValue={state.toggleValue}
        toggleFlag={state.toggleFlag}
        clearSection={state.clearSection}
      />
    </FilterDrawer>
  );
};

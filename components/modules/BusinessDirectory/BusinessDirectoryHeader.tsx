import React from 'react';
import { Tabs } from '../../ui/Common';

export type BusinessDirectoryTab = 'local' | 'international';

interface BusinessDirectoryHeaderProps {
  activeTab: BusinessDirectoryTab;
  onTabChange: (tab: BusinessDirectoryTab) => void;
}

export const BusinessDirectoryHeader: React.FC<BusinessDirectoryHeaderProps> = ({
  activeTab,
  onTabChange,
}) => (
  <>
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Member Business Directory</h2>
        <p className="text-slate-500">Support local member businesses and global JCI network connections.</p>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="flex-shrink-0">
        <Tabs
          tabs={[{ id: 'local', label: 'Local Businesses' }, { id: 'international', label: 'International Network' }]}
          activeTab={activeTab}
          onTabChange={(tab) => onTabChange(tab as BusinessDirectoryTab)}
          mobileFallback="pill"
          className="border-none"
        />
      </div>

      <div className="flex items-center gap-3 justify-end" />
    </div>
  </>
);

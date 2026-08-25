import React from 'react';
import { Tabs } from '../../ui/Common';
import { Select } from '../../ui/Form';
import type { PaymentRequestStatus } from '../../../types';

interface PaymentRequestTabsBarProps {
  activeTab: 'my' | 'all';
  canSeeAllTab: boolean;
  statusFilter: PaymentRequestStatus | '';
  onTabChange: (tab: 'my' | 'all') => void;
  onStatusFilterChange: (status: PaymentRequestStatus | '') => void;
}

export const PaymentRequestTabsBar: React.FC<PaymentRequestTabsBarProps> = ({
  activeTab,
  canSeeAllTab,
  statusFilter,
  onTabChange,
  onStatusFilterChange,
}) => (
  <div className="flex items-center justify-between gap-2 pb-2">
    <div className="md:hidden flex items-center gap-2 w-full p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
      <Tabs
        fullWidth
        tabs={[
          { id: 'my', label: 'My Requests' },
          ...(canSeeAllTab ? [{ id: 'all', label: 'All' }] : []),
        ]}
        activeTab={activeTab}
        onTabChange={(id) => onTabChange(id as 'my' | 'all')}
      />
      <div className="w-28 shrink-0">
        <Select
          label=""
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as PaymentRequestStatus | '')}
          options={[
            { value: '', label: 'All' },
            { value: 'submitted', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </div>
    </div>

    <div className="hidden md:block">
      <Tabs
        tabs={[
          { id: 'my', label: 'My Applications' },
          ...(canSeeAllTab ? [{ id: 'all', label: 'All Applications' }] : []),
        ]}
        activeTab={activeTab}
        onTabChange={(id) => onTabChange(id as 'my' | 'all')}
      />
    </div>
    {activeTab === 'all' && (
      <div className="hidden md:block w-36">
        <Select
          label=""
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as PaymentRequestStatus | '')}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'submitted', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>
    )}
  </div>
);

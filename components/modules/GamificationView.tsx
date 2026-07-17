import React, { useState } from 'react';
import { Tabs } from '../ui/Common';
import { LOStarDashboard } from './LOStarDashboard';
import { IncentiveProgramManager } from './IncentiveProgramManager';
import { BehavioralNudgingConfig } from './BehavioralNudgingConfig';
import { AwardsView } from './AwardsView';
import { usePermissions } from '../../hooks/usePermissions';

export const GamificationView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [activeTab, setActiveTab] = useState('lo_star');
  const { isAdmin, isBoard, hasPermission } = usePermissions();

  const canManagePoints = isAdmin || isBoard || (hasPermission && hasPermission('canManageSettings'));

  const availableTabs = [
    { id: 'lo_star', label: 'LO Star Rating' },
  ];

  if (canManagePoints) {
    availableTabs.push({ id: 'awards', label: 'Awards' });
    availableTabs.push({ id: 'rules', label: 'Program Config' });
    availableTabs.push({ id: 'nudging', label: 'Behavioral Nudging' });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Tabs
        tabs={availableTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'rules' ? (
        <IncentiveProgramManager />
      ) : activeTab === 'awards' ? (
        <AwardsView searchQuery={searchQuery} />
      ) : activeTab === 'nudging' ? (
        <BehavioralNudgingConfig />
      ) : (
        <LOStarDashboard />
      )}
    </div>
  );
};

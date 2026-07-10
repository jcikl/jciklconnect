import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Tabs } from '../ui/Common';
import { MembershipConfigView } from './MembershipConfigView';
import { AccessConfigView } from './AccessConfigView';

type ConfigTab = 'membership' | 'access';

export const SystemConfigView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('membership');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SlidersHorizontal size={24} className="text-jci-blue" />
          Config
        </h2>
        <p className="text-sm text-slate-500">Membership rules and access permissions.</p>
      </div>

      <Tabs
        tabs={[
          { id: 'membership', label: 'Membership' },
          { id: 'access', label: 'Access' },
        ]}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as ConfigTab)}
      />

      <div className="mt-2">
        {activeTab === 'membership' && <MembershipConfigView />}
        {activeTab === 'access' && <AccessConfigView />}
      </div>
    </div>
  );
};

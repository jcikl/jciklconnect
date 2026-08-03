import React, { useState } from 'react';
import { CreditCard, MessageSquare, Activity, Wrench, Users, ShieldCheck, Network, MapPin } from 'lucide-react';
import { PageHeader, Tabs } from '../ui/Common';
import { MembershipConfigView } from './MembershipConfigView';
import { AccessConfigView } from './AccessConfigView';
import { ToyyibView } from './ToyyibView';
import { WhapiConfigView } from './WhapiConfigView';
import { SystemLogsView } from './SystemLogsView';
import { DbMaintenanceView } from './DbMaintenanceView';
import { SisterChaptersConfig } from './SisterChaptersConfig';
import { PostcodeConfigView } from './config/PostcodeConfigView';
import { usePermissions } from '../../hooks/usePermissions';
import { UserRole } from '../../types';

type ConfigTab = 'membership' | 'access' | 'toyyib' | 'whapi' | 'systemlogs' | 'maintenance' | 'postcodes' | 'sisters';

const BASE_TABS: { id: ConfigTab; label: string; icon: React.ReactNode }[] = [
  { id: 'membership',  label: 'Membership',   icon: <Users size={14} /> },
  { id: 'access',      label: 'Access',        icon: <ShieldCheck size={14} /> },
  { id: 'toyyib',      label: 'ToyyibPay',     icon: <CreditCard size={14} /> },
  { id: 'whapi',       label: 'Whapi',         icon: <MessageSquare size={14} /> },
  { id: 'postcodes',   label: 'Postcodes',     icon: <MapPin size={14} /> },
  { id: 'systemlogs',  label: 'System Logs',   icon: <Activity size={14} /> },
  { id: 'maintenance', label: 'Maintenance',   icon: <Wrench size={14} /> },
];

const SUPER_ADMIN_TABS: { id: ConfigTab; label: string; icon: React.ReactNode }[] = [
  { id: 'sisters', label: 'Global Relations', icon: <Network size={14} /> },
];

interface Props {
  initialTab?: ConfigTab;
}

export const SystemConfigView: React.FC<Props> = ({ initialTab }) => {
  const { effectiveRole } = usePermissions();
  const isSuperAdmin = effectiveRole === UserRole.SUPER_ADMIN;

  const tabs = isSuperAdmin ? [...BASE_TABS, ...SUPER_ADMIN_TABS] : BASE_TABS;
  const [activeTab, setActiveTab] = useState<ConfigTab>(initialTab ?? 'membership');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Config"
        description="Membership rules, access permissions, integrations and system tools."
      />

      <Tabs
        tabs={tabs.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as ConfigTab)}
        mobileFallback="select"
      />

      <div className="mt-2">
        {activeTab === 'membership'  && <MembershipConfigView />}
        {activeTab === 'access'      && <AccessConfigView />}
        {activeTab === 'toyyib'      && <ToyyibView embedded />}
        {activeTab === 'whapi'       && <WhapiConfigView embedded />}
        {activeTab === 'postcodes'   && <PostcodeConfigView />}
        {activeTab === 'systemlogs'  && <SystemLogsView />}
        {activeTab === 'maintenance' && <DbMaintenanceView />}
        {activeTab === 'sisters'     && isSuperAdmin && <SisterChaptersConfig />}
      </div>
    </div>
  );
};

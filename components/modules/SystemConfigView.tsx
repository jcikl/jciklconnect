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
import { allowedConfigTabs, canEditChapterList, type ConfigTab } from '../../utils/configAccess';

const BASE_TABS: { id: ConfigTab; label: string; icon: React.ReactNode }[] = [
  { id: 'membership',  label: 'Membership',   icon: <Users size={14} /> },
  { id: 'access',      label: 'Access',        icon: <ShieldCheck size={14} /> },
  { id: 'toyyib',      label: 'ToyyibPay',     icon: <CreditCard size={14} /> },
  { id: 'whapi',       label: 'Whapi',         icon: <MessageSquare size={14} /> },
  { id: 'postcodes',   label: 'Postcodes',     icon: <MapPin size={14} /> },
  { id: 'systemlogs',  label: 'System Logs',   icon: <Activity size={14} /> },
  { id: 'maintenance', label: 'Maintenance',   icon: <Wrench size={14} /> },
];

const SISTERS_TAB: { id: ConfigTab; label: string; icon: React.ReactNode } =
  { id: 'sisters', label: 'Global Relations', icon: <Network size={14} /> };

interface Props {
  initialTab?: ConfigTab;
}

export const SystemConfigView: React.FC<Props> = ({ initialTab }) => {
  const { effectiveRole } = usePermissions();
  // SUPER_ADMIN: every tab. ADMIN: Global Relations only (utils/configAccess.ts).
  const allowed = allowedConfigTabs(effectiveRole);
  const tabs = [...BASE_TABS, SISTERS_TAB].filter(t => allowed === null || allowed.includes(t.id));
  const canOpen = (id: ConfigTab) => allowed === null || allowed.includes(id);
  const [activeTab, setActiveTab] = useState<ConfigTab>(() => {
    const wanted = initialTab ?? 'membership';
    return canOpen(wanted) ? wanted : (tabs[0]?.id ?? 'membership');
  });

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
        {activeTab === 'membership'  && canOpen('membership') && <MembershipConfigView />}
        {activeTab === 'access'      && canOpen('access') && <AccessConfigView />}
        {activeTab === 'toyyib'      && canOpen('toyyib') && <ToyyibView embedded />}
        {activeTab === 'whapi'       && canOpen('whapi') && <WhapiConfigView embedded />}
        {activeTab === 'postcodes'   && canOpen('postcodes') && <PostcodeConfigView />}
        {activeTab === 'systemlogs'  && canOpen('systemlogs') && <SystemLogsView />}
        {activeTab === 'maintenance' && canOpen('maintenance') && <DbMaintenanceView />}
        {activeTab === 'sisters'     && canOpen('sisters') && <SisterChaptersConfig canEditChapters={canEditChapterList(effectiveRole)} />}
      </div>
    </div>
  );
};

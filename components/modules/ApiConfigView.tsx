// Unified API settings — ToyyibPay + Whapi under one page
import React, { useState } from 'react';
import { CreditCard, MessageSquare, Plug, Activity } from 'lucide-react';
import { ToyyibView } from './ToyyibView';
import { WhapiConfigView } from './WhapiConfigView';
import { SystemLogsView } from './SystemLogsView';

type ApiTab = 'toyyib' | 'whapi' | 'systemlogs';

const TABS: { key: ApiTab; label: string; sub: string; icon: React.ReactNode }[] = [
  { key: 'toyyib', label: 'ToyyibPay', sub: 'Payment Gateway', icon: <CreditCard size={16} /> },
  { key: 'whapi', label: 'Whapi', sub: 'WhatsApp API', icon: <MessageSquare size={16} /> },
  { key: 'systemlogs', label: 'System Logs', sub: 'Firestore Audit', icon: <Activity size={16} /> },
];

export const ApiConfigView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ApiTab>('toyyib');

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-jci-blue/10 text-jci-blue flex items-center justify-center shrink-0">
          <Plug size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">API Settings</h2>
          <p className="text-slate-500 text-xs md:text-sm truncate">Third-party integrations — payments and messaging.</p>
        </div>
      </div>

      {/* Service switcher */}
      <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 md:px-5 md:py-3 text-left transition-all ${
                active
                  ? 'bg-jci-blue text-white border-jci-blue shadow-md shadow-jci-blue/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-jci-blue/40 hover:text-jci-blue'
              }`}
            >
              <span className={`shrink-0 ${active ? 'text-white' : 'text-slate-400'}`}>{tab.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-black leading-tight">{tab.label}</span>
                <span className={`block text-[10px] font-semibold uppercase tracking-wide truncate ${active ? 'text-white/70' : 'text-slate-400'}`}>
                  {tab.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Service panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
        {activeTab === 'toyyib' && <ToyyibView embedded />}
        {activeTab === 'whapi' && <WhapiConfigView embedded />}
        {activeTab === 'systemlogs' && <SystemLogsView />}
      </div>
    </div>
  );
};

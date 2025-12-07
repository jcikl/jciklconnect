import React, { useState } from 'react';
import { Play, GitBranch, Settings, Plus, Zap, ArrowRight, Save, Clock, Mail, UserPlus, ShieldAlert } from 'lucide-react';
import { Card, Button, Badge, Tabs } from '../ui/Common';
import { MOCK_AUTOMATION_RULES } from '../../services/mockData';

export const AutomationStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Workflows');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Intelligent Automation</h2>
          <p className="text-slate-500">Zero-click workflow designer and rules engine.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline"><Settings size={16} className="mr-2"/> Global Settings</Button>
            <Button><Plus size={16} className="mr-2"/> New Workflow</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 pt-4">
            <Tabs 
                tabs={['Workflows', 'Rules Engine', 'Execution Logs']} 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
            />
        </div>

        <div className="p-6 bg-slate-50 min-h-[500px]">
            {activeTab === 'Workflows' && <WorkflowCanvas />}
            {activeTab === 'Rules Engine' && <RulesList />}
            {activeTab === 'Execution Logs' && <div className="text-center text-slate-500 py-20">System Logs View Placeholder</div>}
        </div>
      </div>
    </div>
  );
};

const RulesList: React.FC = () => {
    return (
        <div className="space-y-4">
            {MOCK_AUTOMATION_RULES.map(rule => (
                <div key={rule.id} className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${rule.active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Zap size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900">{rule.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs">IF {rule.trigger}</span>
                                <ArrowRight size={12} />
                                <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">THEN {rule.action}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="block text-xl font-bold text-slate-900">{rule.executions}</span>
                            <span className="text-xs text-slate-500">Executions</span>
                        </div>
                        <div className="w-px h-8 bg-slate-100"></div>
                        <Button variant="ghost" size="sm">Edit</Button>
                    </div>
                </div>
            ))}
            <button className="w-full py-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-jci-blue hover:text-jci-blue transition-colors flex items-center justify-center gap-2">
                <Plus size={18} /> Add Logic Rule
            </button>
        </div>
    )
}

// Visual Mock of a Workflow Editor
const WorkflowCanvas: React.FC = () => {
    return (
        <div className="relative w-full h-[600px] bg-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
            <div className="absolute top-4 right-4 bg-white p-2 rounded shadow-sm flex gap-2">
                <Button size="sm" variant="outline"><Save size={14} className="mr-2"/> Save</Button>
                <Button size="sm"><Play size={14} className="mr-2"/> Activate</Button>
            </div>

            {/* Mock Nodes */}
            <div className="absolute top-20 left-20 w-64 bg-white rounded-lg shadow-md border-l-4 border-green-500 p-4">
                <div className="flex items-center gap-2 mb-2 text-green-700 font-semibold text-sm">
                    <UserPlus size={16} /> Trigger: New Registration
                </div>
                <p className="text-xs text-slate-500">When a user submits the signup form.</p>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-slate-300 rounded-full flex items-center justify-center z-10">
                    <ArrowRight size={12} className="rotate-90 text-slate-400"/>
                </div>
            </div>

            <div className="absolute top-52 left-20 w-64 bg-white rounded-lg shadow-md border-l-4 border-blue-500 p-4">
                <div className="flex items-center gap-2 mb-2 text-blue-700 font-semibold text-sm">
                    <Mail size={16} /> Action: Send Welcome Sequence
                </div>
                <p className="text-xs text-slate-500">Template: "New Member Welcome"</p>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-slate-300 rounded-full flex items-center justify-center z-10">
                    <ArrowRight size={12} className="rotate-90 text-slate-400"/>
                </div>
            </div>

            <div className="absolute top-80 left-20 w-64 bg-white rounded-lg shadow-md border-l-4 border-purple-500 p-4">
                <div className="flex items-center gap-2 mb-2 text-purple-700 font-semibold text-sm">
                    <GitBranch size={16} /> Decision: Skills Check
                </div>
                <p className="text-xs text-slate-500">Has skill 'Finance'?</p>
                
                {/* Branches */}
                <svg className="absolute top-full left-1/2 w-40 h-20 -ml-[1px] overflow-visible pointer-events-none">
                    <path d="M0,0 V20 H-80 V40" fill="none" stroke="#94a3b8" strokeWidth="2" />
                    <path d="M0,0 V20 H80 V40" fill="none" stroke="#94a3b8" strokeWidth="2" />
                </svg>
            </div>

            <div className="absolute top-[440px] left-[-40px] w-56 bg-white rounded-lg shadow-md border-l-4 border-amber-500 p-3 opacity-80">
                <div className="flex items-center gap-2 text-amber-700 font-semibold text-xs">
                    <ShieldAlert size={14} /> Suggest: Treasury Comm.
                </div>
            </div>

             <div className="absolute top-[440px] left-[160px] w-56 bg-white rounded-lg shadow-md border-l-4 border-slate-500 p-3 opacity-80">
                <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                    <Clock size={14} /> Wait: 3 Days
                </div>
            </div>
        </div>
    )
}
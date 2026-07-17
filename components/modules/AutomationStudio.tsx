import React, { useState } from 'react';
import { Plus, RefreshCw, Settings, AlertCircle, Webhook as WebhookIcon } from 'lucide-react';
import { Tabs, Button, ConfirmDialog, CONFIRM_CLOSED } from '../ui/Common';
import type { ConfirmState } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useAutomation } from '../../hooks/useAutomation';
import { AutomationRule } from '../../types';
import { Workflow } from '../../services/automationService';
import { WorkflowVisualDesigner } from './WorkflowVisualDesigner';

import { WorkflowsList } from './AutomationStudio/WorkflowsList';
import { RulesList } from './AutomationStudio/RulesList';
import { ExecutionLogs } from './AutomationStudio/ExecutionLogs';
import { WorkflowDetailModal } from './AutomationStudio/WorkflowDetailModal';
import { CreateWorkflowModal } from './AutomationStudio/CreateWorkflowModal';
import { CreateRuleModal } from './AutomationStudio/CreateRuleModal';
import { RuleConfigModal } from './AutomationStudio/RuleConfigModal';
import { GlobalSettingsModal } from './AutomationStudio/GlobalSettingsModal';

export const AutomationStudio: React.FC = () => {
  const [confirmState, setConfirmState] = useState<ConfirmState>(CONFIRM_CLOSED);
  const [activeTab, setActiveTab] = useState('Workflows');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showGlobalSettingsModal, setShowGlobalSettingsModal] = useState(false);

  const {
    workflows,
    rules,
    loading,
    error,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    updateRule,
    executeWorkflow,
    refreshWorkflows,
    refreshRules,
  } = useAutomation();

  const handleToggleWorkflow = async (workflow: Workflow) => {
    try {
      await updateWorkflow(workflow.id!, { active: !workflow.active });
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      await updateRule(rule.id, { active: !rule.active });
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    setConfirmState({
      open: true,
      title: 'Delete Workflow',
      message: 'Are you sure you want to delete this workflow?',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState(CONFIRM_CLOSED);
        try {
          await deleteWorkflow(workflowId);
        } catch (err) {
          // Error handled by hook
        }
      },
    });
  };

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      await executeWorkflow(workflowId, {}, 'manual');
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Intelligent Automation</h2>
          <p className="text-slate-500">Zero-click workflow designer and rules engine.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              refreshWorkflows();
              refreshRules();
            }}
          >
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowGlobalSettingsModal(true)}>
            <Settings size={16} className="mr-2" /> Global Settings
          </Button>
          <Button onClick={() => setShowWorkflowModal(true)}>
            <Plus size={16} className="mr-2" /> New Workflow
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 pt-4">
          <Tabs
            tabs={['Workflows', 'Rules Engine', 'Execution Logs', 'Webhooks']}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        <div className="p-4 sm:p-6 bg-slate-50 min-h-[500px]">
          {loading && activeTab === 'Workflows' && (
            <LoadingState loading={true} error={null} empty={false}>
              <div className="text-center py-12 text-slate-500">Loading workflows...</div>
            </LoadingState>
          )}
          {error && activeTab === 'Workflows' && (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
              <p className="text-red-600">{error}</p>
            </div>
          )}
          {!loading && !error && activeTab === 'Workflows' && (
            <WorkflowsList
              workflows={workflows}
              onSelect={setSelectedWorkflow}
              onToggle={handleToggleWorkflow}
              onDelete={handleDeleteWorkflow}
              onExecute={handleExecuteWorkflow}
              onCreate={() => setShowWorkflowModal(true)}
            />
          )}

          {loading && activeTab === 'Rules Engine' && (
            <LoadingState loading={true} error={null} empty={false}>
              <div className="text-center py-12 text-slate-500">Loading rules...</div>
            </LoadingState>
          )}
          {error && activeTab === 'Rules Engine' && (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
              <p className="text-red-600">{error}</p>
            </div>
          )}
          {!loading && !error && activeTab === 'Rules Engine' && (
            <RulesList
              rules={rules}
              onSelect={setSelectedRule}
              onToggle={handleToggleRule}
              onCreate={() => setShowRuleModal(true)}
            />
          )}

          {selectedRule && (
            <RuleConfigModal
              rule={selectedRule}
              onClose={() => setSelectedRule(null)}
              onSave={async (updatedRule) => {
                await updateRule(selectedRule.id, updatedRule);
                refreshRules();
                setSelectedRule(null);
              }}
            />
          )}

          {activeTab === 'Execution Logs' && (
            <ExecutionLogs workflows={workflows} />
          )}

          {activeTab === 'Webhooks' && (
            <div className="text-center py-10 text-slate-400">
              <WebhookIcon className="mx-auto mb-4 text-slate-300" size={48} />
              <p>Webhooks management coming soon</p>
            </div>
          )}
        </div>
      </div>

      {selectedWorkflow && (
        <WorkflowDetailModal
          workflow={selectedWorkflow}
          onClose={() => setSelectedWorkflow(null)}
          onToggle={handleToggleWorkflow}
          onExecute={handleExecuteWorkflow}
        />
      )}

      {showWorkflowModal && (
        <CreateWorkflowModal
          onClose={() => setShowWorkflowModal(false)}
          onSuccess={() => {
            setShowWorkflowModal(false);
            refreshWorkflows();
          }}
        />
      )}

      {selectedWorkflow && (
        <WorkflowVisualDesigner
          workflow={selectedWorkflow}
          onSave={async (workflowData) => {
            if (selectedWorkflow.id) {
              await updateWorkflow(selectedWorkflow.id, workflowData);
            } else {
              await createWorkflow(workflowData);
            }
            refreshWorkflows();
          }}
          onClose={() => setSelectedWorkflow(null)}
        />
      )}

      <GlobalSettingsModal
        isOpen={showGlobalSettingsModal}
        onClose={() => setShowGlobalSettingsModal(false)}
      />

      {showRuleModal && (
        <CreateRuleModal
          onClose={() => setShowRuleModal(false)}
          onSuccess={() => {
            setShowRuleModal(false);
            refreshRules();
          }}
        />
      )}
      <ConfirmDialog open={confirmState.open} title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(CONFIRM_CLOSED)} />
    </div>
  );
};

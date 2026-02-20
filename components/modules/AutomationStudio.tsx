import React, { useState, useEffect } from 'react';
import {
  Play, GitBranch, Settings, Plus, Zap, ArrowRight, Save, Clock, Mail,
  UserPlus, ShieldAlert, Edit, Trash2, Power, PowerOff, List, FileText,
  CheckCircle, XCircle, AlertCircle, RefreshCw, GripVertical, Award,
  Bell, Webhook as WebhookIcon, Calendar, Filter, ChevronUp, ChevronDown, ExternalLink, Eye, EyeOff
} from 'lucide-react';
import { Card, Button, Badge, Tabs, Modal, useToast } from '../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useAutomation } from '../../hooks/useAutomation';
import { AutomationRule } from '../../types';
import { Workflow, WorkflowStep, AutomationService } from '../../services/automationService';
import { formatDate } from '../../utils/dateUtils';
import { useMembers } from '../../hooks/useMembers';
import { POINT_CATEGORIES } from '../../config/constants';
import { WorkflowVisualDesigner } from './WorkflowVisualDesigner';
import { useWebhooks } from '../../hooks/useWebhooks';
import { Webhook } from '../../services/webhookService';
import { WorkflowExecution } from '../../types';

export const AutomationStudio: React.FC = () => {
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

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      try {
        await deleteWorkflow(workflowId);
      } catch (err) {
        // Error handled by hook
      }
    }
  };

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      await executeWorkflow(workflowId, {}, 'manual');
      // Refresh execution logs if on that tab
      if (activeTab === 'Execution Logs') {
        // Trigger refresh by changing selectedWorkflowId temporarily
        setTimeout(() => {
          // This will trigger useEffect in ExecutionLogs component
        }, 500);
      }
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
    </div>
  );
};

interface WorkflowsListProps {
  workflows: Workflow[];
  onSelect: (workflow: Workflow) => void;
  onToggle: (workflow: Workflow) => void;
  onDelete: (workflowId: string) => void;
  onExecute: (workflowId: string) => void;
  onCreate: () => void;
}

const WorkflowsList: React.FC<WorkflowsListProps> = ({
  workflows,
  onSelect,
  onToggle,
  onDelete,
  onExecute,
  onCreate,
}) => {
  if (workflows.length === 0) {
    return (
      <div className="text-center py-20">
        <GitBranch className="mx-auto text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 mb-4">No workflows created yet</p>
        <Button onClick={onCreate}>
          <Plus size={16} className="mr-2" /> Create First Workflow
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {workflows.map(workflow => (
        <Card key={workflow.id} className="hover:shadow-md transition-shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className={`p-3 rounded-full ${workflow.active
                ? 'bg-green-100 text-green-600'
                : 'bg-slate-100 text-slate-400'
                }`}>
                <GitBranch size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-slate-900">{workflow.name}</h4>
                  <Badge variant={workflow.active ? 'success' : 'neutral'}>
                    {workflow.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {workflow.description && (
                  <p className="text-sm text-slate-600 mb-2">{workflow.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Play size={12} />
                    {workflow.executions} execution{workflow.executions !== 1 ? 's' : ''}
                  </span>
                  {workflow.lastExecuted && (
                    <span>
                      Last: {formatDate(workflow.lastExecuted as Date)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggle(workflow)}
                title={workflow.active ? 'Deactivate' : 'Activate'}
              >
                {workflow.active ? (
                  <PowerOff size={16} className="text-red-500" />
                ) : (
                  <Power size={16} className="text-green-500" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onExecute(workflow.id!)}
                title="Execute Now"
              >
                <Play size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect(workflow)}
              >
                <Edit size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(workflow.id!)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

interface RulesListProps {
  rules: AutomationRule[];
  onSelect: (rule: AutomationRule) => void;
  onToggle: (rule: AutomationRule) => void;
  onCreate: () => void;
}

const RulesList: React.FC<RulesListProps> = ({ rules, onSelect, onToggle, onCreate }) => {
  if (rules.length === 0) {
    return (
      <div className="text-center py-20">
        <Zap className="mx-auto text-slate-400 mb-4" size={48} />
        <p className="text-slate-500 mb-4">No automation rules created yet</p>
        <Button onClick={onCreate}>
          <Plus size={16} className="mr-2" /> Create First Rule
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map(rule => (
        <Card key={rule.id} className="hover:shadow-md transition-shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <div className={`p-3 rounded-full ${rule.active
                ? 'bg-green-100 text-green-600'
                : 'bg-slate-100 text-slate-400'
                }`}>
                <Zap size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-bold text-slate-900">{rule.name}</h4>
                  <Badge variant={rule.active ? 'success' : 'neutral'}>
                    {rule.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs">
                    IF {rule.trigger}
                  </span>
                  <ArrowRight size={14} className="text-slate-400" />
                  <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                    THEN {rule.action}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <span className="block text-xl font-bold text-slate-900">
                  {rule.executions}
                </span>
                <span className="text-xs text-slate-500">Executions</span>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggle(rule)}
                title={rule.active ? 'Deactivate' : 'Activate'}
              >
                {rule.active ? (
                  <PowerOff size={16} className="text-red-500" />
                ) : (
                  <Power size={16} className="text-green-500" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect(rule)}
              >
                <Edit size={16} />
              </Button>
            </div>
          </div>
        </Card>
      ))}
      <button
        onClick={onCreate}
        className="w-full py-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-jci-blue hover:text-jci-blue transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={18} /> Add Logic Rule
      </button>
    </div>
  );
};

interface ExecutionLogsProps {
  workflows: Workflow[];
}

const ExecutionLogs: React.FC<ExecutionLogsProps> = ({ workflows }) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);

  useEffect(() => {
    loadExecutions();
  }, [selectedWorkflowId]);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const logs = await AutomationService.getExecutionLogs(selectedWorkflowId || undefined, 100);
      setExecutions(logs);
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTriggerIcon = (triggeredBy: WorkflowExecution['triggeredBy']) => {
    switch (triggeredBy) {
      case 'manual': return <Play size={14} />;
      case 'event': return <Calendar size={14} />;
      case 'schedule': return <Clock size={14} />;
      case 'webhook': return <WebhookIcon size={14} />;
      case 'condition': return <Filter size={14} />;
      default: return <Play size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <RefreshCw className="mx-auto text-slate-400 mb-4 animate-spin" size={48} />
        <p className="text-slate-500">Loading execution logs...</p>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Select
            value={selectedWorkflowId || 'all'}
            onChange={(e) => setSelectedWorkflowId(e.target.value === 'all' ? null : e.target.value)}
            options={[
              { label: 'All Workflows', value: 'all' },
              ...workflows.map(w => ({ label: w.name, value: w.id! })),
            ]}
          />
          <Button variant="outline" onClick={loadExecutions}>
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
        </div>
        <div className="text-center py-20">
          <FileText className="mx-auto text-slate-400 mb-4" size={48} />
          <p className="text-slate-500">No execution logs yet</p>
          <p className="text-sm text-slate-400 mt-2">
            Workflow execution logs will appear here after workflows are executed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select
          value={selectedWorkflowId || 'all'}
          onChange={(e) => setSelectedWorkflowId(e.target.value === 'all' ? null : e.target.value)}
          options={[
            { label: 'All Workflows', value: 'all' },
            ...workflows.map(w => ({ label: w.name, value: w.id! })),
          ]}
        />
        <Button variant="outline" onClick={loadExecutions}>
          <RefreshCw size={16} className="mr-2" /> Refresh
        </Button>
      </div>

      {/* Execution List */}
      <div className="space-y-3">
        {executions.map(exec => (
          <Card
            key={exec.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedExecution(exec)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-slate-900">{exec.workflowName}</h4>
                  <Badge variant={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'error' : 'neutral'} className="text-xs">
                    {exec.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    {getTriggerIcon(exec.triggeredBy)}
                    <span className="capitalize">{exec.triggeredBy}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(new Date(exec.startedAt))}
                  </span>
                  {exec.completedAt && exec.duration && (
                    <span>
                      Duration: {exec.duration < 1000 ? `${exec.duration}ms` : `${(exec.duration / 1000).toFixed(2)}s`}
                    </span>
                  )}
                  <span>
                    {exec.executedSteps.length} step{exec.executedSteps.length !== 1 ? 's' : ''}
                  </span>
                  {exec.executedSteps.filter(s => s.status === 'failed').length > 0 && (
                    <span className="text-red-600">
                      {exec.executedSteps.filter(s => s.status === 'failed').length} failed
                    </span>
                  )}
                </div>
                {exec.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    <strong>Error:</strong> {exec.error.message}
                    {exec.error.stepId && (
                      <span className="block mt-1">Failed at step: {exec.error.stepType} ({exec.error.stepId})</span>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm">
                <Eye size={16} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Execution Detail Modal */}
      {selectedExecution && (
        <ExecutionDetailModal
          execution={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      )}
    </div>
  );
};

interface ExecutionDetailModalProps {
  execution: WorkflowExecution;
  onClose: () => void;
}

const ExecutionDetailModal: React.FC<ExecutionDetailModalProps> = ({ execution, onClose }) => {
  return (
    <Modal isOpen={true} onClose={onClose} title={`Execution Details: ${execution.workflowName}`} size="lg">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Status</label>
            <div className="mt-1">
              <Badge variant={execution.status === 'success' ? 'success' : execution.status === 'failed' ? 'error' : 'neutral'}>
                {execution.status}
              </Badge>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Triggered By</label>
            <div className="mt-1 text-sm text-slate-900 capitalize">{execution.triggeredBy}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Started At</label>
            <div className="mt-1 text-sm text-slate-900">{formatDate(new Date(execution.startedAt))}</div>
          </div>
          {execution.completedAt && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Completed At</label>
              <div className="mt-1 text-sm text-slate-900">{formatDate(new Date(execution.completedAt))}</div>
            </div>
          )}
          {execution.duration && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Duration</label>
              <div className="mt-1 text-sm text-slate-900">
                {execution.duration < 1000 ? `${execution.duration}ms` : `${(execution.duration / 1000).toFixed(2)}s`}
              </div>
            </div>
          )}
        </div>

        {/* Error Details */}
        {execution.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-900 mb-2">Execution Error</h4>
            <p className="text-sm text-red-700 mb-2">{execution.error.message}</p>
            {execution.error.stepId && (
              <p className="text-xs text-red-600">
                Failed at: {execution.error.stepType} (Step ID: {execution.error.stepId})
              </p>
            )}
          </div>
        )}

        {/* Executed Steps */}
        <div>
          <h4 className="font-semibold text-slate-900 mb-3">Executed Steps</h4>
          <div className="space-y-2">
            {execution.executedSteps.map((step, idx) => (
              <div key={step.stepId} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">#{step.stepOrder}</span>
                    <span className="font-medium text-slate-900">{step.stepType}</span>
                    <Badge variant={step.status === 'success' ? 'success' : step.status === 'failed' ? 'error' : 'neutral'} className="text-xs">
                      {step.status}
                    </Badge>
                  </div>
                  {step.duration && (
                    <span className="text-xs text-slate-500">
                      {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(2)}s`}
                    </span>
                  )}
                </div>
                {step.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {step.error}
                  </div>
                )}
                {step.output && Object.keys(step.output).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer">View Output</summary>
                    <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Context */}
        {execution.context && Object.keys(execution.context).length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Execution Context</h4>
            <details>
              <summary className="text-sm text-slate-500 cursor-pointer">View Context</summary>
              <pre className="mt-2 p-3 bg-slate-50 rounded text-xs overflow-auto">
                {JSON.stringify(execution.context, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </Modal>
  );
};

interface WorkflowDetailModalProps {
  workflow: Workflow;
  onClose: () => void;
  onToggle: (workflow: Workflow) => void;
  onExecute: (workflowId: string) => void;
}

const WorkflowDetailModal: React.FC<WorkflowDetailModalProps> = ({
  workflow,
  onClose,
  onToggle,
  onExecute,
}) => {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={workflow.name}
      size="lg"
    >
      <div className="space-y-4">
        {workflow.description && (
          <p className="text-slate-600">{workflow.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Status</label>
            <Badge variant={workflow.active ? 'success' : 'neutral'} className="mt-1">
              {workflow.active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Executions</label>
            <p className="text-lg font-semibold mt-1">{workflow.executions}</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Trigger
          </label>
          <div className="bg-slate-50 p-3 rounded-lg">
            <p className="text-sm">
              <span className="font-semibold">Type:</span> {workflow.trigger.type}
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Steps ({workflow.steps.length})
          </label>
          <div className="space-y-2">
            {workflow.steps.map((step, index) => (
              <div key={step.id} className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-white px-2 py-1 rounded">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-sm">{step.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              onToggle(workflow);
              onClose();
            }}
          >
            {workflow.active ? (
              <>
                <PowerOff size={16} className="mr-2" />
                Deactivate
              </>
            ) : (
              <>
                <Power size={16} className="mr-2" />
                Activate
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              onExecute(workflow.id!);
              onClose();
            }}
          >
            <Play size={16} className="mr-2" />
            Execute Now
          </Button>
        </div>
      </div>
    </Modal>
  );
};

interface CreateWorkflowModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateWorkflowModal: React.FC<CreateWorkflowModalProps> = ({ onClose, onSuccess }) => {
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'event' | 'schedule' | 'condition' | 'webhook'>('event');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [active, setActive] = useState(true);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [showStepModal, setShowStepModal] = useState(false);

  const { createWorkflow } = useAutomation();
  const { members } = useMembers();
  const { showToast } = useToast();

  const generateStepId = () => `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const handleAddStep = () => {
    const newStep: WorkflowStep = {
      id: generateStepId(),
      type: 'create_notification',
      config: {},
      order: steps.length + 1,
    };
    setEditingStep(newStep);
    setShowStepModal(true);
  };

  const handleEditStep = (step: WorkflowStep) => {
    setEditingStep(step);
    setShowStepModal(true);
  };

  const handleSaveStep = (step: WorkflowStep) => {
    if (editingStep && steps.find(s => s.id === editingStep.id)) {
      // Update existing step
      setSteps(steps.map(s => s.id === editingStep.id ? step : s));
    } else {
      // Add new step
      setSteps([...steps, { ...step, order: steps.length + 1 }]);
    }
    setShowStepModal(false);
    setEditingStep(null);
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps(steps.filter(s => s.id !== stepId).map((s, index) => ({ ...s, order: index + 1 })));
  };

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    const index = steps.findIndex(s => s.id === stepId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workflowName.trim()) {
      showToast('Please enter a workflow name', 'error');
      return;
    }

    if (steps.length === 0) {
      showToast('Please add at least one step to the workflow', 'error');
      return;
    }

    try {
      await createWorkflow({
        name: workflowName,
        description: description || undefined,
        trigger: {
          type: triggerType,
          config: triggerConfig,
        },
        steps,
        active,
      });
      onSuccess?.();
    } catch (err) {
      // Error handled by hook
    }
  };

  const getStepIcon = (type: WorkflowStep['type']) => {
    switch (type) {
      case 'send_email': return <Mail size={16} />;
      case 'award_points': return <Award size={16} />;
      case 'create_notification': return <Bell size={16} />;
      case 'call_webhook': return <WebhookIcon size={16} />;
      case 'update_data': return <Settings size={16} />;
      case 'conditional': return <Filter size={16} />;
      default: return <List size={16} />;
    }
  };

  const getStepLabel = (type: WorkflowStep['type']) => {
    switch (type) {
      case 'send_email': return 'Send Email';
      case 'award_points': return 'Award Points';
      case 'create_notification': return 'Create Notification';
      case 'call_webhook': return 'Call Webhook';
      case 'update_data': return 'Update Data';
      case 'conditional': return 'Conditional Logic';
      default: return type;
    }
  };

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title="Create New Workflow"
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>
            <Input
              label="Workflow Name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="e.g. New Member Onboarding"
              required
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              rows={3}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <label className="text-sm font-medium text-slate-700">Activate workflow immediately</label>
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-slate-900">Trigger</h3>
            <Select
              label="Trigger Type"
              value={triggerType}
              onChange={(e) => {
                setTriggerType(e.target.value as any);
                setTriggerConfig({});
              }}
              options={[
                { label: 'Event Trigger', value: 'event' },
                { label: 'Scheduled', value: 'schedule' },
                { label: 'Condition Based', value: 'condition' },
                { label: 'Webhook', value: 'webhook' },
              ]}
            />

            {triggerType === 'event' && (
              <div className="space-y-3">
                <Select
                  label="Event Type"
                  value={triggerConfig.eventType || ''}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, eventType: e.target.value })}
                  options={[
                    { label: 'New Member Registration', value: 'member_registered' },
                    { label: 'Event Registration', value: 'event_registered' },
                    { label: 'Event Attendance', value: 'event_attendance' },
                    { label: 'Task Completed', value: 'task_completed' },
                    { label: 'Project Created', value: 'project_created' },
                    { label: 'Payment Received', value: 'payment_received' },
                  ]}
                />
              </div>
            )}

            {triggerType === 'schedule' && (
              <div className="space-y-3">
                <Select
                  label="Schedule Type"
                  value={triggerConfig.scheduleType || ''}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, scheduleType: e.target.value })}
                  options={[
                    { label: 'Daily', value: 'daily' },
                    { label: 'Weekly', value: 'weekly' },
                    { label: 'Monthly', value: 'monthly' },
                    { label: 'Yearly', value: 'yearly' },
                    { label: 'Custom Cron', value: 'cron' },
                  ]}
                />
                {triggerConfig.scheduleType === 'cron' && (
                  <Input
                    label="Cron Expression"
                    value={triggerConfig.cronExpression || ''}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, cronExpression: e.target.value })}
                    placeholder="0 9 * * *"
                    helperText="e.g. 0 9 * * * for daily at 9 AM"
                  />
                )}
              </div>
            )}

            {triggerType === 'condition' && (
              <div className="space-y-3">
                <Input
                  label="Condition Field"
                  value={triggerConfig.field || ''}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, field: e.target.value })}
                  placeholder="e.g. member.points"
                />
                <Select
                  label="Operator"
                  value={triggerConfig.operator || ''}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, operator: e.target.value })}
                  options={[
                    { label: 'Equals', value: '==' },
                    { label: 'Not Equals', value: '!=' },
                    { label: 'Greater Than', value: '>' },
                    { label: 'Less Than', value: '<' },
                    { label: 'Contains', value: 'contains' },
                  ]}
                />
                <Input
                  label="Value"
                  value={triggerConfig.value || ''}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, value: e.target.value })}
                  placeholder="e.g. 100"
                />
              </div>
            )}

            {triggerType === 'webhook' && (
              <div className="space-y-3">
                <Input
                  label="Webhook URL"
                  value={triggerConfig.webhookUrl || ''}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, webhookUrl: e.target.value })}
                  placeholder="https://example.com/webhook"
                  type="url"
                />
                <Input
                  label="Secret Key (optional)"
                  value={triggerConfig.secretKey || ''}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, secretKey: e.target.value })}
                  type="password"
                  placeholder="For webhook verification"
                />
              </div>
            )}
          </div>

          {/* Workflow Steps */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Workflow Steps</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddStep}>
                <Plus size={16} className="mr-2" /> Add Step
              </Button>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-300 rounded-lg">
                <GitBranch className="mx-auto text-slate-400 mb-2" size={32} />
                <p className="text-slate-500 text-sm">No steps added yet</p>
                <p className="text-slate-400 text-xs mt-1">Click "Add Step" to start building your workflow</p>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-jci-blue transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <GripVertical className="text-slate-400 cursor-move" size={16} />
                      <span className="text-xs font-mono bg-white px-2 py-1 rounded text-slate-600">
                        {step.order}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="p-2 bg-white rounded text-jci-blue">
                        {getStepIcon(step.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900">{getStepLabel(step.type)}</p>
                        {step.config.description && (
                          <p className="text-xs text-slate-500 truncate">{step.config.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveStep(step.id, 'up')}
                        >
                          <ChevronUp size={14} />
                        </Button>
                      )}
                      {index < steps.length - 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveStep(step.id, 'down')}
                        >
                          <ChevronDown size={14} />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditStep(step)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStep(step.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button type="submit" className="flex-1">
              <Save size={16} className="mr-2" /> Create Workflow
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Step Configuration Modal */}
      {showStepModal && editingStep && (
        <WorkflowStepModal
          step={editingStep}
          members={members}
          onSave={handleSaveStep}
          onClose={() => {
            setShowStepModal(false);
            setEditingStep(null);
          }}
        />
      )}
    </>
  );
};

interface WorkflowStepModalProps {
  step: WorkflowStep;
  members: any[];
  onSave: (step: WorkflowStep) => void;
  onClose: () => void;
}

const WorkflowStepModal: React.FC<WorkflowStepModalProps> = ({ step, members, onSave, onClose }) => {
  const [stepType, setStepType] = useState<WorkflowStep['type']>(step.type);
  const [config, setConfig] = useState<Record<string, any>>(step.config || {});

  const handleSave = () => {
    onSave({
      ...step,
      type: stepType,
      config,
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Configure Step: ${step.order}`}
      size="lg"
    >
      <div className="space-y-4">
        <Select
          label="Step Type"
          value={stepType}
          onChange={(e) => {
            setStepType(e.target.value as WorkflowStep['type']);
            setConfig({});
          }}
          options={[
            { label: 'Send Email', value: 'send_email' },
            { label: 'Award Points', value: 'award_points' },
            { label: 'Create Notification', value: 'create_notification' },
            { label: 'Call Webhook', value: 'call_webhook' },
            { label: 'Update Data', value: 'update_data' },
            { label: 'Conditional Logic', value: 'conditional' },
          ]}
        />

        {stepType === 'send_email' && (
          <div className="space-y-3">
            <Select
              label="Recipient"
              value={config.recipientId || ''}
              onChange={(e) => setConfig({ ...config, recipientId: e.target.value })}
              options={[
                { label: 'Trigger Member', value: 'trigger_member' },
                { label: 'Specific Member', value: 'specific' },
                ...members.map(m => ({ label: m.name, value: m.id })),
              ]}
            />
            {config.recipientId === 'specific' && (
              <Select
                label="Select Member"
                value={config.memberId || ''}
                onChange={(e) => setConfig({ ...config, memberId: e.target.value })}
                options={members.map(m => ({ label: m.name, value: m.id }))}
              />
            )}
            <Input
              label="Subject"
              value={config.subject || ''}
              onChange={(e) => setConfig({ ...config, subject: e.target.value })}
              placeholder="Email subject"
            />
            <Textarea
              label="Body"
              value={config.body || ''}
              onChange={(e) => setConfig({ ...config, body: e.target.value })}
              placeholder="Email body content"
              rows={5}
            />
          </div>
        )}

        {stepType === 'award_points' && (
          <div className="space-y-3">
            <Select
              label="Recipient"
              value={config.memberId || 'trigger_member'}
              onChange={(e) => setConfig({ ...config, memberId: e.target.value })}
              options={[
                { label: 'Trigger Member', value: 'trigger_member' },
                ...members.map(m => ({ label: m.name, value: m.id })),
              ]}
            />
            <Select
              label="Category"
              value={config.category || ''}
              onChange={(e) => setConfig({ ...config, category: e.target.value })}
              options={Object.entries(POINT_CATEGORIES).map(([key, value]) => ({
                label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                value,
              }))}
            />
            <Input
              label="Points Amount"
              type="number"
              value={config.amount || ''}
              onChange={(e) => setConfig({ ...config, amount: parseInt(e.target.value) || 0 })}
              placeholder="10"
            />
            <Input
              label="Description"
              value={config.description || ''}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              placeholder="Why points are being awarded"
            />
          </div>
        )}

        {stepType === 'create_notification' && (
          <div className="space-y-3">
            <Select
              label="Recipient"
              value={config.memberId || 'trigger_member'}
              onChange={(e) => setConfig({ ...config, memberId: e.target.value })}
              options={[
                { label: 'Trigger Member', value: 'trigger_member' },
                ...members.map(m => ({ label: m.name, value: m.id })),
              ]}
            />
            <Input
              label="Title"
              value={config.title || ''}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              placeholder="Notification title"
            />
            <Textarea
              label="Message"
              value={config.message || ''}
              onChange={(e) => setConfig({ ...config, message: e.target.value })}
              placeholder="Notification message"
              rows={3}
            />
            <Select
              label="Type"
              value={config.type || 'info'}
              onChange={(e) => setConfig({ ...config, type: e.target.value })}
              options={[
                { label: 'Info', value: 'info' },
                { label: 'Success', value: 'success' },
                { label: 'Warning', value: 'warning' },
                { label: 'Error', value: 'error' },
              ]}
            />
          </div>
        )}

        {stepType === 'call_webhook' && (
          <div className="space-y-3">
            <Input
              label="Webhook URL"
              type="url"
              value={config.url || ''}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="https://example.com/webhook"
              required
            />
            <Select
              label="HTTP Method"
              value={config.method || 'POST'}
              onChange={(e) => setConfig({ ...config, method: e.target.value })}
              options={[
                { label: 'POST', value: 'POST' },
                { label: 'GET', value: 'GET' },
                { label: 'PUT', value: 'PUT' },
                { label: 'PATCH', value: 'PATCH' },
              ]}
            />
            <Textarea
              label="Headers (JSON)"
              value={config.headers ? JSON.stringify(config.headers, null, 2) : ''}
              onChange={(e) => {
                try {
                  setConfig({ ...config, headers: JSON.parse(e.target.value) });
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder='{"Content-Type": "application/json"}'
              rows={3}
            />
            <Textarea
              label="Body (JSON)"
              value={config.body ? JSON.stringify(config.body, null, 2) : ''}
              onChange={(e) => {
                try {
                  setConfig({ ...config, body: JSON.parse(e.target.value) });
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder='{"key": "value"}'
              rows={4}
            />
          </div>
        )}

        {stepType === 'update_data' && (
          <div className="space-y-3">
            <Input
              label="Collection"
              value={config.collection || ''}
              onChange={(e) => setConfig({ ...config, collection: e.target.value })}
              placeholder="e.g. members, events"
            />
            <Input
              label="Document ID (or use context.entityId)"
              value={config.docId || ''}
              onChange={(e) => setConfig({ ...config, docId: e.target.value })}
              placeholder="Leave empty to use context.entityId"
            />
            <Textarea
              label="Update Data (JSON)"
              value={config.updateData ? JSON.stringify(config.updateData, null, 2) : ''}
              onChange={(e) => {
                try {
                  setConfig({ ...config, updateData: JSON.parse(e.target.value) });
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder='{"status": "completed"}'
              rows={4}
            />
          </div>
        )}

        {stepType === 'conditional' && (
          <div className="space-y-3">
            <Input
              label="Condition Field"
              value={config.field || ''}
              onChange={(e) => setConfig({ ...config, field: e.target.value })}
              placeholder="e.g. member.points"
            />
            <Select
              label="Operator"
              value={config.operator || ''}
              onChange={(e) => setConfig({ ...config, operator: e.target.value })}
              options={[
                { label: 'Equals', value: '==' },
                { label: 'Not Equals', value: '!=' },
                { label: 'Greater Than', value: '>' },
                { label: 'Less Than', value: '<' },
                { label: 'Contains', value: 'contains' },
              ]}
            />
            <Input
              label="Value"
              value={config.value || ''}
              onChange={(e) => setConfig({ ...config, value: e.target.value })}
              placeholder="e.g. 100"
            />
            <p className="text-xs text-slate-500">
              If condition is true, workflow continues. If false, workflow stops.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={handleSave} className="flex-1">
            <Save size={16} className="mr-2" /> Save Step
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Create Rule Modal
interface CreateRuleModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateRuleModal: React.FC<CreateRuleModalProps> = ({ onClose, onSuccess }) => {
  const [ruleName, setRuleName] = useState('');
  const [trigger, setTrigger] = useState('Member Registered');
  const [action, setAction] = useState('');
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { createRule } = useAutomation();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !action.trim()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await createRule({
        name: ruleName,
        trigger,
        action,
        active,
      });
      onSuccess();
    } catch (err) {
      // Error handled by hook
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Automation Rule" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Rule Name"
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
          placeholder="e.g., Welcome New Members"
          required
        />

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Trigger (IF)</label>
          <Select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            options={[
              { label: 'Member Registered', value: 'Member Registered' },
              { label: 'Event Attendance', value: 'Event Attendance' },
              { label: 'Task Completed', value: 'Task Completed' },
              { label: 'Dues Overdue > 30 Days', value: 'Dues Overdue > 30 Days' },
              { label: 'Event Attendance > 10', value: 'Event Attendance > 10' },
              { label: 'Project Created', value: 'Project Created' },
              { label: 'Payment Received', value: 'Payment Received' },
            ]}
            required
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Action (THEN)</label>
          <Textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g., Send Welcome SMS + Grant 'Newbie' Badge"
            rows={3}
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <label className="text-sm font-medium text-slate-700">Active</label>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" className="flex-1" disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Create Rule'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Rule Configuration Modal
interface RuleConfigModalProps {
  rule: AutomationRule;
  onClose: () => void;
  onSave: (updatedRule: Partial<AutomationRule>) => Promise<void>;
}

const RuleConfigModal: React.FC<RuleConfigModalProps> = ({
  rule,
  onClose,
  onSave,
}) => {
  const [ruleName, setRuleName] = useState(rule.name);
  const [trigger, setTrigger] = useState(rule.trigger);
  const [action, setAction] = useState(rule.action);
  const [active, setActive] = useState(rule.active);
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !trigger.trim() || !action.trim()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: ruleName,
        trigger,
        action,
        active,
      });
      showToast('Rule updated successfully', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to update rule', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Configure Automation Rule" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Rule Name"
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
          placeholder="e.g., New Member Onboarding"
          required
        />

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Trigger (IF)</label>
          <Select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            options={[
              { label: 'Member Registered', value: 'Member Registered' },
              { label: 'Event Attendance', value: 'Event Attendance' },
              { label: 'Task Completed', value: 'Task Completed' },
              { label: 'Dues Overdue > 30 Days', value: 'Dues Overdue > 30 Days' },
              { label: 'Event Attendance > 10', value: 'Event Attendance > 10' },
              { label: 'Project Created', value: 'Project Created' },
              { label: 'Payment Received', value: 'Payment Received' },
            ]}
            required
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Action (THEN)</label>
          <Textarea
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g., Send Welcome Kit + Assign Buddy"
            rows={3}
            required
          />
          <p className="text-xs text-slate-500">
            Describe what action should be taken when this trigger occurs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <label className="text-sm font-medium text-slate-700">Active</label>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-slate-700">Rule Preview:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs">
              IF {trigger}
            </span>
            <ArrowRight size={14} className="text-slate-400" />
            <span className="font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
              THEN {action}
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" className="flex-1" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Rule'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const GlobalSettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, save to backend
    showToast('Global settings saved', 'success');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Global Automation Settings">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Execution limits</h4>
          <Input label="Max Concurrent Workflows" type="number" defaultValue="5" />
          <Input label="Daily Execution Limit" type="number" defaultValue="1000" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Notifications</h4>
          <Checkbox label="Email me on workflow failure" defaultChecked />
          <Checkbox label="Email me on system warnings" defaultChecked />
        </div>
        <div className="pt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit">Save Settings</Button>
        </div>
      </form>
    </Modal>
  );
};

import React, { useState } from 'react';
import {
  Save, Plus, GitBranch, GripVertical,
  ChevronUp, ChevronDown, Edit, Trash2,
  Mail, Award, Bell, Webhook as WebhookIcon, Settings, Filter, List,
} from 'lucide-react';
import { Button, Modal, useToast } from '../../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../../ui/Form';
import { Workflow, WorkflowStep } from '../../../services/automationService';
import { useAutomation } from '../../../hooks/useAutomation';
import { useMembers } from '../../../hooks/useMembers';
import { WorkflowStepModal } from './WorkflowStepModal';

export interface CreateWorkflowModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateWorkflowModal: React.FC<CreateWorkflowModalProps> = ({ onClose, onSuccess }) => {
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'event' | 'schedule' | 'condition' | 'webhook'>('event');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [active, setActive] = useState(true);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [showStepModal, setShowStepModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      setSteps(steps.map(s => s.id === editingStep.id ? step : s));
    } else {
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
    if (isSaving) return;
    if (!workflowName.trim()) {
      showToast('Please enter a workflow name', 'error');
      return;
    }
    if (steps.length === 0) {
      showToast('Please add at least one step to the workflow', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await createWorkflow({
        name: workflowName,
        description: description || undefined,
        trigger: { type: triggerType, config: triggerConfig },
        steps,
        active,
      });
      onSuccess?.();
    } catch (err) {
      // Error handled by hook
    } finally {
      setIsSaving(false);
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
      <Modal isOpen={true} onClose={onClose} title="Create New Workflow" size="xl" drawerOnMobile>
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleMoveStep(step.id, 'up')}>
                          <ChevronUp size={14} />
                        </Button>
                      )}
                      {index < steps.length - 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleMoveStep(step.id, 'down')}>
                          <ChevronDown size={14} />
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleEditStep(step)}>
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
            <Button type="submit" className="flex-1" disabled={isSaving}>
              <Save size={16} className="mr-2" /> {isSaving ? 'Creating…' : 'Create Workflow'}
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

import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { Button, Modal } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import { WorkflowStep } from '../../../services/automationService';
import { POINT_CATEGORIES } from '../../../config/constants';

export interface WorkflowStepModalProps {
  step: WorkflowStep;
  members: any[];
  onSave: (step: WorkflowStep) => void;
  onClose: () => void;
}

export const WorkflowStepModal: React.FC<WorkflowStepModalProps> = ({ step, members, onSave, onClose }) => {
  const [stepType, setStepType] = useState<WorkflowStep['type']>(step.type);
  const [config, setConfig] = useState<Record<string, any>>(step.config || {});
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.resolve(onSave({
        ...step,
        type: stepType,
        config,
      }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Configure Step: ${step.order}`}
      size="lg"
      drawerOnMobile
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
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            <Save size={16} className="mr-2" /> {isSaving ? 'Saving…' : 'Save Step'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

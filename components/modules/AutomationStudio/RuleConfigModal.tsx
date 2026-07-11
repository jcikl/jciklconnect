import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Modal, useToast } from '../../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../../ui/Form';
import { AutomationRule } from '../../../types';

export interface RuleConfigModalProps {
  rule: AutomationRule;
  onClose: () => void;
  onSave: (updatedRule: Partial<AutomationRule>) => Promise<void>;
}

export const RuleConfigModal: React.FC<RuleConfigModalProps> = ({
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
      await onSave({ name: ruleName, trigger, action, active });
      showToast('Rule updated successfully', 'success');
      onClose();
    } catch (err) {
      showToast('Failed to update rule', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Configure Automation Rule" size="lg" drawerOnMobile>
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

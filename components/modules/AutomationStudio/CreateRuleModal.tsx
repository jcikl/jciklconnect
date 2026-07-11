import React, { useState } from 'react';
import { Button, Modal, useToast } from '../../ui/Common';
import { Input, Select, Textarea, Checkbox } from '../../ui/Form';
import { useAutomation } from '../../../hooks/useAutomation';

export interface CreateRuleModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateRuleModal: React.FC<CreateRuleModalProps> = ({ onClose, onSuccess }) => {
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
      await createRule({ name: ruleName, trigger, action, active });
      onSuccess();
    } catch (err) {
      // Error handled by hook
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Automation Rule" size="lg" drawerOnMobile>
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

import React from 'react';
import { Button, Modal, useToast } from '../../ui/Common';
import { Input, Checkbox } from '../../ui/Form';

export interface GlobalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, save to backend
    showToast('Global settings saved', 'success');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Global Automation Settings" drawerOnMobile>
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

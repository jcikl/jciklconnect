import React from 'react';
import { Button, Modal } from '../../ui/Common';
import { Input } from '../../ui/Form';

interface FinanceAddAdminAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (accountName: string) => void;
}

export const FinanceAddAdminAccountModal: React.FC<FinanceAddAdminAccountModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Add Admin Account"
    size="md"
    bottomSheet
    drawerOnMobile
    footer={
      <div className="flex gap-2 w-full">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" type="submit" form="add-admin-account-form">Add Account</Button>
      </div>
    }
  >
    <form
      id="add-admin-account-form"
      onSubmit={(event) => {
        event.preventDefault();
        const name = (new FormData(event.currentTarget).get('projectId') as string)?.trim();
        if (name) {
          onAdd(name);
        }
      }}
      className="space-y-4"
    >
      <Input name="projectId" label="Account Name" placeholder="e.g. National Due, Maintenance" required />
    </form>
  </Modal>
);

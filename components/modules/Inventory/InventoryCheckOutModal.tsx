import React, { type FormEvent } from 'react';
import { Button, Modal } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';
import type { InventoryItem, Member } from '../../../types';

interface InventoryCheckOutModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  members: Member[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const InventoryCheckOutModal: React.FC<InventoryCheckOutModalProps> = ({
  isOpen,
  item,
  members,
  onClose,
  onSubmit,
}) => {
  if (!item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Check Out Item"
      bottomSheet
      drawerOnMobile
      footer={<Button className="w-full" type="submit" form="checkout-form">Check Out</Button>}
    >
      <form id="checkout-form" onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-slate-600 mb-4">Checking out: <strong>{item.name}</strong></p>
        <Select name="memberId" label="Assign To" options={[
          { label: 'Select member...', value: '' },
          ...members.map(member => ({ label: member.general?.name ?? member.id, value: member.id })),
        ]} required />
        <Input name="expectedReturnDate" label="Expected Return Date" type="date" />
        <div className="pt-4">
        </div>
      </form>
    </Modal>
  );
};

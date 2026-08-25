import React from 'react';
import { Button, Modal } from '../../ui/Common';
import type { EventRegistration } from '../../../types';

interface EventMarkPaidModalProps {
  registration: EventRegistration | null;
  onClose: () => void;
  onConfirm: (method: 'bank_transfer' | 'cash') => void;
}

export const EventMarkPaidModal: React.FC<EventMarkPaidModalProps> = ({
  registration,
  onClose,
  onConfirm,
}) => {
  if (!registration) return null;

  return (
    <Modal isOpen onClose={onClose} title="Mark as Paid" size="sm">
      <p className="text-sm text-slate-600 mb-4">
        Select payment method for <span className="font-medium">{registration.memberName ?? registration.memberId}</span>:
      </p>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onConfirm('bank_transfer')}>Bank Transfer</Button>
        <Button className="flex-1" onClick={() => onConfirm('cash')}>Cash</Button>
      </div>
      <Button variant="ghost" className="w-full mt-2" onClick={onClose}>Cancel</Button>
    </Modal>
  );
};

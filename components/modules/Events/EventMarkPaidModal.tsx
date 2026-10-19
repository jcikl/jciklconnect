import React, { useState } from 'react';
import { Button, Modal } from '../../ui/Common';
import type { EventRegistration } from '../../../types';

interface EventMarkPaidModalProps {
  registration: EventRegistration | null;
  onClose: () => void;
  /** `receivedMyr` is only passed for USD (external-chapter) registrations when finance typed the MYR actually received. */
  onConfirm: (method: 'bank_transfer' | 'cash', receivedMyr?: number) => void;
}

export const EventMarkPaidModal: React.FC<EventMarkPaidModalProps> = ({
  registration,
  onClose,
  onConfirm,
}) => {
  const [receivedMyr, setReceivedMyr] = useState('');
  if (!registration) return null;
  const isUsd = registration.currency === 'USD';
  const parsed = receivedMyr.trim() === '' ? undefined : Number(receivedMyr);
  const invalid = parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0);
  const confirm = (method: 'bank_transfer' | 'cash') => onConfirm(method, isUsd ? parsed : undefined);

  return (
    <Modal isOpen onClose={onClose} title="Mark as Paid" size="sm">
      <p className="text-sm text-slate-600 mb-4">
        Select payment method for <span className="font-medium">{registration.memberName ?? registration.memberId}</span>:
      </p>
      {isUsd && (
        <label className="block mb-4 text-sm text-slate-600">
          MYR actually received (optional)
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={receivedMyr}
            onChange={(e) => setReceivedMyr(e.target.value)}
            placeholder="Leave empty to record the listed price"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="block mt-1 text-xs text-slate-400">External-chapter registration (priced in USD). Finance records MYR.</span>
        </label>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={invalid} onClick={() => confirm('bank_transfer')}>Bank Transfer</Button>
        <Button className="flex-1" disabled={invalid} onClick={() => confirm('cash')}>Cash</Button>
      </div>
      <Button variant="ghost" className="w-full mt-2" onClick={onClose}>Cancel</Button>
    </Modal>
  );
};

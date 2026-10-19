import React, { useState } from 'react';
import { Button, Modal } from '../../ui/Common';
import type { EventRegistration } from '../../../types';

interface EventMarkPaidModalProps {
  registration: EventRegistration | null;
  /** Listed event price (`price || priceMin`), prefilled as the MYR amount. */
  defaultAmount?: number;
  onClose: () => void;
  /** `amount` is the MYR finance confirmed. */
  onConfirm: (method: 'bank_transfer' | 'cash', amount: number) => void;
}

export const EventMarkPaidModal: React.FC<EventMarkPaidModalProps> = ({
  registration,
  defaultAmount = 0,
  onClose,
  onConfirm,
}) => {
  const [receivedMyr, setReceivedMyr] = useState(String(defaultAmount));
  if (!registration) return null;
  const isUsd = registration.currency === 'USD';
  const parsed = Number(receivedMyr);
  const invalid = receivedMyr.trim() === '' || !Number.isFinite(parsed) || parsed < 0;
  const confirm = (method: 'bank_transfer' | 'cash') => onConfirm(method, parsed);

  return (
    <Modal isOpen onClose={onClose} title="Mark as Paid" size="sm">
      <p className="text-sm text-slate-600 mb-4">
        Select payment method for <span className="font-medium">{registration.memberName ?? registration.memberId}</span>:
      </p>
      <label className="block mb-4 text-sm text-slate-600">
        Amount received (MYR)
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={receivedMyr}
          onChange={(e) => setReceivedMyr(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <span className="block mt-1 text-xs text-slate-400">
          {isUsd ? 'External-chapter registration (priced in USD); finance records MYR. ' : ''}Confirm or edit the amount. 0 records no transaction.
        </span>
      </label>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={invalid} onClick={() => confirm('bank_transfer')}>Bank Transfer</Button>
        <Button className="flex-1" disabled={invalid} onClick={() => confirm('cash')}>Cash</Button>
      </div>
      <Button variant="ghost" className="w-full mt-2" onClick={onClose}>Cancel</Button>
    </Modal>
  );
};

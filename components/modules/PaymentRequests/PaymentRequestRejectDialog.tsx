import React from 'react';
import { Button, Modal } from '../../ui/Common';

interface PaymentRequestRejectDialogProps {
  isOpen: boolean;
  rejectReason: string;
  actioningId: string | null;
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
}

export const PaymentRequestRejectDialog: React.FC<PaymentRequestRejectDialogProps> = ({
  isOpen,
  rejectReason,
  actioningId,
  onClose,
  onReasonChange,
  onConfirm,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Payment Request">
      <div className="space-y-4 p-1">
        <p className="text-sm text-slate-600">Please provide a reason for rejecting this payment request. The applicant will be notified.</p>
        <textarea
          className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
          rows={3}
          placeholder="e.g. Missing receipts, incorrect amount, out of budget…"
          value={rejectReason}
          onChange={event => onReasonChange(event.target.value)}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={actioningId !== null || !rejectReason.trim()}>
            Confirm Reject
          </Button>
        </div>
      </div>
    </Modal>
  );
};

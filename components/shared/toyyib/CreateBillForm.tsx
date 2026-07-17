/**
 * CreateBillForm — reusable ToyyibPay bill creation form.
 *
 * Usage examples:
 *
 * // Annual dues — fixed amount, category pre-selected
 * <CreateBillForm
 *   categoryCode="6x9mw99z"
 *   defaultBillName="Annual Dues 2026"
 *   fixedAmount={150}
 *   onSuccess={(bill) => console.log(bill.paymentUrl)}
 * />
 *
 * // Event payment — caller passes member info to pre-fill
 * <CreateBillForm
 *   categoryCode={event.toyyibCategoryCode}
 *   defaultBillName={event.title}
 *   defaultPayerName={member.name}
 *   defaultEmail={member.email}
 *   defaultPhone={member.phone}
 *   onSuccess={handleBillCreated}
 * />
 */

import React, { useState } from 'react';
import { ExternalLink, CheckCircle } from 'lucide-react';
import { Button } from '../../ui/Common';
import { Input } from '../../ui/Form';
import { useCreateBill } from '../../../hooks/useToyyibPay';
import { ToyyibBillResponse } from '../../../services/toyyibService';

export interface CreateBillFormProps {
  /** ToyyibPay category code to bill under */
  categoryCode?: string;
  /** Pre-fill bill name (editable unless fixedAmount is also set) */
  defaultBillName?: string;
  /** Fixed amount in RM — disables amount field when provided */
  fixedAmount?: number;
  /** Pre-fill payer name */
  defaultPayerName?: string;
  /** Pre-fill payer email */
  defaultEmail?: string;
  /** Pre-fill payer phone */
  defaultPhone?: string;
  /** Called with the created bill on success */
  onSuccess?: (bill: ToyyibBillResponse) => void;
  /** Called on failure with the error */
  onError?: (error: Error) => void;
  /** Hide the success banner (useful when parent handles it) */
  hideSuccessBanner?: boolean;
}

export const CreateBillForm: React.FC<CreateBillFormProps> = ({
  categoryCode,
  defaultBillName = '',
  fixedAmount,
  defaultPayerName = '',
  defaultEmail = '',
  defaultPhone = '',
  onSuccess,
  onError,
  hideSuccessBanner = false,
}) => {
  const { createBill, isCreating, lastBill, reset } = useCreateBill();

  const [billName, setBillName] = useState(defaultBillName);
  const [amount, setAmount] = useState(fixedAmount !== undefined ? String(fixedAmount) : '');
  const [payerName, setPayerName] = useState(defaultPayerName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async () => {
    if (!billName.trim() || !amount || !payerName.trim() || !email.trim() || !phone.trim()) {
      setValidationError('Please fill in all fields.');
      return;
    }
    setValidationError('');
    try {
      const res = await createBill({
        billName: billName.trim(),
        billDescription: billName.trim(),
        billAmount: parseFloat(amount),
        billTo: payerName.trim(),
        billEmail: email.trim(),
        billPhone: phone.trim(),
        externalReferenceNo: 'JCI-' + Date.now(),
        categoryCode,
      });
      onSuccess?.(res);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to create bill');
      onError?.(err);
    }
  };

  if (!hideSuccessBanner && lastBill) {
    return (
      <div className="p-4 bg-green-50 border border-green-100 rounded-xl space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-green-900">Payment Link Created</p>
            <p className="text-[11px] font-mono text-green-700 mt-0.5 break-all">{lastBill.billCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="success" className="flex items-center gap-1.5 h-8 text-xs"
            onClick={() => window.open(lastBill.paymentUrl, '_blank', 'noopener,noreferrer')}>
            <ExternalLink size={12} /> Open Payment Page
          </Button>
          <button
            className="text-xs text-green-700 hover:underline"
            onClick={() => { navigator.clipboard.writeText(lastBill.paymentUrl); }}>
            Copy link
          </button>
          <button className="text-xs text-slate-400 hover:underline ml-auto" onClick={reset}>
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {validationError && (
        <p className="text-xs text-red-500">{validationError}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Bill Name</label>
          <Input value={billName} onChange={e => setBillName(e.target.value)} placeholder="e.g. Annual Dues 2026" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Amount (RM)</label>
          <Input
            type="number" min="0" step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            disabled={fixedAmount !== undefined}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Payer Name</label>
          <Input value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Payer Phone</label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01xxxxxxxx" />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Payer Email</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="payer@example.com" />
        </div>
      </div>
      <Button onClick={handleSubmit} className="w-full" isLoading={isCreating} variant="primary">
        Generate Payment Link
      </Button>
    </div>
  );
};

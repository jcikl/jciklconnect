/**
 * PaymentButton — unified ToyyibPay payment trigger.
 *
 * Usage:
 *   // Membership dues
 *   <PaymentButton type="membership" member={member} year={2026} />
 *
 *   // Event ticketing
 *   <PaymentButton type="event" member={member} project={{ id, title, ticketPrice }} />
 *
 *   // Pre-existing bill (skip creation, show link directly)
 *   <PaymentButton type="membership" member={member} year={2026}
 *     existingPaymentUrl={record.toyyibPaymentUrl}
 *     existingBillStatus={record.toyyibPaymentStatus} />
 */

import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Copy, CheckCircle, AlertCircle, CreditCard } from 'lucide-react';
import { useToyyibPayment } from '../../../hooks/useToyyibPayment';
import type { Member } from '../../../types';

interface MembershipProps {
  type: 'membership';
  member: Member;
  year: number;
  project?: never;
}

interface EventProps {
  type: 'event';
  member: Member;
  project: { id: string; title: string; ticketPrice: number };
  year?: never;
}

export type PaymentButtonProps = (MembershipProps | EventProps) & {
  label?: string;
  size?: 'sm' | 'md';
  /** Pass when a bill already exists — bypasses creation and renders link immediately */
  existingPaymentUrl?: string;
  /** billpaymentStatus "1" = already paid; button renders as a green "Paid" badge */
  existingBillStatus?: string;
  className?: string;
  onSuccess?: (result: { billCode: string; paymentUrl: string; isExisting: boolean }) => void;
};

export const PaymentButton: React.FC<PaymentButtonProps> = ({
  type,
  member,
  year,
  project,
  label,
  size = 'md',
  existingPaymentUrl,
  existingBillStatus,
  className = '',
  onSuccess,
}) => {
  const { isPaying, error, payMembershipDues, payEventTicket } = useToyyibPayment();
  const isFailed = existingBillStatus === '3';
  // Failed bills: ignore the old URL so the button triggers a fresh creation
  const [paymentUrl, setPaymentUrl] = useState<string | null>(isFailed ? null : (existingPaymentUrl ?? null));
  const [isExisting, setIsExisting] = useState(!isFailed && !!existingPaymentUrl);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const isPaid = existingBillStatus === '1';

  const btnCls = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg'
    : 'px-4 py-2 text-sm gap-2 rounded-xl';

  const handlePay = async () => {
    try {
      const result = type === 'membership'
        ? await payMembershipDues(member, year!)
        : await payEventTicket(member, project!);
      setPaymentUrl(result.paymentUrl);
      setIsExisting(result.isExisting);
      onSuccess?.(result);
      if (!result.isExisting) window.open(result.paymentUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // error shown via hook state
    }
  };

  const handleCopy = () => {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  if (isPaid) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold text-green-600 ${className}`}>
        <CheckCircle size={12} /> Paid
      </span>
    );
  }

  if (paymentUrl) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {isExisting && (
          <span className="hidden sm:inline text-[10px] text-amber-600 font-medium">Existing link</span>
        )}
        <button
          onClick={() => window.open(paymentUrl, '_blank', 'noopener,noreferrer')}
          className={`inline-flex items-center font-semibold bg-jci-blue text-white hover:bg-jci-blue/90 transition-colors ${btnCls}`}
        >
          <ExternalLink size={size === 'sm' ? 11 : 13} />
          Open
        </button>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-jci-blue transition-colors p-1"
          title={copied ? 'Copied' : 'Copy link'}
        >
          {copied ? <CheckCircle size={11} className="text-green-500" /> : <Copy size={11} />}
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <button
        onClick={handlePay}
        disabled={isPaying}
        className={`inline-flex items-center font-semibold bg-jci-blue text-white hover:bg-jci-blue/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${btnCls}`}
      >
        <CreditCard size={size === 'sm' ? 11 : 13} />
        {isPaying ? 'Generating…' : (label ?? 'Pay Now')}
      </button>
      {error && (
        <p className="flex items-center gap-1 text-[10px] text-red-500">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
};

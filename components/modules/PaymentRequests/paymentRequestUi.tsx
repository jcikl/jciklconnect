import React from 'react';
import { Check, CheckCircle, Clock, Copy, FileText, X, XCircle } from 'lucide-react';
import { Badge } from '../../ui/Common';
import type { PaymentRequestStatus } from '../../../types';

const PR_STATUS_BADGE: Record<PaymentRequestStatus, { variant: React.ComponentProps<typeof Badge>['variant']; icon: React.ReactNode; label: string }> = {
  approved:  { variant: 'success', icon: <CheckCircle size={11} />, label: 'Approved' },
  rejected:  { variant: 'error',   icon: <XCircle size={11} />,     label: 'Rejected' },
  cancelled: { variant: 'neutral', icon: <X size={11} />,           label: 'Cancelled' },
  submitted: { variant: 'warning', icon: <Clock size={11} />,       label: 'Pending' },
  draft:     { variant: 'neutral', icon: <FileText size={11} />,    label: 'Draft' },
  paid:      { variant: 'jci',     icon: <CheckCircle size={11} />, label: 'Paid' },
};

interface PaymentRequestStatusBadgeProps {
  status: PaymentRequestStatus;
}

export const PaymentRequestStatusBadge: React.FC<PaymentRequestStatusBadgeProps> = ({ status }) => {
  const badge = PR_STATUS_BADGE[status] ?? PR_STATUS_BADGE.draft;
  return <Badge variant={badge.variant} icon={badge.icon}>{badge.label}</Badge>;
};

export const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-jci-blue bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-all border-none"
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
      {copied ? 'Copied' : (label || 'Copy')}
    </button>
  );
};

/**
 * BillPaymentLink — renders a ToyyibPay payment link in various forms.
 *
 * Usage:
 *   <BillPaymentLink billCode="gcbhict9" variant="button" />
 *   <BillPaymentLink billCode="gcbhict9" variant="link" label="Pay now" />
 *   <BillPaymentLink billCode="gcbhict9" variant="copy" />
 */

import React from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { TOYYIB_CONFIG } from '../../../config/constants';

export interface BillPaymentLinkProps {
  billCode: string;
  /** button = full button; link = inline text link; copy = icon copy-to-clipboard */
  variant?: 'button' | 'link' | 'copy';
  label?: string;
  className?: string;
  onCopied?: () => void;
}

export function billPaymentUrl(billCode: string): string {
  return `https://${TOYYIB_CONFIG.IS_SANDBOX ? 'dev.' : ''}toyyibpay.com/${billCode}`;
}

export const BillPaymentLink: React.FC<BillPaymentLinkProps> = ({
  billCode,
  variant = 'button',
  label,
  className = '',
  onCopied,
}) => {
  const url = billPaymentUrl(billCode);

  if (variant === 'copy') {
    return (
      <button
        className={`inline-flex items-center gap-1 text-xs text-slate-400 hover:text-jci-blue transition-colors ${className}`}
        title="Copy payment link"
        onClick={() => { navigator.clipboard.writeText(url); onCopied?.(); }}
      >
        <Copy size={12} />
        {label ?? 'Copy'}
      </button>
    );
  }

  if (variant === 'link') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center gap-1 text-xs text-jci-blue hover:underline ${className}`}
      >
        <ExternalLink size={11} />
        {label ?? 'Open payment page'}
      </a>
    );
  }

  // variant === 'button'
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg bg-jci-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-jci-blue/90 transition-colors ${className}`}
      onClick={() => window.open(url, '_blank')}
    >
      <ExternalLink size={12} />
      {label ?? 'Pay Now'}
    </button>
  );
};

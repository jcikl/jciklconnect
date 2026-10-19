import React from 'react';
import { formatEventPrice } from '../../../utils/formatUtils';
import { EXTERNAL_OFFLINE_PAYMENT_NOTE } from '../../../config/constants';

interface EventMobileRegistrationFooterProps {
  priceMin: number | undefined;
  priceMax: number | undefined;
  priceCurrency?: 'MYR' | 'USD';
  /** External-chapter viewer: show the offline payment instructions. */
  offlinePayment?: boolean;
  registerButton: React.ReactNode;
}

export const EventMobileRegistrationFooter: React.FC<EventMobileRegistrationFooterProps> = ({
  priceMin,
  priceMax,
  priceCurrency = 'MYR',
  offlinePayment = false,
  registerButton,
}) => (
  <div className="flex items-center gap-4 w-full">
    <div className="shrink-0 min-w-[80px]">
      {priceMin != null ? (
        <>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mb-0.5">From</span>
          <span className="text-lg font-black text-slate-900 leading-none">
            {formatEventPrice(priceMin, priceMax, priceCurrency)}
          </span>
        </>
      ) : (
        <span className="text-xl font-black text-green-600 leading-none">FREE</span>
      )}
      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mt-0.5">/ person</span>
    </div>
    <div className="flex-1">
      {registerButton}
      {offlinePayment && priceMin != null && priceMin > 0 && (
        <p className="text-[10px] text-slate-500 leading-tight mt-1">{EXTERNAL_OFFLINE_PAYMENT_NOTE}</p>
      )}
    </div>
  </div>
);

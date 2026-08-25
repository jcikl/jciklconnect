import React from 'react';

interface EventMobileRegistrationFooterProps {
  priceMin: number | undefined;
  priceMax: number | undefined;
  registerButton: React.ReactNode;
}

export const EventMobileRegistrationFooter: React.FC<EventMobileRegistrationFooterProps> = ({
  priceMin,
  priceMax,
  registerButton,
}) => (
  <div className="flex items-center gap-4 w-full">
    <div className="shrink-0 min-w-[80px]">
      {priceMin != null ? (
        <>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mb-0.5">From</span>
          <span className="text-lg font-black text-slate-900 leading-none">
            RM {priceMin}{priceMax != null && priceMax !== priceMin ? ` – ${priceMax}` : ''}
          </span>
        </>
      ) : (
        <span className="text-xl font-black text-green-600 leading-none">FREE</span>
      )}
      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block leading-none mt-0.5">/ person</span>
    </div>
    <div className="flex-1">{registerButton}</div>
  </div>
);

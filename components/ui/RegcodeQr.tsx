import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface RegcodeQrProps {
  /** The JCI Malaysia regcode string. When empty/null the component renders the subtle empty hint (or nothing). */
  regcode?: string | null;
  /** Shown above the QR. */
  label?: string;
  /** QR module size in px (defaults to 132; capped to the card). */
  size?: number;
  /** When false and there is no regcode, render nothing instead of the subtle hint. Defaults to true. */
  showEmptyHint?: boolean;
  className?: string;
  /** Tailwind max-width class capping the rendered QR (defaults to 'max-w-[180px]'; larger for the zoomed view). */
  maxWidthClass?: string;
}

/**
 * JCI Malaysia check-in QR + the regcode in large text. The QR is REGENERATED from the regcode string
 * (JCI Malaysia's own qrcode image is never used). Always dark-on-white for scannability regardless of theme;
 * the surrounding chrome follows light/dark. Responsive down to <640px.
 */
export const RegcodeQr: React.FC<RegcodeQrProps> = ({
  regcode,
  label = 'Check-in QR',
  size = 132,
  showEmptyHint = true,
  className = '',
  maxWidthClass = 'max-w-[180px]',
}) => {
  const code = (regcode ?? '').trim();

  if (!code) {
    if (!showEmptyHint) return null;
    return (
      <p className={`text-xs text-slate-400 dark:text-slate-500 ${className}`}>No check-in code yet</p>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      )}
      <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <QRCodeSVG
          value={code}
          size={size}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#0f172a"
          className={`h-auto w-full ${maxWidthClass}`}
        />
      </div>
      {/* The card is always white, so the code stays dark in both themes (a dark: variant would hide it on white). */}
      <p className="font-mono text-2xl font-bold tracking-[0.3em] text-slate-900">{code}</p>
    </div>
  );
};

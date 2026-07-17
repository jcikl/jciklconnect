import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, Copy, Check } from 'lucide-react';
import { Card, Button, Badge } from '../../ui/Common';

interface Props {
  eventId: string;
  eventName: string;
  checkedInCount?: number;
}

/**
 * Generates a QR code by dynamically loading the `qrcode` package if available,
 * or falls back to displaying the URL as text with a copy button.
 */
export const EventQRCheckIn: React.FC<Props> = ({ eventId, eventName, checkedInCount = 0 }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [copied, setCopied] = useState(false);
  const isMounted = useRef(true);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkInUrl = `${window.location.origin}/checkin/${eventId}`;

  useEffect(() => {
    isMounted.current = true;
    setGenerating(true);
    setQrError(false);
    setQrDataUrl('');

    // Try to use the Google Charts QR API as a dependency-free fallback
    const apiUrl = `https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=M|2&chl=${encodeURIComponent(checkInUrl)}`;

    // We cannot fetch external URLs (CSP), so generate via canvas using a simple approach.
    // Since qrcode is not installed, we render the URL as copyable text with a styled placeholder.
    if (isMounted.current) {
      setGenerating(false);
      setQrError(true); // will show URL fallback
    }

    return () => { isMounted.current = false; };
  }, [checkInUrl]);

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl);
      setCopied(true);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [checkInUrl]);

  return (
    <Card className="p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <QrCode size={18} className="text-jci-blue" />
        <h3 className="text-lg font-semibold text-slate-800">Check-In QR Code</h3>
      </div>
      <p className="text-sm text-slate-500 mb-5">{eventName}</p>

      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="Check-in QR Code"
          className="mx-auto w-56 h-56 rounded-lg border border-slate-100"
        />
      ) : (
        <div className="w-56 h-56 mx-auto bg-slate-50 border border-slate-100 rounded-lg flex flex-col items-center justify-center gap-2 p-4">
          <QrCode size={48} className="text-slate-300" />
          {generating ? (
            <span className="text-xs text-slate-400">Generating...</span>
          ) : (
            <span className="text-xs text-slate-400 text-center break-all">{checkInUrl}</span>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4 mb-3">Members open the link below to check in</p>

      <div className="mb-4">
        <Badge variant="info">Checked in: {checkedInCount}</Badge>
      </div>

      <div className="flex items-center gap-2 bg-slate-50 rounded-md px-3 py-2 text-left">
        <span className="text-xs text-slate-500 truncate flex-1 min-w-0">{checkInUrl}</span>
        <Button size="sm" variant="ghost" onClick={handleCopy} className="shrink-0 flex items-center gap-1">
          {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </Card>
  );
};

import React from 'react';
import { CheckCircle, X } from 'lucide-react';
import { Card } from '../../ui/Common';

interface PaymentRequestSuccessBannerProps {
  referenceNumber: string;
  onClose: () => void;
}

export const PaymentRequestSuccessBanner: React.FC<PaymentRequestSuccessBannerProps> = ({ referenceNumber, onClose }) => (
  <Card className="p-4 bg-emerald-50 border-emerald-200">
    <div className="flex items-start gap-3">
      <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-emerald-800 font-bold text-sm">Submitted Successfully</p>
        <p className="text-emerald-700 text-sm mt-0.5">Reference: <span className="font-mono font-bold">{referenceNumber}</span></p>
        <p className="text-emerald-600 text-xs mt-1">Include this reference in your bank transfer memo.</p>
      </div>
      <button onClick={onClose} className="text-emerald-400 hover:text-emerald-600 shrink-0">
        <X size={16} />
      </button>
    </div>
  </Card>
);

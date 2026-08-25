import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { Event } from '../../../types';
import { Button } from '../../ui/Common';

interface EventRegisterButtonProps {
  status: Event['status'];
  isRegistered: boolean;
  canSelfCancel: boolean;
  isFull: boolean;
  onRegister: () => void;
  onSelfCancel: () => void;
}

export const EventRegisterButton: React.FC<EventRegisterButtonProps> = ({
  status,
  isRegistered,
  canSelfCancel,
  isFull,
  onRegister,
  onSelfCancel,
}) => (
  <div className="flex flex-col gap-2">
    <Button
      className={`w-full rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${canSelfCancel
        ? 'h-14 bg-green-500 text-white hover:bg-red-500 shadow-green-100 flex-col gap-0'
        : isRegistered
          ? 'h-12 bg-green-500 text-white shadow-green-100 cursor-default'
          : isFull
            ? 'h-12 bg-slate-400 text-white cursor-not-allowed'
            : 'h-12 bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
        }`}
      disabled={(!!isRegistered && !canSelfCancel) || status === 'Completed' || status === 'Cancelled' || (isFull && !isRegistered)}
      onClick={canSelfCancel ? onSelfCancel : (!isRegistered ? onRegister : undefined)}
    >
      {status === 'Completed' ? <span>Event Ended</span>
        : status === 'Cancelled' ? <span>Cancelled</span>
          : canSelfCancel
            ? <div className="flex flex-col items-center leading-none gap-0.5">
                <span className="flex items-center gap-1.5"><CheckCircle size={15} className="stroke-[3]" />Registered</span>
                <span className="text-[10px] font-normal normal-case tracking-normal opacity-80">Tap to cancel</span>
              </div>
            : isRegistered ? <><CheckCircle size={18} className="stroke-[3]" /><span>Registered</span></>
              : isFull ? <span>Sold Out</span>
                : <><CheckCircle size={18} className="stroke-[3]" /><span>Register Now</span></>}
    </Button>
  </div>
);

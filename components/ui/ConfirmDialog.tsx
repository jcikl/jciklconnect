import React from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const icons = {
    danger: <Trash2 size={22} className="text-red-500" />,
    warning: <AlertTriangle size={22} className="text-amber-500" />,
    info: <Info size={22} className="text-blue-500" />,
  };
  const confirmVariants = {
    danger: 'danger' as const,
    warning: 'primary' as const,
    info: 'primary' as const,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">{icons[variant]}</div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={confirmVariants[variant]} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/** Minimal state shape for driving a single ConfirmDialog instance per component. */
export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

export const CONFIRM_CLOSED: ConfirmState = {
  open: false,
  title: '',
  message: '',
  onConfirm: () => {},
};

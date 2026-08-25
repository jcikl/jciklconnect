import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from './Button';
import { Drawer } from './Drawer';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  applyLabel?: string;
  resetLabel?: string;
  onApply?: () => void;
  onReset?: () => void;
  showReset?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  title = 'Filters',
  description,
  children,
  applyLabel = 'Apply filters',
  resetLabel = 'Reset filters',
  onApply,
  onReset,
  showReset = false,
  size = 'md',
}) => {
  const handleApply = () => {
    onApply?.();
    onClose();
  };

  const footer = (
    <div className="space-y-3">
      <Button type="button" className="w-full font-bold" onClick={handleApply}>
        {applyLabel}
      </Button>
      {showReset && onReset && (
        <Button type="button" variant="ghost" className="w-full text-xs font-semibold" onClick={onReset}>
          {resetLabel}
        </Button>
      )}
    </div>
  );

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title} position="right" size={size} footer={footer}>
      {description && (
        <div className="mb-4 flex gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
          <SlidersHorizontal size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <p>{description}</p>
        </div>
      )}
      <div className="space-y-6">{children}</div>
    </Drawer>
  );
};

export type { FilterDrawerProps };

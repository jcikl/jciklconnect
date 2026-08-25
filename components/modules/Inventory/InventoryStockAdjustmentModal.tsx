import React, { type FormEvent } from 'react';
import { Button, Modal } from '../../ui/Common';
import { Input, Select } from '../../ui/Form';
import type { InventoryItem } from '../../../types';

interface InventoryStockAdjustmentModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export const InventoryStockAdjustmentModal: React.FC<InventoryStockAdjustmentModalProps> = ({
  isOpen,
  item,
  onClose,
  onSubmit,
}) => {
  if (!item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Stock Adjustment: ${item.name}`}
      bottomSheet
      drawerOnMobile
      footer={<Button className="w-full" type="submit" form="stock-adjustment-form">Complete Adjustment</Button>}
    >
      <form id="stock-adjustment-form" onSubmit={onSubmit} className="space-y-4">
        <div className="p-3 bg-slate-50 rounded-lg text-sm mb-4">
          <p className="font-medium text-slate-900">Current Total: {item.quantity}</p>
        </div>

        {item.variants && item.variants.length > 0 && (
          <Select name="variant" label="Variant (Optional)" options={[
            { label: 'Base Item', value: '' },
            ...item.variants.map(variant => ({ label: `${variant.size} (Current: ${variant.quantity})`, value: variant.size }))
          ]} />
        )}

        <Input name="adjustment" label="Adjustment Quantity (+ or -)" type="number" placeholder="e.g. -5 for loss, 10 for found" required />

        <Select name="reason" label="Reason" options={[
          { label: 'Manual Correction', value: 'Manual Correction' },
          { label: 'Damage', value: 'Damage' },
          { label: 'Loss', value: 'Loss' },
          { label: 'Returned', value: 'Returned' },
          { label: 'Stock Count', value: 'Stock Count' },
          { label: 'Initial Stock', value: 'Initial Stock' },
          { label: 'Other', value: 'Other' },
        ]} required />
      </form>
    </Modal>
  );
};

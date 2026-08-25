import React from 'react';
import { Button, Modal } from '../../ui/Common';
import type { InventoryItem } from '../../../types';
import { InventoryItemFormFields, type InventoryFormVariant } from './InventoryItemFormFields';

interface InventoryItemModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  item?: InventoryItem | null;
  variants: InventoryFormVariant[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onAddVariant: () => void;
  onUpdateVariant: (index: number, field: 'size' | 'quantity', value: string | number) => void;
  onRemoveVariant: (index: number) => void;
}

export const InventoryItemModal: React.FC<InventoryItemModalProps> = ({
  isOpen,
  mode,
  item,
  variants,
  onClose,
  onSubmit,
  onAddVariant,
  onUpdateVariant,
  onRemoveVariant,
}) => {
  if (mode === 'edit' && !item) return null;

  const formId = mode === 'add' ? 'add-item-form' : 'edit-item-form';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'add' ? 'Add Inventory Item' : 'Edit Inventory Item'}
      bottomSheet
      drawerOnMobile
      footer={
        <Button className="w-full" type="submit" form={formId}>
          {mode === 'add' ? 'Add Item' : 'Update Item'}
        </Button>
      }
    >
      <InventoryItemFormFields
        formId={formId}
        mode={mode}
        item={item ?? undefined}
        variants={variants}
        onSubmit={onSubmit}
        onAddVariant={onAddVariant}
        onUpdateVariant={onUpdateVariant}
        onRemoveVariant={onRemoveVariant}
      />
    </Modal>
  );
};

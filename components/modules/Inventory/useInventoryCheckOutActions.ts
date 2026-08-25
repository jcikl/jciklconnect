import { useState, type FormEvent } from 'react';
import type { InventoryItem } from '../../../types';

interface UseInventoryCheckOutActionsOptions {
  checkOutItem: (itemId: string, memberId: string, expectedReturnDate?: string) => Promise<void>;
}

export const useInventoryCheckOutActions = ({
  checkOutItem,
}: UseInventoryCheckOutActionsOptions) => {
  const [isCheckOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [selectedCheckOutItem, setSelectedCheckOutItem] = useState<InventoryItem | null>(null);

  const handleOpenCheckOutModal = (item: InventoryItem) => {
    setSelectedCheckOutItem(item);
    setCheckOutModalOpen(true);
  };

  const handleCloseCheckOutModal = () => {
    setCheckOutModalOpen(false);
    setSelectedCheckOutItem(null);
  };

  const handleCheckOut = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCheckOutItem) return;

    const formData = new FormData(e.currentTarget);

    try {
      await checkOutItem(
        selectedCheckOutItem.id,
        formData.get('memberId') as string,
        formData.get('expectedReturnDate') as string || undefined
      );
      handleCloseCheckOutModal();
    } catch {
      // Error handling is owned by the inventory data hook.
    }
  };

  return {
    isCheckOutModalOpen,
    selectedCheckOutItem,
    handleOpenCheckOutModal,
    handleCloseCheckOutModal,
    handleCheckOut,
  };
};

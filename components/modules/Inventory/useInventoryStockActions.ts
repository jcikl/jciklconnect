import { useState, type FormEvent } from 'react';
import type { InventoryItem, StockMovement } from '../../../types';

interface UseInventoryStockActionsOptions {
  selectedItem: InventoryItem | null;
  memberName?: string;
  loadItems: () => Promise<void>;
  showToast: (message: string, type?: any) => void;
  setSelectedItem: (item: InventoryItem | null) => void;
}

export const useInventoryStockActions = ({
  selectedItem,
  memberName,
  loadItems,
  showToast,
  setSelectedItem,
}: UseInventoryStockActionsOptions) => {
  const [isStockCardModalOpen, setStockCardModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedAdjustmentItem, setSelectedAdjustmentItem] = useState<InventoryItem | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const handleOpenStockCard = async (item: InventoryItem) => {
    setSelectedItem(item);
    setStockCardModalOpen(true);
    setIsHistoryLoading(true);
    try {
      const { InventoryService } = await import('../../../services/inventoryService');
      setStockMovements(await InventoryService.getStockCard(item.id));
    } catch {
      showToast('Failed to load stock card', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleCloseStockCard = () => {
    setStockCardModalOpen(false);
    setSelectedItem(null);
    setStockMovements([]);
  };

  const handleOpenStockAdjustment = (item: InventoryItem) => {
    setSelectedAdjustmentItem(item);
    setAdjustmentModalOpen(true);
  };

  const handleCloseStockAdjustment = () => {
    setAdjustmentModalOpen(false);
    setSelectedAdjustmentItem(null);
  };

  const handleStockAdjustment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAdjustmentItem) return;

    const formData = new FormData(e.currentTarget);
    try {
      const { InventoryService } = await import('../../../services/inventoryService');
      await InventoryService.adjustStock(
        selectedAdjustmentItem.id,
        formData.get('variant') as string || undefined,
        parseInt(formData.get('adjustment') as string),
        formData.get('reason') as string,
        memberName || 'Admin'
      );
      showToast('Stock adjusted successfully', 'success');
      await loadItems();
      handleCloseStockAdjustment();
    } catch (err) {
      showToast('Failed to adjust stock', 'error');
    }
  };

  return {
    isStockCardModalOpen,
    isAdjustmentModalOpen,
    selectedAdjustmentItem,
    stockMovements,
    isHistoryLoading,
    handleOpenStockCard,
    handleCloseStockCard,
    handleOpenStockAdjustment,
    handleCloseStockAdjustment,
    handleStockAdjustment,
  };
};

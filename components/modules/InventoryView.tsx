import React, { useState, useMemo, useEffect } from 'react';
import { AlertCircle, BarChart2, Bell, LayoutList, Plus, Receipt, Wrench } from 'lucide-react';
import { Button, useToast, PageHeader } from '../ui/Common';
import { LoadingState } from '../ui/Loading';
import { useInventory } from '../../hooks/useInventory';
import { useMembers } from '../../hooks/useMembers';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { InventoryItem } from '../../types';
import { InventoryAlertsTab } from './Inventory/InventoryAlertsTab';
import { InventoryCheckOutModal } from './Inventory/InventoryCheckOutModal';
import { InventoryDepreciationTab } from './Inventory/InventoryDepreciationTab';
import { InventoryFinancialHistoryTab } from './Inventory/InventoryFinancialHistoryTab';
import { InventoryItemModal } from './Inventory/InventoryItemModal';
import { InventoryItemsTab } from './Inventory/InventoryItemsTab';
import { InventoryMaintenanceScheduleModal } from './Inventory/InventoryMaintenanceScheduleModal';
import { InventoryMaintenanceTab } from './Inventory/InventoryMaintenanceTab';
import { InventoryStatsStrip, type InventoryStats } from './Inventory/InventoryStatsStrip';
import { InventoryStockAdjustmentModal } from './Inventory/InventoryStockAdjustmentModal';
import { InventoryStockCardModal } from './Inventory/InventoryStockCardModal';
import { INVENTORY_TAB_ITEMS, type InventoryTabId } from './Inventory/inventoryViewConfig';
import { useInventoryCheckOutActions } from './Inventory/useInventoryCheckOutActions';
import { useInventoryItemForm } from './Inventory/useInventoryItemForm';
import { useInventoryMaintenanceActions } from './Inventory/useInventoryMaintenanceActions';
import { useInventoryStockActions } from './Inventory/useInventoryStockActions';
import { useInventoryTransactions } from './Inventory/useInventoryTransactions';

export const InventoryView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTabId>('items');
  const {
    items,
    loading,
    error,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    checkOutItem,
    checkInItem,
    maintenanceSchedules,
    alerts,
    loadMaintenanceSchedules,
    loadAlerts,
    createMaintenanceSchedule,
    updateMaintenanceSchedule,
    completeMaintenance,
    acknowledgeAlert,
    checkAndGenerateAlerts,
  } = useInventory();
  const { members } = useMembers();
  const { member } = useAuth();
  const { canOperateFinance } = usePermissions();
  const { showToast } = useToast();
  const transactions = useInventoryTransactions(activeTab);

  const filteredItems = useMemo(() => {
    const term = (searchQuery || searchTerm).toLowerCase();
    if (!term) return items;
    return items.filter(item =>
      (item.name ?? '').toLowerCase().includes(term) ||
      (item.category ?? '').toLowerCase().includes(term) ||
      (item.location ?? '').toLowerCase().includes(term) ||
      (item.description ?? '').toLowerCase().includes(term)
    );
  }, [items, searchTerm, searchQuery]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchQuery]);

  useEffect(() => {
    if (activeTab === 'maintenance') {
      loadMaintenanceSchedules();
    } else if (activeTab === 'alerts') {
      loadAlerts(false);
    }
  }, [activeTab, loadMaintenanceSchedules, loadAlerts]);

  const stats = useMemo<InventoryStats>(() => {
    return {
      total: items.length,
      available: items.filter(i => i.status === 'Available').length,
      checkedOut: items.filter(i => i.status === 'Checked Out').length,
      needsAction: items.filter(i => i.status !== 'Available' && i.status !== 'Checked Out').length,
    };
  }, [items]);

  const {
    formVariants,
    setFormVariants,
    handleAddItem,
    handleEditItem,
    addVariant,
    updateVariant,
    removeVariant,
  } = useInventoryItemForm({
    selectedItem,
    createItem,
    updateItem,
    showToast,
    onAddComplete: (form) => {
      setAddModalOpen(false);
      form.reset();
    },
    onEditComplete: () => {
      setEditModalOpen(false);
      setSelectedItem(null);
    },
  });

  const {
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
  } = useInventoryStockActions({
    selectedItem,
    memberName: member?.general?.name,
    loadItems,
    showToast,
    setSelectedItem,
  });

  const {
    isMaintenanceModalOpen,
    selectedSchedule,
    handleOpenMaintenanceModal,
    handleCloseMaintenanceModal,
    handleSaveMaintenanceSchedule,
  } = useInventoryMaintenanceActions({
    createMaintenanceSchedule,
    updateMaintenanceSchedule,
    loadMaintenanceSchedules,
    showToast,
  });

  const {
    isCheckOutModalOpen,
    selectedCheckOutItem,
    handleOpenCheckOutModal,
    handleCloseCheckOutModal,
    handleCheckOut,
  } = useInventoryCheckOutActions({ checkOutItem });

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Asset & Inventory"
        description="Track physical assets, locations, and custodians."
        action={canOperateFinance ? (
          <Button onClick={() => setAddModalOpen(true)} size="sm">
            <Plus size={15} className="mr-1.5" /> Add Item
          </Button>
        ) : undefined}
      />

      <LoadingState loading={loading} error={error}>
        <InventoryStatsStrip stats={stats} />

        {(() => {
          const TAB_CONFIG: { id: InventoryTabId; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
            { id: 'items',       label: 'Items',            Icon: LayoutList },
            { id: 'maintenance', label: 'Maintenance',      Icon: Wrench },
            { id: 'alerts',      label: 'Alerts',           Icon: Bell },
            { id: 'depreciation',label: 'Depreciation',     Icon: BarChart2 },
            { id: 'finance',     label: 'Financial History', Icon: Receipt },
          ];
          return (
        <div className="flex rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          {/* Left icon sidebar */}
          <div className="w-12 bg-slate-50 border-r border-slate-100 flex flex-col">
            {TAB_CONFIG.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center justify-center py-5 w-full transition-all border-t border-slate-200 ${
                  activeTab === id ? 'bg-white text-jci-blue' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {activeTab === id && (
                  <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-jci-blue" />
                )}
                <Icon size={18} />
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div className="flex-1 p-4 md:p-6 min-w-0">
            {activeTab === 'items' && (
              <InventoryItemsTab
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                loading={loading}
                error={error}
                filteredItems={filteredItems}
                paginatedItems={paginatedItems}
                members={members ?? []}
                canOperateFinance={canOperateFinance}
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onCheckIn={checkInItem}
                onCheckOut={handleOpenCheckOutModal}
                onAdjustStock={handleOpenStockAdjustment}
                onEdit={(item) => {
                  setSelectedItem(item);
                  setFormVariants(item.variants || []);
                  setEditModalOpen(true);
                }}
                onOpenStockCard={handleOpenStockCard}
              />
            )}

            {activeTab === 'maintenance' && (
              <InventoryMaintenanceTab
                schedules={maintenanceSchedules}
                items={items}
                members={members ?? []}
                loading={loading}
                onCompleteMaintenance={completeMaintenance}
                onSelectSchedule={handleOpenMaintenanceModal}
                onOpenModal={() => handleOpenMaintenanceModal()}
                canOperateFinance={canOperateFinance}
              />
            )}

            {activeTab === 'alerts' && (
              <InventoryAlertsTab
                alerts={alerts}
                items={items}
                loading={loading}
                onAcknowledge={acknowledgeAlert}
                onCheckAlerts={checkAndGenerateAlerts}
                member={member}
                canOperateFinance={canOperateFinance}
              />
            )}

            {activeTab === 'depreciation' && (
              <InventoryDepreciationTab
                items={items}
                loading={loading}
                canOperateFinance={canOperateFinance}
                onUpdateDepreciation={async (itemId) => {
                  try {
                    const { InventoryService } = await import('../../services/inventoryService');
                    await InventoryService.updateItemDepreciation(itemId);
                    showToast('Depreciation updated successfully', 'success');
                  } catch (err) {
                    showToast('Failed to update depreciation', 'error');
                  }
                }}
              />
            )}

            {activeTab === 'finance' && (
              <InventoryFinancialHistoryTab
                transactions={transactions}
                items={items}
              />
            )}
          </div>
        </div>
          );
        })()}
      </LoadingState>

      <InventoryStockAdjustmentModal
        isOpen={canOperateFinance && isAdjustmentModalOpen}
        item={selectedAdjustmentItem}
        onClose={handleCloseStockAdjustment}
        onSubmit={handleStockAdjustment}
      />

      <InventoryStockCardModal
        isOpen={isStockCardModalOpen}
        item={selectedItem}
        movements={stockMovements}
        loading={isHistoryLoading}
        onClose={handleCloseStockCard}
      />

      <InventoryItemModal
        isOpen={canOperateFinance && isAddModalOpen}
        onClose={() => setAddModalOpen(false)}
        mode="add"
        variants={formVariants}
        onSubmit={handleAddItem}
        onAddVariant={addVariant}
        onUpdateVariant={updateVariant}
        onRemoveVariant={removeVariant}
      />

      <InventoryItemModal
        isOpen={canOperateFinance && isEditModalOpen}
        mode="edit"
        item={selectedItem}
        variants={formVariants}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedItem(null);
        }}
        onSubmit={handleEditItem}
        onAddVariant={addVariant}
        onUpdateVariant={updateVariant}
        onRemoveVariant={removeVariant}
      />

      <InventoryCheckOutModal
        isOpen={canOperateFinance && isCheckOutModalOpen}
        item={selectedCheckOutItem}
        members={members ?? []}
        onClose={handleCloseCheckOutModal}
        onSubmit={handleCheckOut}
      />

      <InventoryMaintenanceScheduleModal
        isOpen={canOperateFinance && isMaintenanceModalOpen}
        onClose={handleCloseMaintenanceModal}
        schedule={selectedSchedule}
        items={items}
        members={members ?? []}
        onSave={handleSaveMaintenanceSchedule}
        bottomSheet
        drawerOnMobile
      />
    </div >
  );
};

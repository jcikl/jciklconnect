import React, { useState, useMemo, useEffect } from 'react';
import { Package, Search, AlertCircle, CheckCircle, Plus, Edit, LogOut, LogIn, Wrench, Bell, Calendar, X, TrendingDown, DollarSign, RefreshCw, Trash2, History, BarChart3, ArrowRightLeft } from 'lucide-react';
import { Card, Button, Badge, Modal, useToast, Pagination, Tabs } from '../ui/Common';
import { Input, Select, Textarea } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useInventory } from '../../hooks/useInventory';
import { useMembers } from '../../hooks/useMembers';
import { useAuth } from '../../hooks/useAuth';
import { FinanceService } from '../../services/financeService';
import { InventoryItem, MaintenanceSchedule, InventoryAlert, Transaction, StockMovement } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/formatUtils';

export const InventoryView: React.FC<{ searchQuery?: string }> = ({ searchQuery }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isCheckOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);
  const [activeTab, setActiveTab] = useState<'items' | 'maintenance' | 'alerts' | 'depreciation' | 'finance'>('items');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [formVariants, setFormVariants] = useState<{ size: string; quantity: number }[]>([]);
  const [isAdjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [isStockCardModalOpen, setStockCardModalOpen] = useState(false);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
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
  const { showToast } = useToast();

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

    const fetchTransactions = async () => {
      try {
        const txs = await FinanceService.getAllTransactions();
        setTransactions(txs);
      } catch (err) {
        console.error('Failed to load transactions for history', err);
      }
    };
    fetchTransactions();
  }, [activeTab, loadMaintenanceSchedules, loadAlerts]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      available: items.filter(i => i.status === 'Available').length,
      checkedOut: items.filter(i => i.status === 'Checked Out').length,
      needsAction: items.filter(i => i.status !== 'Available' && i.status !== 'Checked Out').length,
    };
  }, [items]);

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const categoryValue = formData.get('category') as string;
    const validCategories: Array<'Electronics' | 'Furniture' | 'Merchandise' | 'Stationery' | 'Equipment' | 'Supplies' | 'Other'> =
      ['Electronics', 'Furniture', 'Merchandise', 'Stationery', 'Equipment', 'Supplies', 'Other'];

    if (!validCategories.includes(categoryValue as any)) {
      showToast('Invalid category selected', 'error');
      return;
    }

    try {
      const purchasePrice = formData.get('purchasePrice') ? parseFloat(formData.get('purchasePrice') as string) : undefined;
      const purchaseDate = formData.get('purchaseDate') as string || undefined;
      const depreciationMethod = formData.get('depreciationMethod') as 'Straight Line' | 'Declining Balance' | 'Units of Production' | 'None' | undefined;
      const depreciationRate = formData.get('depreciationRate') ? parseFloat(formData.get('depreciationRate') as string) : undefined;
      const usefulLife = formData.get('usefulLife') ? parseInt(formData.get('usefulLife') as string) : undefined;

      const newItem: Omit<InventoryItem, 'id'> = {
        name: formData.get('name') as string,
        category: categoryValue as 'Electronics' | 'Furniture' | 'Merchandise' | 'Stationery' | 'Equipment' | 'Supplies' | 'Other',
        location: formData.get('location') as string,
        quantity: formVariants.length > 0 ? formVariants.reduce((sum, v) => sum + v.quantity, 0) : (() => {
          const q = parseInt(formData.get('quantity') as string);
          return isNaN(q) ? 1 : q;
        })(),
        status: 'Available',
        condition: formData.get('condition') as string || 'Good',
        description: formData.get('description') as string || '',
        purchaseDate,
        purchasePrice,
        depreciationMethod: depreciationMethod || 'None',
        depreciationRate,
        usefulLife,
        variants: formVariants.length > 0 ? formVariants : undefined,
      };

      // Calculate initial current value if depreciation data is provided
      if (purchasePrice && purchaseDate && depreciationMethod && depreciationMethod !== 'None') {
        const { InventoryService } = await import('../../services/inventoryService');
        const tempItem = { ...newItem, id: 'temp' } as InventoryItem;
        const calculatedValue = InventoryService.calculateDepreciation(tempItem);
        newItem.currentValue = calculatedValue;
      } else if (purchasePrice) {
        newItem.currentValue = purchasePrice;
      }

      await createItem(newItem);
      setAddModalOpen(false);
      setFormVariants([]);
      e.currentTarget.reset();
    } catch (err) {
      // Error is handled in the hook
    }
  };

  const handleEditItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItem) return;

    const formData = new FormData(e.currentTarget);

    const categoryValue = formData.get('category') as string;
    const validCategories: Array<'Electronics' | 'Furniture' | 'Merchandise' | 'Stationery' | 'Equipment' | 'Supplies' | 'Other'> =
      ['Electronics', 'Furniture', 'Merchandise', 'Stationery', 'Equipment', 'Supplies', 'Other'];

    if (!validCategories.includes(categoryValue as any)) {
      showToast('Invalid category selected', 'error');
      return;
    }

    try {
      const purchasePrice = formData.get('purchasePrice') ? parseFloat(formData.get('purchasePrice') as string) : undefined;
      const purchaseDate = formData.get('purchaseDate') as string || undefined;
      const depreciationMethod = formData.get('depreciationMethod') as 'Straight Line' | 'Declining Balance' | 'Units of Production' | 'None' | undefined;
      const depreciationRate = formData.get('depreciationRate') ? parseFloat(formData.get('depreciationRate') as string) : undefined;
      const usefulLife = formData.get('usefulLife') ? parseInt(formData.get('usefulLife') as string) : undefined;

      const updates: Partial<InventoryItem> = {
        name: formData.get('name') as string,
        category: categoryValue as 'Electronics' | 'Furniture' | 'Merchandise' | 'Stationery' | 'Equipment' | 'Supplies' | 'Other',
        location: formData.get('location') as string,
        quantity: formVariants.length > 0 ? formVariants.reduce((sum, v) => sum + v.quantity, 0) : (() => {
          const q = parseInt(formData.get('quantity') as string);
          return isNaN(q) ? 1 : q;
        })(),
        condition: formData.get('condition') as string,
        description: formData.get('description') as string || '',
        purchaseDate,
        purchasePrice,
        depreciationMethod: depreciationMethod || 'None',
        depreciationRate,
        usefulLife,
        variants: formVariants.length > 0 ? formVariants : undefined,
      };

      // Recalculate depreciation if depreciation data is provided
      if (purchasePrice && purchaseDate && depreciationMethod && depreciationMethod !== 'None') {
        const { InventoryService } = await import('../../services/inventoryService');
        const tempItem = { ...selectedItem, ...updates } as InventoryItem;
        const calculatedValue = InventoryService.calculateDepreciation(tempItem);
        updates.currentValue = calculatedValue;
      } else if (purchasePrice) {
        updates.currentValue = purchasePrice;
      }

      await updateItem(selectedItem.id, updates);
      setEditModalOpen(false);
      setSelectedItem(null);
      setFormVariants([]);
    } catch (err) {
      // Error is handled in the hook
    }
  };

  const addVariant = () => {
    setFormVariants([...formVariants, { size: '', quantity: 1 }]);
  };

  const updateVariant = (index: number, field: 'size' | 'quantity', value: string | number) => {
    const updated = [...formVariants];
    const finalValue = field === 'quantity' ? parseInt(value.toString()) || 0 : value;
    updated[index] = { ...updated[index], [field]: finalValue };
    setFormVariants(updated);
  };

  const removeVariant = (index: number) => {
    setFormVariants(formVariants.filter((_, i) => i !== index));
  };

  const handleCheckOut = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItem) return;

    const formData = new FormData(e.currentTarget);

    try {
      await checkOutItem(
        selectedItem.id,
        formData.get('memberId') as string,
        formData.get('expectedReturnDate') as string || undefined
      );
      setCheckOutModalOpen(false);
      setSelectedItem(null);
    } catch (err) {
      // Error is handled in the hook
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Asset & Inventory</h2>
          <p className="text-slate-500">Track physical assets, locations, and custodians.</p>
        </div>
        <Button onClick={() => setAddModalOpen(true)}><Plus size={16} className="mr-2" /> Add New Item</Button>
      </div>

      <LoadingState loading={loading} error={error}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-blue-50 border-blue-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-lg text-blue-600 shadow-sm"><Package size={24} /></div>
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Assets</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.total}</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-green-50 border-green-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-lg text-green-600 shadow-sm"><CheckCircle size={24} /></div>
              <div>
                <p className="text-sm text-green-600 font-medium">Available</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.available}</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-amber-50 border-amber-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-lg text-amber-600 shadow-sm"><Package size={24} /></div>
              <div>
                <p className="text-sm text-amber-600 font-medium">Checked Out</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.checkedOut}</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-red-50 border-red-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-lg text-red-600 shadow-sm"><AlertCircle size={24} /></div>
              <div>
                <p className="text-sm text-red-600 font-medium">Action Needed</p>
                <h3 className="text-2xl font-bold text-slate-900">{stats.needsAction}</h3>
              </div>
            </div>
          </Card>
        </div>

        <Card noPadding>
          <div className="px-4 md:px-6 pt-4">
            <Tabs
              tabs={['Items', 'Maintenance', 'Alerts', 'Depreciation', 'Financial History']}
              activeTab={
                activeTab === 'items' ? 'Items' :
                  activeTab === 'maintenance' ? 'Maintenance' :
                    activeTab === 'alerts' ? 'Alerts' :
                      activeTab === 'depreciation' ? 'Depreciation' : 'Financial History'
              }
              onTabChange={(tab) => {
                if (tab === 'Items') setActiveTab('items');
                else if (tab === 'Maintenance') setActiveTab('maintenance');
                else if (tab === 'Alerts') setActiveTab('alerts');
                else if (tab === 'Depreciation') setActiveTab('depreciation');
                else setActiveTab('finance');
              }}
            />
          </div>

          <div className="p-4">
            {activeTab === 'items' && (
              <div className="space-y-4">
                <Card title="Asset Registry">
                  <LoadingState loading={loading} error={error} empty={filteredItems.length === 0} emptyMessage="No inventory items found">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="py-3 px-4">Item Name</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Location</th>
                            <th className="py-3 px-4">Quantity</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Custodian</th>
                            <th className="py-3 px-4">Value</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedItems.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-900">{item.name}</div>
                                {item.variants && item.variants.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.variants.map((v, idx) => (
                                      <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                        {v.size}: {v.quantity}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500">{item.category}</td>
                              <td className="py-3 px-4 text-slate-500">{item.location}</td>
                              <td className="py-3 px-4 text-slate-500">{item.quantity ?? 1}</td>
                              <td className="py-3 px-4">
                                <Badge variant={item.status === 'Available' ? 'success' : item.status === 'Out of Stock' ? 'error' : 'warning'}>
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                {item.custodian ? members.find(m => m.id === item.custodian)?.name || item.custodian : '-'}
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                {item.currentValue !== undefined && item.purchasePrice !== undefined ? (
                                  <div className="text-xs">
                                    <div className="font-medium text-green-600">{formatCurrency(item.currentValue)}</div>
                                    <div className="text-slate-400">of {formatCurrency(item.purchasePrice)}</div>
                                  </div>
                                ) : item.purchasePrice !== undefined ? (
                                  <span className="text-xs text-slate-500">{formatCurrency(item.purchasePrice)}</span>
                                ) : (
                                  <span className="text-xs text-slate-400">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end gap-2">
                                  {item.status === 'Available' ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setCheckOutModalOpen(true);
                                      }}
                                    >
                                      <LogOut size={14} className="mr-1" /> Check Out
                                    </Button>
                                  ) : item.status === 'Checked Out' ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => checkInItem(item.id)}
                                    >
                                      <LogIn size={14} className="mr-1" /> Check In
                                    </Button>
                                  ) : null}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Stock Card"
                                    onClick={async () => {
                                      setSelectedItem(item);
                                      setStockCardModalOpen(true);
                                      setIsHistoryLoading(true);
                                      try {
                                        const { InventoryService } = await import('../../services/inventoryService');
                                        const card = await InventoryService.getStockCard(item.id);
                                        setStockMovements(card);
                                      } catch (err) {
                                        showToast('Failed to load stock card', 'error');
                                      } finally {
                                        setIsHistoryLoading(false);
                                      }
                                    }}
                                  >
                                    <History size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Adjust Stock"
                                    onClick={() => {
                                      setSelectedItem(item);
                                      setAdjustmentModalOpen(true);
                                    }}
                                  >
                                    <RefreshCw size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedItem(item);
                                      setFormVariants(item.variants || []);
                                      setEditModalOpen(true);
                                    }}
                                  >
                                    <Edit size={14} className="mr-1" /> Edit
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-4">
                        <Pagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          totalItems={filteredItems.length}
                          itemsPerPage={itemsPerPage}
                          onPageChange={setCurrentPage}
                        />
                      </div>
                    )}
                  </LoadingState>
                </Card>
              </div>
            )}

            {activeTab === 'maintenance' && (
              <MaintenanceTab
                schedules={maintenanceSchedules}
                items={items}
                members={members ?? []}
                loading={loading}
                onCreateSchedule={createMaintenanceSchedule}
                onUpdateSchedule={updateMaintenanceSchedule}
                onCompleteMaintenance={completeMaintenance}
                onSelectSchedule={setSelectedSchedule}
                onOpenModal={() => setMaintenanceModalOpen(true)}
              />
            )}

            {activeTab === 'alerts' && (
              <AlertsTab
                alerts={alerts}
                items={items}
                loading={loading}
                onAcknowledge={acknowledgeAlert}
                onCheckAlerts={checkAndGenerateAlerts}
                member={member}
              />
            )}

            {activeTab === 'depreciation' && (
              <DepreciationTab
                items={items}
                loading={loading}
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
              <FinancialHistoryTab
                transactions={transactions}
                items={items}
              />
            )}
          </div>
        </Card>
      </LoadingState>

      {/* Stock Adjustment Modal */}
      {selectedItem && (
        <Modal isOpen={isAdjustmentModalOpen} onClose={() => { setAdjustmentModalOpen(false); setSelectedItem(null); }} title={`Stock Adjustment: ${selectedItem.name}`} drawerOnMobile>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            try {
              const { InventoryService } = await import('../../services/inventoryService');
              await InventoryService.adjustStock(
                selectedItem.id,
                formData.get('variant') as string || undefined,
                parseInt(formData.get('adjustment') as string),
                formData.get('reason') as string,
                member?.name || 'Admin'
              );
              showToast('Stock adjusted successfully', 'success');
              await loadItems();
              setAdjustmentModalOpen(false);
              setSelectedItem(null);
            } catch (err) {
              showToast('Failed to adjust stock', 'error');
            }
          }} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg text-sm mb-4">
              <p className="font-medium text-slate-900">Current Total: {selectedItem.quantity}</p>
            </div>

            {selectedItem.variants && selectedItem.variants.length > 0 && (
              <Select name="variant" label="Variant (Optional)" options={[
                { label: 'Base Item', value: '' },
                ...selectedItem.variants.map(v => ({ label: `${v.size} (Current: ${v.quantity})`, value: v.size }))
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

            <div className="pt-4">
              <Button className="w-full" type="submit">Complete Adjustment</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Stock Card (History) Modal */}
      {selectedItem && (
        <Modal
          isOpen={isStockCardModalOpen}
          onClose={() => { setStockCardModalOpen(false); setSelectedItem(null); setStockMovements([]); }}
          title={`Stock Card: ${selectedItem.name}`}
          size="xl"
          drawerOnMobile
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 font-medium uppercase mb-1">Current Stock</p>
                <div className="text-2xl font-bold text-slate-900">{selectedItem.quantity}</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-500 font-medium uppercase mb-1">Total In</p>
                <div className="text-2xl font-bold text-blue-600">
                  {stockMovements.filter(m => m.type === 'In').reduce((sum, m) => sum + m.quantity, 0)}
                </div>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl">
                <p className="text-xs text-orange-500 font-medium uppercase mb-1">Total Out</p>
                <div className="text-2xl font-bold text-orange-600">
                  {Math.abs(stockMovements.filter(m => m.type === 'Out').reduce((sum, m) => sum + m.quantity, 0))}
                </div>
              </div>
            </div>

            <LoadingState loading={isHistoryLoading} error={null} empty={stockMovements.length === 0} emptyMessage="No stock movements recorded.">
              <div className="max-h-[60vh] overflow-y-auto pr-2">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="border-b border-slate-200">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Variant</th>
                      <th className="py-2 px-3">Change</th>
                      <th className="py-2 px-3">Balance</th>
                      <th className="py-2 px-3">Reason</th>
                      <th className="py-2 px-3">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockMovements.map(mov => (
                      <tr key={mov.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 text-slate-500">{formatDate(new Date(mov.date))}</td>
                        <td className="py-3 px-3">
                          <Badge variant={mov.type === 'In' ? 'success' : mov.type === 'Out' ? 'warning' : 'info'}>
                            {mov.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{mov.variant || '-'}</td>
                        <td className={`py-3 px-3 font-bold ${mov.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                        </td>
                        <td className="py-3 px-3 font-medium">{mov.newQuantity}</td>
                        <td className="py-3 px-3 text-slate-600">{mov.reason}</td>
                        <td className="py-3 px-3 text-slate-500">{mov.performedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </LoadingState>
          </div>
        </Modal>
      )}

      {/* Add Item Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="Add Inventory Item" drawerOnMobile>
        <form onSubmit={handleAddItem} className="space-y-4">
          <Input name="name" label="Item Name" placeholder="e.g. Projector" required />
          <Select name="category" label="Category" options={[
            { label: 'Electronics', value: 'Electronics' },
            { label: 'Furniture', value: 'Furniture' },
            { label: 'Merchandise', value: 'Merchandise' },
            { label: 'Stationery', value: 'Stationery' },
            { label: 'Equipment', value: 'Equipment' },
            { label: 'Supplies', value: 'Supplies' },
            { label: 'Other', value: 'Other' },
          ]} required />
          <Input name="location" label="Location" placeholder="e.g. Storage Room A" required />
          <div className="grid grid-cols-2 gap-4">
            {formVariants.length > 0 ? (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Total Quantity</label>
                <div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-slate-600">
                  {formVariants.reduce((sum, v) => sum + v.quantity, 0)}
                </div>
                <input type="hidden" name="quantity" value={formVariants.reduce((sum, v) => sum + v.quantity, 0)} />
              </div>
            ) : (
              <Input name="quantity" label="Quantity" type="number" defaultValue="1" required />
            )}
            <Select name="condition" label="Condition" options={[
              { label: 'Excellent', value: 'Excellent' },
              { label: 'Good', value: 'Good' },
              { label: 'Fair', value: 'Fair' },
              { label: 'Poor', value: 'Poor' },
            ]} defaultValue="Good" required />
          </div>
          <Textarea name="description" label="Description" placeholder="Additional notes..." />

          {/* Variants Management */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-slate-900">Variants (e.g. Sizes)</h4>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus size={14} className="mr-1" /> Add Variant
              </Button>
            </div>

            {formVariants.length > 0 ? (
              <div className="space-y-3">
                {formVariants.map((variant, index) => (
                  <div key={index} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Input
                        label={index === 0 ? "Size/Specs" : ""}
                        value={variant.size}
                        onChange={(e) => updateVariant(index, 'size', e.target.value)}
                        placeholder="e.g. M, L, Blue"
                        required
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        label={index === 0 ? "Qty" : ""}
                        value={variant.quantity.toString()}
                        onChange={(e) => updateVariant(index, 'quantity', e.target.value)}
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariant(index)}
                      className="text-red-500 hover:text-red-700 h-10"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No variants added. Using base quantity instead.</p>
            )}
          </div>

          {/* Depreciation Tracking Section */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Depreciation Tracking (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input name="purchaseDate" label="Purchase Date" type="date" />
              <Input name="purchasePrice" label="Purchase Price (RM)" type="number" step="0.01" placeholder="0.00" />
            </div>
            <Select name="depreciationMethod" label="Depreciation Method" options={[
              { label: 'None', value: 'None' },
              { label: 'Straight Line', value: 'Straight Line' },
              { label: 'Declining Balance', value: 'Declining Balance' },
              { label: 'Units of Production', value: 'Units of Production' },
            ]} defaultValue="None" />
            <div className="grid grid-cols-2 gap-4">
              <Input name="depreciationRate" label="Depreciation Rate (% per year)" type="number" step="0.1" placeholder="20" />
              <Input name="usefulLife" label="Useful Life (Years)" type="number" min="1" placeholder="5" />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Current value will be automatically calculated based on depreciation method and elapsed time.
            </p>
          </div>

          <div className="pt-4">
            <Button className="w-full" type="submit">Add Item</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Item Modal */}
      {selectedItem && (
        <Modal isOpen={isEditModalOpen} onClose={() => { setEditModalOpen(false); setSelectedItem(null); }} title="Edit Inventory Item" drawerOnMobile>
          <form onSubmit={handleEditItem} className="space-y-4">
            <Input name="name" label="Item Name" defaultValue={selectedItem.name} required />
            <Select name="category" label="Category" options={[
              { label: 'Electronics', value: 'Electronics' },
              { label: 'Furniture', value: 'Furniture' },
              { label: 'Merchandise', value: 'Merchandise' },
              { label: 'Stationery', value: 'Stationery' },
              { label: 'Equipment', value: 'Equipment' },
              { label: 'Supplies', value: 'Supplies' },
              { label: 'Other', value: 'Other' },
            ]} defaultValue={selectedItem.category} required />
            <Input name="location" label="Location" defaultValue={selectedItem.location} required />
            <div className="grid grid-cols-2 gap-4">
              {formVariants.length > 0 ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Total Quantity</label>
                  <div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-slate-600">
                    {formVariants.reduce((sum, v) => sum + v.quantity, 0)}
                  </div>
                  <input type="hidden" name="quantity" value={formVariants.reduce((sum, v) => sum + v.quantity, 0)} />
                </div>
              ) : (
                <Input name="quantity" label="Quantity" type="number" defaultValue={selectedItem.quantity?.toString() || '1'} required />
              )}
              <Select name="condition" label="Condition" options={[
                { label: 'Excellent', value: 'Excellent' },
                { label: 'Good', value: 'Good' },
                { label: 'Fair', value: 'Fair' },
                { label: 'Poor', value: 'Poor' },
              ]} defaultValue={selectedItem.condition || 'Good'} required />
            </div>
            <Textarea name="description" label="Description" defaultValue={selectedItem.description || ''} />

            {/* Variants Management */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-semibold text-slate-900">Variants (e.g. Sizes)</h4>
                <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                  <Plus size={14} className="mr-1" /> Add Variant
                </Button>
              </div>

              {formVariants.length > 0 ? (
                <div className="space-y-3">
                  {formVariants.map((variant, index) => (
                    <div key={index} className="flex gap-3 items-end">
                      <div className="flex-1">
                        <Input
                          label={index === 0 ? "Size/Specs" : ""}
                          value={variant.size}
                          onChange={(e) => updateVariant(index, 'size', e.target.value)}
                          placeholder="e.g. M, L, Blue"
                          required
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          label={index === 0 ? "Qty" : ""}
                          value={variant.quantity.toString()}
                          onChange={(e) => updateVariant(index, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(index)}
                        className="text-red-500 hover:text-red-700 h-10"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No variants added. Using base quantity instead.</p>
              )}
            </div>

            {/* Depreciation Tracking Section */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Depreciation Tracking</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input name="purchaseDate" label="Purchase Date" type="date" defaultValue={selectedItem.purchaseDate || ''} />
                <Input name="purchasePrice" label="Purchase Price (RM)" type="number" step="0.01" defaultValue={selectedItem.purchasePrice?.toString() || ''} placeholder="0.00" />
              </div>
              <Select name="depreciationMethod" label="Depreciation Method" options={[
                { label: 'None', value: 'None' },
                { label: 'Straight Line', value: 'Straight Line' },
                { label: 'Declining Balance', value: 'Declining Balance' },
                { label: 'Units of Production', value: 'Units of Production' },
              ]} defaultValue={selectedItem.depreciationMethod || 'None'} />
              <div className="grid grid-cols-2 gap-4">
                <Input name="depreciationRate" label="Depreciation Rate (% per year)" type="number" step="0.1" defaultValue={selectedItem.depreciationRate?.toString() || ''} placeholder="20" />
                <Input name="usefulLife" label="Useful Life (Years)" type="number" min="1" defaultValue={selectedItem.usefulLife?.toString() || ''} placeholder="5" />
              </div>
              {selectedItem.currentValue !== undefined && selectedItem.purchasePrice !== undefined && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Purchase Price:</span>
                    <span className="font-semibold text-slate-900">RM {selectedItem.purchasePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-600">Current Value:</span>
                    <span className="font-semibold text-green-600">RM {selectedItem.currentValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-slate-600">Total Depreciation:</span>
                    <span className="font-semibold text-red-600">RM {(selectedItem.purchasePrice - selectedItem.currentValue).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4">
              <Button className="w-full" type="submit">Update Item</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Check Out Modal */}
      {selectedItem && (
        <Modal isOpen={isCheckOutModalOpen} onClose={() => { setCheckOutModalOpen(false); setSelectedItem(null); }} title="Check Out Item" drawerOnMobile>
          <form onSubmit={handleCheckOut} className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">Checking out: <strong>{selectedItem.name}</strong></p>
            <Select name="memberId" label="Assign To" options={[
              { label: 'Select member...', value: '' },
              ...members.map(m => ({ label: m.name, value: m.id })),
            ]} required />
            <Input name="expectedReturnDate" label="Expected Return Date" type="date" />
            <div className="pt-4">
              <Button className="w-full" type="submit">Check Out</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Maintenance Schedule Modal */}
      {isMaintenanceModalOpen && (
        <MaintenanceScheduleModal
          isOpen={true}
          onClose={() => {
            setMaintenanceModalOpen(false);
            setSelectedSchedule(null);
          }}
          schedule={selectedSchedule}
          items={items}
          members={members ?? []}
          onSave={async (scheduleData) => {
            try {
              if (selectedSchedule) {
                await updateMaintenanceSchedule(selectedSchedule.id, scheduleData);
                showToast('Maintenance schedule updated', 'success');
              } else {
                await createMaintenanceSchedule(scheduleData);
                showToast('Maintenance schedule created', 'success');
              }
              await loadMaintenanceSchedules();
              setMaintenanceModalOpen(false);
              setSelectedSchedule(null);
            } catch (err) {
              showToast('Failed to save maintenance schedule', 'error');
            }
          }}
          drawerOnMobile
        />
      )}
    </div>
  );
};

// Maintenance Tab Component
interface MaintenanceTabProps {
  schedules: MaintenanceSchedule[];
  items: InventoryItem[];
  members: any[];
  loading: boolean;
  onCreateSchedule: (schedule: Omit<MaintenanceSchedule, 'id'>) => Promise<string | void>;
  onUpdateSchedule: (scheduleId: string, updates: Partial<MaintenanceSchedule>) => Promise<void>;
  onCompleteMaintenance: (scheduleId: string, notes?: string) => Promise<void>;
  onSelectSchedule: (schedule: MaintenanceSchedule) => void;
  onOpenModal: () => void;
}

const MaintenanceTab: React.FC<MaintenanceTabProps> = ({
  schedules,
  items,
  members,
  loading,
  onCreateSchedule,
  onUpdateSchedule,
  onCompleteMaintenance,
  onSelectSchedule,
  onOpenModal,
}) => {
  const { showToast } = useToast();
  const { member } = useAuth();

  const handleCompleteMaintenance = async (scheduleId: string) => {
    try {
      await onCompleteMaintenance(scheduleId);
      showToast('Maintenance completed', 'success');
    } catch (err) {
      showToast('Failed to complete maintenance', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900">Maintenance Schedules</h3>
        <Button onClick={onOpenModal}>
          <Plus size={16} className="mr-2" />
          Schedule Maintenance
        </Button>
      </div>

      <LoadingState loading={loading} error={null} empty={schedules.length === 0} emptyMessage="No maintenance schedules">
        <div className="space-y-3">
          {schedules.map(schedule => {
            const scheduleId = schedule.id ?? `maint-${schedule.itemId}-${schedule.scheduledDate ?? ''}`;
            const item = items.find(i => i.id === schedule.itemId);
            const nextDate = schedule.nextMaintenanceDate ? new Date(schedule.nextMaintenanceDate) : null;
            const isOverdue = nextDate && nextDate < new Date();
            const daysUntil = nextDate ? Math.ceil((nextDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

            return (
              <Card key={scheduleId} className="hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench size={16} className="text-slate-400" />
                      <h4 className="font-semibold text-slate-900">{item?.name || 'Unknown Item'}</h4>
                      <Badge variant={isOverdue ? 'error' : daysUntil != null && daysUntil <= 7 ? 'warning' : 'info'}>
                        {schedule.type}{schedule.frequency ? ` - ${schedule.frequency}` : ''}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                      <div>
                        <span className="font-medium">Next Maintenance:</span>{' '}
                        {nextDate ? formatDate(nextDate) : 'Not scheduled'}
                        {daysUntil !== null && (
                          <span className={`ml-2 ${isOverdue ? 'text-red-600 font-semibold' : daysUntil <= 7 ? 'text-amber-600' : ''}`}>
                            ({isOverdue ? `${Math.abs(daysUntil)} days overdue` : `${daysUntil} days`})
                          </span>
                        )}
                      </div>
                      {schedule.lastMaintained && (
                        <div>
                          <span className="font-medium">Last Maintained:</span>{' '}
                          {formatDate(new Date(schedule.lastMaintained))}
                        </div>
                      )}
                      {schedule.assignedTo && (
                        <div>
                          <span className="font-medium">Assigned To:</span>{' '}
                          {(members ?? []).find(m => m.id === schedule.assignedTo)?.name || schedule.assignedTo}
                        </div>
                      )}
                    </div>
                    {schedule.notes && (
                      <p className="text-sm text-slate-500 mt-2">{schedule.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {!isOverdue && schedule.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCompleteMaintenance(schedule.id)}
                      >
                        <CheckCircle size={14} className="mr-1" />
                        Complete
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onSelectSchedule(schedule);
                        onOpenModal();
                      }}
                    >
                      <Edit size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </LoadingState>
    </div>
  );
};

// Alerts Tab Component
interface AlertsTabProps {
  alerts: InventoryAlert[];
  items: InventoryItem[];
  loading: boolean;
  onAcknowledge: (alertId: string, acknowledgedBy: string) => Promise<void>;
  onCheckAlerts: () => Promise<void>;
  member: any;
}

const AlertsTab: React.FC<AlertsTabProps> = ({
  alerts,
  items,
  loading,
  onAcknowledge,
  onCheckAlerts,
  member,
}) => {
  const { showToast } = useToast();
  const [checkingAlerts, setCheckingAlerts] = useState(false);

  const handleAcknowledge = async (alertId: string) => {
    if (!member) {
      showToast('Please login to acknowledge alerts', 'error');
      return;
    }
    try {
      await onAcknowledge(alertId, member.id);
      showToast('Alert acknowledged', 'success');
    } catch (err) {
      showToast('Failed to acknowledge alert', 'error');
    }
  };

  const handleCheckAlerts = async () => {
    setCheckingAlerts(true);
    try {
      await onCheckAlerts();
      showToast('Alerts checked and updated', 'success');
    } catch (err) {
      showToast('Failed to check alerts', 'error');
    } finally {
      setCheckingAlerts(false);
    }
  };

  const getSeverityColor = (severity: InventoryAlert['severity']) => {
    switch (severity) {
      case 'Critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'High': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900">Inventory Alerts</h3>
        <Button variant="outline" onClick={handleCheckAlerts} disabled={checkingAlerts}>
          <Bell size={16} className="mr-2" />
          {checkingAlerts ? 'Checking...' : 'Check for Alerts'}
        </Button>
      </div>

      <LoadingState loading={loading} error={null} empty={alerts.length === 0} emptyMessage="No alerts">
        <div className="space-y-3">
          {alerts.map(alert => {
            const alertKey = alert.id ?? `alert-${alert.itemId}-${alert.createdAt}`;
            const item = items.find(i => i.id === alert.itemId);
            return (
              <Card key={alertKey} className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={16} className={alert.severity === 'Critical' ? 'text-red-600' : 'text-amber-600'} />
                      <h4 className="font-semibold text-slate-900">{alert.type}</h4>
                      <Badge variant={alert.severity === 'Critical' ? 'error' : alert.severity === 'High' ? 'warning' : 'info'}>
                        {alert.severity}
                      </Badge>
                      {alert.acknowledged && (
                        <Badge variant="success">Acknowledged</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{alert.message}</p>
                    <div className="text-xs text-slate-500">
                      {item && <span>Item: {item.name} • </span>}
                      Created: {formatDate(new Date(alert.createdAt))}
                      {alert.acknowledgedAt && (
                        <> • Acknowledged: {formatDate(new Date(alert.acknowledgedAt))}</>
                      )}
                    </div>
                  </div>
                  {!alert.acknowledged && member && alert.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcknowledge(alert.id)}
                    >
                      <CheckCircle size={14} className="mr-1" />
                      Acknowledge
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </LoadingState>
    </div>
  );
};

// Maintenance Schedule Modal Component
interface MaintenanceScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: MaintenanceSchedule | null;
  items: InventoryItem[];
  members: any[];
  onSave: (schedule: Omit<MaintenanceSchedule, 'id'>) => Promise<string | void>;
  drawerOnMobile?: boolean;
}

const MaintenanceScheduleModal: React.FC<MaintenanceScheduleModalProps> = ({
  isOpen,
  onClose,
  schedule,
  items,
  members,
  onSave,
  drawerOnMobile,
}) => {
  const [formData, setFormData] = useState({
    itemId: schedule?.itemId || '',
    type: (schedule?.type || 'Preventive') as 'Preventive' | 'Corrective' | 'Inspection' | 'Calibration',
    frequency: schedule?.frequency || 'Monthly',
    customDays: schedule?.customDays || undefined,
    assignedTo: schedule?.assignedTo || '',
    notes: schedule?.notes || '',
    active: schedule?.active !== undefined ? schedule.active : true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave({
        ...formData,
        lastMaintained: schedule?.lastMaintained,
        nextMaintenanceDate: schedule?.nextMaintenanceDate || new Date().toISOString(),
      });
    } catch (err) {
      // Error handled in parent
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={schedule ? 'Edit Maintenance Schedule' : 'Create Maintenance Schedule'} drawerOnMobile={drawerOnMobile}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Item"
          value={formData.itemId}
          onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
          options={[
            { label: 'Select item...', value: '' },
            ...items.map(item => ({ label: item.name, value: item.id })),
          ]}
          required
        />
        <Select
          label="Maintenance Type"
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Preventive' | 'Corrective' | 'Inspection' | 'Calibration' })}
          options={[
            { label: 'Preventive', value: 'Preventive' },
            { label: 'Corrective', value: 'Corrective' },
            { label: 'Inspection', value: 'Inspection' },
            { label: 'Calibration', value: 'Calibration' },
          ]}
          required
        />
        <Select
          label="Frequency"
          value={formData.frequency}
          onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
          options={[
            { label: 'Daily', value: 'Daily' },
            { label: 'Weekly', value: 'Weekly' },
            { label: 'Monthly', value: 'Monthly' },
            { label: 'Quarterly', value: 'Quarterly' },
            { label: 'Semi-Annual', value: 'Semi-Annual' },
            { label: 'Annual', value: 'Annual' },
            { label: 'Custom', value: 'Custom' },
          ]}
          required
        />
        {formData.frequency === 'Custom' && (
          <Input
            label="Custom Days"
            type="number"
            value={formData.customDays?.toString() || ''}
            onChange={(e) => setFormData({ ...formData, customDays: parseInt(e.target.value) || undefined })}
            placeholder="Number of days"
            required
          />
        )}
        <Select
          label="Assigned To (Optional)"
          value={formData.assignedTo}
          onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
          options={[
            { label: 'Unassigned', value: '' },
            ...members.map(m => ({ label: m.name, value: m.id })),
          ]}
        />
        <Textarea
          label="Notes (Optional)"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={3}
        />
        <div className="flex gap-3 pt-4">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1">Save Schedule</Button>
        </div>
      </form>
    </Modal>
  );
};

// Depreciation Tab Component
interface DepreciationTabProps {
  items: InventoryItem[];
  loading: boolean;
  onUpdateDepreciation: (itemId: string) => Promise<void>;
}

const DepreciationTab: React.FC<DepreciationTabProps> = ({
  items,
  loading,
  onUpdateDepreciation,
}) => {
  const { showToast } = useToast();
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  const itemsWithDepreciation = useMemo(() => {
    return items.filter(item => item.purchasePrice && item.purchaseDate);
  }, [items]);

  const handleUpdateDepreciation = async (itemId: string) => {
    setUpdatingItems(prev => new Set(prev).add(itemId));
    try {
      await onUpdateDepreciation(itemId);
    } catch (err) {
      showToast('Failed to update depreciation', 'error');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleUpdateAllDepreciation = async () => {
    setUpdatingItems(new Set(itemsWithDepreciation.map(item => item.id)));
    try {
      await Promise.all(itemsWithDepreciation.map(item => onUpdateDepreciation(item.id)));
      showToast('All depreciation values updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update some depreciation values', 'error');
    } finally {
      setUpdatingItems(new Set());
    }
  };

  const totalPurchaseValue = itemsWithDepreciation.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
  const totalCurrentValue = itemsWithDepreciation.reduce((sum, item) => sum + (item.currentValue || item.purchasePrice || 0), 0);
  const totalDepreciation = totalPurchaseValue - totalCurrentValue;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Depreciation Tracking</h3>
          <p className="text-sm text-slate-500">Track asset depreciation and current values</p>
        </div>
        {itemsWithDepreciation.length > 0 && (
          <Button variant="outline" onClick={handleUpdateAllDepreciation} disabled={updatingItems.size > 0}>
            <RefreshCw size={16} className="mr-2" />
            {updatingItems.size > 0 ? 'Updating...' : 'Update All Depreciation'}
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-100">
          <div className="flex items-center gap-3">
            <DollarSign size={24} className="text-blue-600" />
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Purchase Value</p>
              <h3 className="text-xl font-bold text-slate-900">{formatCurrency(totalPurchaseValue)}</h3>
            </div>
          </div>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <div className="flex items-center gap-3">
            <TrendingDown size={24} className="text-green-600" />
            <div>
              <p className="text-sm text-green-600 font-medium">Total Current Value</p>
              <h3 className="text-xl font-bold text-slate-900">{formatCurrency(totalCurrentValue)}</h3>
            </div>
          </div>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <div className="flex items-center gap-3">
            <TrendingDown size={24} className="text-red-600" />
            <div>
              <p className="text-sm text-red-600 font-medium">Total Depreciation</p>
              <h3 className="text-xl font-bold text-slate-900">{formatCurrency(totalDepreciation)}</h3>
            </div>
          </div>
        </Card>
      </div>

      <LoadingState loading={loading} error={null} empty={itemsWithDepreciation.length === 0} emptyMessage="No items with depreciation tracking">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Purchase Date</th>
                  <th className="py-3 px-4">Purchase Price</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Current Value</th>
                  <th className="py-3 px-4">Depreciation</th>
                  <th className="py-3 px-4">Depreciation %</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemsWithDepreciation.map(item => {
                  const depreciationAmount = (item.purchasePrice || 0) - (item.currentValue || item.purchasePrice || 0);
                  const depreciationPercent = item.purchasePrice ? (depreciationAmount / item.purchasePrice) * 100 : 0;
                  const isUpdating = updatingItems.has(item.id);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                      <td className="py-3 px-4 text-slate-500">{item.purchaseDate ? formatDate(new Date(item.purchaseDate)) : 'N/A'}</td>
                      <td className="py-3 px-4 text-slate-900 font-medium">{formatCurrency(item.purchasePrice || 0)}</td>
                      <td className="py-3 px-4">
                        <Badge variant="neutral">{item.depreciationMethod || 'None'}</Badge>
                      </td>
                      <td className="py-3 px-4 text-green-600 font-medium">
                        {formatCurrency(item.currentValue || item.purchasePrice || 0)}
                      </td>
                      <td className="py-3 px-4 text-red-600">{formatCurrency(depreciationAmount)}</td>
                      <td className="py-3 px-4">
                        <span className={`font-medium ${depreciationPercent > 50 ? 'text-red-600' : depreciationPercent > 25 ? 'text-amber-600' : 'text-green-600'}`}>
                          {depreciationPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateDepreciation(item.id)}
                          disabled={isUpdating}
                        >
                          <RefreshCw size={14} className={`mr-1 ${isUpdating ? 'animate-spin' : ''}`} />
                          {isUpdating ? 'Updating...' : 'Update'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </LoadingState>







    </div >
  );
};

// Financial History Tab Component
interface FinancialHistoryTabProps {
  transactions: Transaction[];
  items: InventoryItem[];
}

const FinancialHistoryTab: React.FC<FinancialHistoryTabProps> = ({ transactions, items }) => {
  const linkedTransactions = React.useMemo(() => {
    return transactions.filter(tx => tx.inventoryLinkId).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [transactions]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900">Inventory Transaction History</h3>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Variant</th>
                <th className="py-3 px-4">Qty</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linkedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    No linked financial transactions found.
                  </td>
                </tr>
              ) : (
                linkedTransactions.map(tx => {
                  const item = items.find(i => i.id === tx.inventoryLinkId);
                  const isStockIn = tx.type === 'Expense'; // Purchase increases stock
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-600">{formatDate(new Date(tx.date))}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{item?.name || 'Unknown Item'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={isStockIn ? 'success' : 'warning'}>
                          {isStockIn ? 'Restock' : 'Sale'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{tx.inventoryVariant || '-'}</td>
                      <td className={`py-3 px-4 font-bold ${isStockIn ? 'text-green-600' : 'text-orange-600'}`}>
                        {isStockIn ? '+' : '-'}{tx.inventoryQuantity || 0}
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-medium">{formatCurrency(tx.amount)}</td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant="neutral">{tx.status}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>









    </div>
  );
};
import React, { useState, useMemo, useEffect } from 'react';
import { Package, Search, AlertCircle, CheckCircle, Plus, Edit, LogOut, LogIn, Wrench, Bell, Calendar, X, TrendingDown, DollarSign, RefreshCw, Trash2, History, BarChart3, ArrowRightLeft } from 'lucide-react';
import { Card, StatCard, StatCardsContainer, Button, Badge, Modal, useToast, Pagination, Tabs, PageHeader } from '../ui/Common';
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

  const handleOpenStockCard = async (item: InventoryItem) => {
    setSelectedItem(item);
    setStockCardModalOpen(true);
    setIsHistoryLoading(true);
    try {
      const { InventoryService } = await import('../../services/inventoryService');
      const card = await InventoryService.getStockCard(item.id);
      setStockMovements(card);
    } catch {
      showToast('Failed to load stock card', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <PageHeader
        title="Asset & Inventory"
        description="Track physical assets, locations, and custodians."
        action={
          <Button onClick={() => setAddModalOpen(true)} size="sm">
            <Plus size={15} className="mr-1.5" /> Add Item
          </Button>
        }
      />

      <LoadingState loading={loading} error={error}>
        {/* KPI Strip */}
        <StatCardsContainer>
          <StatCard title="Total Assets" value={stats.total} icon={<Package size={18} />} iconColor="blue" />
          <StatCard title="Available" value={stats.available} icon={<CheckCircle size={18} />} iconColor="green" />
          <StatCard title="Checked Out" value={stats.checkedOut} icon={<LogOut size={18} />} iconColor="amber" />
          <StatCard title="Action Needed" value={stats.needsAction} icon={<AlertCircle size={18} />} iconColor="red" />
        </StatCardsContainer>

        {/* Main Content */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="px-4 md:px-6 pt-4 border-b border-slate-100">
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

          <div className="p-4 md:p-6">
            {activeTab === 'items' && (
              <div className="space-y-3">
                {/* Search bar */}
                <Input
                  icon={<Search size={14} />}
                  placeholder="Search by name, category, location…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />

                <LoadingState loading={loading} error={error} empty={filteredItems.length === 0} emptyMessage="No inventory items found">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold text-xs">Item</th>
                          <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Category</th>
                          <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Location</th>
                          <th className="py-2.5 px-3 font-semibold text-xs text-center whitespace-nowrap">Qty</th>
                          <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Status</th>
                          <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Custodian</th>
                          <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Value</th>
                          <th className="py-2.5 px-3 font-semibold text-xs text-right whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedItems.map(item => {
                          const rowColor = item.status === 'Available' ? 'border-l-green-400' : item.status === 'Checked Out' ? 'border-l-amber-400' : 'border-l-red-400';
                          const custodianName = item.custodian ? members.find(m => m.id === item.custodian)?.name || item.custodian : '—';
                          return (
                            <tr key={item.id} className={`border-l-2 ${rowColor} hover:bg-slate-50/60 transition-colors`}>
                              <td className="py-2.5 px-3 max-w-[200px]">
                                <div className="font-semibold text-xs text-slate-900 truncate">{item.name}</div>
                                {item.variants && item.variants.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.variants.map((v, idx) => (
                                      <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                        {v.size}: {v.quantity}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{item.category}</td>
                              <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{item.location || '—'}</td>
                              <td className="py-2.5 px-3 text-xs font-semibold text-slate-700 text-center">{item.quantity ?? 1}</td>
                              <td className="py-2.5 px-3">
                                <Badge variant={item.status === 'Available' ? 'success' : item.status === 'Out of Stock' ? 'error' : 'warning'} className="text-[10px]">
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap max-w-[120px] truncate">{custodianName}</td>
                              <td className="py-2.5 px-3">
                                {item.currentValue !== undefined && item.purchasePrice !== undefined ? (
                                  <div>
                                    <div className="text-xs font-semibold text-green-600">{formatCurrency(item.currentValue)}</div>
                                    <div className="text-[10px] text-slate-400">of {formatCurrency(item.purchasePrice)}</div>
                                  </div>
                                ) : item.purchasePrice !== undefined ? (
                                  <span className="text-xs text-slate-500">{formatCurrency(item.purchasePrice)}</span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex justify-end items-center gap-0.5">
                                  {item.status === 'Available' ? (
                                    <button onClick={() => { setSelectedItem(item); setCheckOutModalOpen(true); }} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors whitespace-nowrap">
                                      <LogOut size={11} /> Out
                                    </button>
                                  ) : item.status === 'Checked Out' ? (
                                    <button onClick={() => checkInItem(item.id)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-colors whitespace-nowrap">
                                      <LogIn size={11} /> In
                                    </button>
                                  ) : null}
                                  <button title="Stock Card" onClick={() => handleOpenStockCard(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                    <History size={13} />
                                  </button>
                                  <button title="Adjust Stock" onClick={() => { setSelectedItem(item); setAdjustmentModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                    <RefreshCw size={13} />
                                  </button>
                                  <button title="Edit" onClick={() => { setSelectedItem(item); setFormVariants(item.variants || []); setEditModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                    <Edit size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {paginatedItems.map(item => {
                      const barColor = item.status === 'Available' ? 'bg-green-400' : item.status === 'Checked Out' ? 'bg-amber-400' : 'bg-red-400';
                      const custodianName = item.custodian ? members.find(m => m.id === item.custodian)?.name || item.custodian : null;
                      return (
                        <div key={item.id} className="relative bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
                          <div className="pl-4 pr-3 pt-3 pb-3">
                            {/* Name + Status */}
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span className="font-semibold text-slate-900 text-sm leading-snug">{item.name}</span>
                              <Badge variant={item.status === 'Available' ? 'success' : item.status === 'Out of Stock' ? 'error' : 'warning'} className="text-[10px] shrink-0">
                                {item.status}
                              </Badge>
                            </div>
                            {/* Meta row */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mb-1.5">
                              <span>{item.category}</span>
                              {item.location && <><span className="text-slate-300">·</span><span>{item.location}</span></>}
                              <span className="text-slate-300">·</span>
                              <span>Qty <span className="font-semibold text-slate-700">{item.quantity ?? 1}</span></span>
                              {item.purchasePrice !== undefined && (
                                <><span className="text-slate-300">·</span><span className="font-medium text-slate-600">{formatCurrency(item.currentValue ?? item.purchasePrice)}</span></>
                              )}
                            </div>
                            {/* Variants */}
                            {item.variants && item.variants.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {item.variants.map((v, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    {v.size}: {v.quantity}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Footer: custodian + actions */}
                            <div className="flex items-center justify-between gap-2 mt-2">
                              <span className="text-[11px] text-slate-400 truncate">{custodianName || ''}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {item.status === 'Available' ? (
                                  <button onClick={() => { setSelectedItem(item); setCheckOutModalOpen(true); }} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
                                    <LogOut size={11} /> Out
                                  </button>
                                ) : item.status === 'Checked Out' ? (
                                  <button onClick={() => checkInItem(item.id)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
                                    <LogIn size={11} /> In
                                  </button>
                                ) : null}
                                <button title="Stock Card" onClick={() => handleOpenStockCard(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                  <History size={13} />
                                </button>
                                <button title="Adjust" onClick={() => { setSelectedItem(item); setAdjustmentModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                  <RefreshCw size={13} />
                                </button>
                                <button title="Edit" onClick={() => { setSelectedItem(item); setFormVariants(item.variants || []); setEditModalOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                  <Edit size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
        </div>
      </LoadingState>

      {/* Stock Adjustment Modal */}
      {selectedItem && (
        <Modal
          isOpen={isAdjustmentModalOpen}
          onClose={() => { setAdjustmentModalOpen(false); setSelectedItem(null); }}
          title={`Stock Adjustment: ${selectedItem.name}`}
          bottomSheet
          drawerOnMobile
          footer={<Button className="w-full" type="submit" form="stock-adjustment-form">Complete Adjustment</Button>}
        >
          <form id="stock-adjustment-form" onSubmit={async (e) => {
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
          </form>
        </Modal>
      )}

      {/* Stock Card (History) Modal */}
      {
        selectedItem && (
          <Modal
            isOpen={isStockCardModalOpen}
            onClose={() => { setStockCardModalOpen(false); setSelectedItem(null); setStockMovements([]); }}
            title={`Stock Card: ${selectedItem.name}`}
            size="xl"
            bottomSheet
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
        )
      }

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Inventory Item"
        bottomSheet
        drawerOnMobile
        footer={<Button className="w-full" type="submit" form="add-item-form">Add Item</Button>}
      >
        <form id="add-item-form" onSubmit={handleAddItem} className="space-y-4">
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
          </div>
        </form>
      </Modal>

      {/* Edit Item Modal */}
      {
        selectedItem && (
          <Modal
            isOpen={isEditModalOpen}
            onClose={() => { setEditModalOpen(false); setSelectedItem(null); }}
            title="Edit Inventory Item"
            bottomSheet
            drawerOnMobile
            footer={<Button className="w-full" type="submit" form="edit-item-form">Update Item</Button>}
          >
            <form id="edit-item-form" onSubmit={handleEditItem} className="space-y-4">
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
              </div>
            </form>
          </Modal>
        )
      }

      {/* Check Out Modal */}
      {selectedItem && (
        <Modal
          isOpen={isCheckOutModalOpen}
          onClose={() => { setCheckOutModalOpen(false); setSelectedItem(null); }}
          title="Check Out Item"
          bottomSheet
          drawerOnMobile
          footer={<Button className="w-full" type="submit" form="checkout-form">Check Out</Button>}
        >
          <form id="checkout-form" onSubmit={handleCheckOut} className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">Checking out: <strong>{selectedItem.name}</strong></p>
            <Select name="memberId" label="Assign To" options={[
              { label: 'Select member...', value: '' },
              ...members.map(m => ({ label: m.name, value: m.id })),
            ]} required />
            <Input name="expectedReturnDate" label="Expected Return Date" type="date" />
            <div className="pt-4">
            </div>
          </form>
        </Modal>
      )}

      {/* Maintenance Schedule Modal */}
      {
        isMaintenanceModalOpen && (
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
            bottomSheet
            drawerOnMobile
          />
        )
      }
    </div >
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
        <Button onClick={onOpenModal} size="sm">
          <Plus size={15} className="mr-1.5" />
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

  const severityBar = (s: InventoryAlert['severity']) => {
    switch (s) {
      case 'Critical': return 'bg-red-500';
      case 'High':     return 'bg-orange-400';
      case 'Medium':   return 'bg-amber-400';
      case 'Low':      return 'bg-blue-400';
      default:         return 'bg-slate-300';
    }
  };
  const severityBadge = (s: InventoryAlert['severity']): 'error' | 'warning' | 'info' | 'neutral' =>
    s === 'Critical' ? 'error' : s === 'High' ? 'warning' : s === 'Low' ? 'info' : 'neutral';

  const activeAlerts   = alerts.filter(a => !a.acknowledged);
  const criticalCount  = activeAlerts.filter(a => a.severity === 'Critical').length;
  const highCount      = activeAlerts.filter(a => a.severity === 'High').length;
  const ackCount       = alerts.filter(a => a.acknowledged).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base md:text-lg font-bold text-slate-900">Inventory Alerts</h3>
          <p className="text-xs text-slate-500 mt-0.5">Stock levels, maintenance, and system warnings</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCheckAlerts} disabled={checkingAlerts}>
          <Bell size={14} className={`mr-1.5 ${checkingAlerts ? 'animate-pulse' : ''}`} />
          {checkingAlerts ? 'Checking...' : 'Check Alerts'}
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {[
          { label: 'Active Alerts',  value: String(activeAlerts.length),  icon: <AlertCircle size={16} />, color: activeAlerts.length > 0 ? 'red' : 'slate' },
          { label: 'Critical',       value: String(criticalCount),         icon: <AlertCircle size={16} />, color: criticalCount > 0 ? 'red' : 'slate' },
          { label: 'High',           value: String(highCount),             icon: <AlertCircle size={16} />, color: highCount > 0 ? 'orange' : 'slate' },
          { label: 'Acknowledged',   value: String(ackCount),              icon: <CheckCircle size={16} />, color: 'green' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-2.5 md:p-3.5">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg bg-${color}-50 border border-${color}-100 flex items-center justify-center text-${color}-600 shrink-0`}>
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] md:text-[10px] text-slate-500 font-semibold uppercase tracking-wide leading-none">{label}</p>
                <p className="text-lg md:text-xl font-bold text-slate-900 leading-tight mt-0.5 tabular-nums">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <LoadingState loading={loading} error={null} empty={alerts.length === 0} emptyMessage="No alerts detected. Run 'Check Alerts' to scan for low stock or overdue maintenance.">
        <div className="space-y-2">
          {alerts.map(alert => {
            const alertKey = alert.id ?? `alert-${alert.itemId}-${alert.createdAt}`;
            const item = items.find(i => i.id === alert.itemId);
            const bar = severityBar(alert.severity);
            return (
              <div key={alertKey} className={`relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden ${alert.acknowledged ? 'opacity-60' : ''}`}>
                {/* Left severity bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar}`} />
                <div className="pl-4 pr-3 py-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-900">{alert.type}</span>
                        <Badge variant={severityBadge(alert.severity)} className="text-[10px]">{alert.severity}</Badge>
                        {alert.acknowledged && <Badge variant="success" className="text-[10px]">Acknowledged</Badge>}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {item && (
                          <span className="text-[11px] text-slate-400 font-medium">{item.name}</span>
                        )}
                        <span className="text-[11px] text-slate-400">{formatDate(new Date(alert.createdAt))}</span>
                        {alert.acknowledgedAt && (
                          <span className="text-[11px] text-green-500">✓ {formatDate(new Date(alert.acknowledgedAt))}</span>
                        )}
                      </div>
                    </div>
                    {!alert.acknowledged && member && alert.id && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors"
                      >
                        <CheckCircle size={13} />
                        <span className="hidden md:inline">Acknowledge</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
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
  bottomSheet?: boolean;
}

const MaintenanceScheduleModal: React.FC<MaintenanceScheduleModalProps> = ({
  isOpen,
  onClose,
  schedule,
  items,
  members,
  onSave,
  drawerOnMobile,
  bottomSheet,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={schedule ? 'Edit Maintenance Schedule' : 'Create Maintenance Schedule'}
      bottomSheet={bottomSheet}
      drawerOnMobile={drawerOnMobile}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" type="button" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" form="maintenance-schedule-form" className="flex-1">Save Schedule</Button>
        </div>
      }
    >
      <form id="maintenance-schedule-form" onSubmit={handleSubmit} className="space-y-4">
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base md:text-lg font-bold text-slate-900">Depreciation Tracking</h3>
          <p className="text-xs text-slate-500 mt-0.5">Track asset depreciation and current book values</p>
        </div>
        {itemsWithDepreciation.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleUpdateAllDepreciation} disabled={updatingItems.size > 0}>
            <RefreshCw size={14} className={`mr-1.5 ${updatingItems.size > 0 ? 'animate-spin' : ''}`} />
            {updatingItems.size > 0 ? 'Updating...' : 'Update All'}
          </Button>
        )}
      </div>

      {/* KPI Strip — only shown when data exists */}
      {itemsWithDepreciation.length > 0 && (
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {[
            { label: 'Purchase Value',  value: formatCurrency(totalPurchaseValue),  icon: <DollarSign size={16} />,   color: 'blue' },
            { label: 'Current Value',   value: formatCurrency(totalCurrentValue),   icon: <TrendingDown size={16} />, color: 'green' },
            { label: 'Depreciated',     value: formatCurrency(totalDepreciation),   icon: <TrendingDown size={16} />, color: totalDepreciation > 0 ? 'red' : 'slate' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-2.5 md:p-3.5">
              <div className="flex items-center gap-2 md:gap-3">
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg bg-${color}-50 border border-${color}-100 flex items-center justify-center text-${color}-600 shrink-0`}>
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-semibold uppercase tracking-wide leading-none">{label}</p>
                  <p className="text-sm md:text-base font-bold text-slate-900 leading-tight mt-0.5 tabular-nums truncate">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <LoadingState loading={loading} error={null} empty={false}>
        {itemsWithDepreciation.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <TrendingDown size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No depreciation data</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Add a purchase price and purchase date to an inventory item to start tracking its depreciation.</p>
          </div>
        ) : (
          <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-xs">Item</th>
                  <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Purchase Date</th>
                  <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Purchase Price</th>
                  <th className="py-2.5 px-3 font-semibold text-xs">Method</th>
                  <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Current Value</th>
                  <th className="py-2.5 px-3 font-semibold text-xs">Depreciated</th>
                  <th className="py-2.5 px-3 font-semibold text-xs text-center">Loss %</th>
                  <th className="py-2.5 px-3 font-semibold text-xs text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemsWithDepreciation.map(item => {
                  const depreciationAmount = (item.purchasePrice || 0) - (item.currentValue || item.purchasePrice || 0);
                  const depreciationPercent = item.purchasePrice ? (depreciationAmount / item.purchasePrice) * 100 : 0;
                  const isUpdating = updatingItems.has(item.id);
                  const pctColor = depreciationPercent > 50 ? 'text-red-600' : depreciationPercent > 25 ? 'text-amber-600' : 'text-green-600';
                  const barColor = depreciationPercent > 50 ? 'bg-red-400' : depreciationPercent > 25 ? 'bg-amber-400' : 'bg-green-400';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-xs text-slate-900">{item.name}</td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{item.purchaseDate ? formatDate(new Date(item.purchaseDate)) : '—'}</td>
                      <td className="py-2.5 px-3 text-xs font-semibold text-slate-700 tabular-nums">{formatCurrency(item.purchasePrice || 0)}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="neutral" className="text-[10px]">{item.depreciationMethod || 'None'}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-xs font-semibold text-green-600 tabular-nums">{formatCurrency(item.currentValue || item.purchasePrice || 0)}</td>
                      <td className="py-2.5 px-3 text-xs text-red-600 tabular-nums">{formatCurrency(depreciationAmount)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs font-bold tabular-nums ${pctColor}`}>{depreciationPercent.toFixed(1)}%</span>
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(depreciationPercent, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleUpdateDepreciation(item.id)}
                          disabled={isUpdating}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                          title="Recalculate depreciation"
                        >
                          <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {itemsWithDepreciation.map(item => {
              const depreciationAmount = (item.purchasePrice || 0) - (item.currentValue || item.purchasePrice || 0);
              const depreciationPercent = item.purchasePrice ? (depreciationAmount / item.purchasePrice) * 100 : 0;
              const isUpdating = updatingItems.has(item.id);
              const pctColor = depreciationPercent > 50 ? 'text-red-600' : depreciationPercent > 25 ? 'text-amber-600' : 'text-green-600';
              const barColor = depreciationPercent > 50 ? 'bg-red-400' : depreciationPercent > 25 ? 'bg-amber-400' : 'bg-green-400';
              return (
                <div key={item.id} className="relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
                  <div className="pl-4 pr-3 py-3">
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="neutral" className="text-[10px]">{item.depreciationMethod || 'None'}</Badge>
                          {item.purchaseDate && (
                            <span className="text-[10px] text-slate-400">Bought {formatDate(new Date(item.purchaseDate))}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleUpdateDepreciation(item.id)}
                        disabled={isUpdating}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors shrink-0"
                        title="Recalculate"
                      >
                        <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
                      <div className="bg-slate-50 rounded-lg py-1.5 px-1">
                        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">Purchase</p>
                        <p className="text-xs font-bold text-slate-700 tabular-nums">{formatCurrency(item.purchasePrice || 0)}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg py-1.5 px-1">
                        <p className="text-[9px] text-green-500 font-semibold uppercase tracking-wide">Current</p>
                        <p className="text-xs font-bold text-green-700 tabular-nums">{formatCurrency(item.currentValue || item.purchasePrice || 0)}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg py-1.5 px-1">
                        <p className="text-[9px] text-red-400 font-semibold uppercase tracking-wide">Lost</p>
                        <p className="text-xs font-bold text-red-600 tabular-nums">{formatCurrency(depreciationAmount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(depreciationPercent, 100)}%` }} />
                      </div>
                      <span className={`text-[11px] font-bold tabular-nums ${pctColor}`}>{depreciationPercent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </LoadingState>







    </div>
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

  const totalIn = linkedTransactions.filter(tx => tx.type === 'Expense').reduce((s, tx) => s + tx.amount, 0);
  const totalOut = linkedTransactions.filter(tx => tx.type === 'Income').reduce((s, tx) => s + tx.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base md:text-lg font-bold text-slate-900">Inventory Transaction History</h3>
        <p className="text-xs text-slate-500 mt-0.5">Financial transactions linked to inventory items</p>
      </div>

      {/* Summary strip — only when data exists */}
      {linkedTransactions.length > 0 && (
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {[
            { label: 'Total Transactions', value: String(linkedTransactions.length), icon: <Package size={16} />, color: 'blue' },
            { label: 'Total Restocked', value: formatCurrency(totalIn), icon: <TrendingDown size={16} />, color: 'green' },
            { label: 'Total Sales', value: formatCurrency(totalOut), icon: <DollarSign size={16} />, color: 'amber' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-2.5 md:p-3.5">
              <div className="flex items-center gap-2 md:gap-3">
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg bg-${color}-50 border border-${color}-100 flex items-center justify-center text-${color}-600 shrink-0`}>
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-semibold uppercase tracking-wide leading-none">{label}</p>
                  <p className="text-sm md:text-base font-bold text-slate-900 leading-tight mt-0.5 tabular-nums truncate">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {linkedTransactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Package size={22} className="text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-600">No linked transactions</p>
          <p className="text-xs text-slate-400 mt-1">Financial transactions linked to inventory items will appear here.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-xs whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 font-semibold text-xs">Item</th>
                  <th className="py-2.5 px-3 font-semibold text-xs">Action</th>
                  <th className="py-2.5 px-3 font-semibold text-xs">Variant</th>
                  <th className="py-2.5 px-3 font-semibold text-xs text-center">Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-xs text-right">Amount</th>
                  <th className="py-2.5 px-3 font-semibold text-xs text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linkedTransactions.map(tx => {
                  const item = items.find(i => i.id === tx.inventoryLinkId);
                  const isStockIn = tx.type === 'Expense';
                  const rowColor = isStockIn ? 'border-l-green-400' : 'border-l-amber-400';
                  return (
                    <tr key={tx.id} className={`border-l-2 ${rowColor} hover:bg-slate-50/60 transition-colors`}>
                      <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(new Date(tx.date))}</td>
                      <td className="py-2.5 px-3 text-xs font-semibold text-slate-900 max-w-[160px] truncate">{item?.name || 'Unknown Item'}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={isStockIn ? 'success' : 'warning'} className="text-[10px]">
                          {isStockIn ? 'Restock' : 'Sale'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-400">{tx.inventoryVariant || '—'}</td>
                      <td className={`py-2.5 px-3 text-xs font-bold text-center tabular-nums ${isStockIn ? 'text-green-600' : 'text-amber-600'}`}>
                        {isStockIn ? '+' : '-'}{tx.inventoryQuantity || 0}
                      </td>
                      <td className="py-2.5 px-3 text-xs font-semibold text-slate-900 text-right tabular-nums">{formatCurrency(tx.amount)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge variant={tx.status === 'Cleared' ? 'success' : tx.status === 'Pending' ? 'warning' : 'neutral'} className="text-[10px]">
                          {tx.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {linkedTransactions.map(tx => {
              const item = items.find(i => i.id === tx.inventoryLinkId);
              const isStockIn = tx.type === 'Expense';
              const barColor = isStockIn ? 'bg-green-400' : 'bg-amber-400';
              return (
                <div key={tx.id} className="relative bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
                  <div className="pl-4 pr-3 py-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{item?.name || 'Unknown Item'}</p>
                      <p className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{formatCurrency(tx.amount)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-slate-400">{formatDate(new Date(tx.date))}</span>
                      <Badge variant={isStockIn ? 'success' : 'warning'} className="text-[10px]">
                        {isStockIn ? 'Restock' : 'Sale'}
                      </Badge>
                      {tx.inventoryVariant && (
                        <span className="text-[11px] text-slate-400">{tx.inventoryVariant}</span>
                      )}
                      <span className={`text-[11px] font-bold tabular-nums ${isStockIn ? 'text-green-600' : 'text-amber-600'}`}>
                        {isStockIn ? '+' : '-'}{tx.inventoryQuantity || 0} units
                      </span>
                      <Badge variant={tx.status === 'Cleared' ? 'success' : tx.status === 'Pending' ? 'warning' : 'neutral'} className="text-[10px] ml-auto">
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}









    </div>
  );
};
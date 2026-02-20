import React from 'react';
import { Input, Select, Checkbox } from '../../ui/Form';
import { Combobox } from '../../ui/Combobox';
import { Transaction, InventoryItem } from '../../../types';
import { Package } from 'lucide-react';

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  // shared data
  accounts: Array<{ id: string; name: string; currency?: string }>;
  projects: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  administrativeProjectIds: string[];
  adminPurposes: string[];
  projectYears: number[];
  groupedProjectsForModal?: { label: string; options: string[] }[];
  filteredProjectsForModal?: Array<{ id: string; name: string }>;
  editingProjectPurposesByProject?: Record<string, string[]>;

  // create-mode props
  recordFormCategory?: string;
  setRecordFormCategory?: (c: string) => void;
  recordFormMemberId?: string;
  setRecordFormMemberId?: (id: string) => void;
  recordFormYear?: number;
  setRecordFormYear?: (y: number) => void;
  recordFormProjectId?: string;
  setRecordFormProjectId?: (id: string) => void;

  // edit-mode props
  editingTransaction?: Transaction | null;
  setEditingTransaction?: (tx: Transaction | null) => void;
  editingMembershipYear?: number;
  setEditingMembershipYear?: (y: number) => void;
  editingAdministrativeYear?: number;
  setEditingAdministrativeYear?: (y: number) => void;
  editingAdministrativePurposeBase?: string;
  setEditingAdministrativePurposeBase?: (p: string) => void;
  editingModalYear?: string;
  setEditingModalYear?: (y: string) => void;
  inventoryItems?: InventoryItem[];
}

export const TransactionForm: React.FC<Props> = ({
  mode,
  accounts,
  projects,
  members,
  administrativeProjectIds,
  adminPurposes,
  projectYears,
  groupedProjectsForModal,
  filteredProjectsForModal,
  editingProjectPurposesByProject,

  // create
  recordFormCategory,
  setRecordFormCategory,
  recordFormMemberId,
  setRecordFormMemberId,
  recordFormYear,
  setRecordFormYear,
  recordFormProjectId,
  setRecordFormProjectId,

  // edit
  editingTransaction,
  setEditingTransaction,
  editingMembershipYear,
  setEditingMembershipYear,
  editingAdministrativeYear,
  setEditingAdministrativeYear,
  editingAdministrativePurposeBase,
  setEditingAdministrativePurposeBase,
  editingModalYear,
  setEditingModalYear,
  inventoryItems = [],
}) => {
  const isEdit = mode === 'edit' && !!editingTransaction;

  const getVal = (name: keyof Transaction) => {
    if (isEdit && editingTransaction) return (editingTransaction as any)[name] ?? '';
    return '';
  };

  const handleEditChange = (field: keyof Transaction, value: any) => {
    setEditingTransaction({ ...editingTransaction, [field]: value } as Transaction);
  };

  const [linkInventory, setLinkInventory] = React.useState(!!getVal('inventoryLinkId'));
  const [selectedInvId, setSelectedInvId] = React.useState(getVal('inventoryLinkId') || '');
  const [selectedVar, setSelectedVar] = React.useState(getVal('inventoryVariant') || '');
  const [invQty, setInvQty] = React.useState(getVal('inventoryQuantity') || 1);

  const selectedItem = React.useMemo(() =>
    inventoryItems.find(item => item.id === selectedInvId),
    [inventoryItems, selectedInvId]
  );

  const variantOptions = React.useMemo(() => {
    if (!selectedItem || !selectedItem.variants) return [];
    return selectedItem.variants.map(v => ({ label: `${v.size} (Stock: ${v.quantity})`, value: v.size }));
  }, [selectedItem]);

  // Effect to auto-fill purpose
  React.useEffect(() => {
    if (!linkInventory || !selectedInvId || !selectedVar) return;

    const itemName = inventoryItems.find(i => i.id === selectedInvId)?.name || '';
    const type = isEdit ? editingTransaction?.type : (document.getElementsByName('type')[0] as HTMLSelectElement)?.value || 'Expense';
    const prefix = type === 'Income' ? '销售' : '补货';
    const newPurpose = `${prefix} - ${itemName} (${selectedVar})`;

    if (isEdit) {
      handleEditChange('purpose', newPurpose);
    } else {
      const purposeField = document.getElementsByName('purpose')[0] as HTMLInputElement;
      if (purposeField) purposeField.value = newPurpose;
    }
  }, [linkInventory, selectedInvId, selectedVar]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-l-4 border-green-500 pl-2">
        Bank Transaction Details
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isEdit ? (
          <Select
            name="bankAccountId"
            label="Bank Account (Optional)"
            defaultValue={(getVal('bankAccountId') as string) || ''}
            options={[{ label: 'Select Account', value: '' }, ...accounts.map(acc => ({ label: `${acc.name} (${acc.currency || ''})`, value: acc.id }))]}
            onChange={(e) => handleEditChange('bankAccountId', e.target.value)}
          />
        ) : (
          <Select
            name="bankAccountId"
            label="Bank Account (Optional)"
            options={[{ label: 'Select Account', value: '' }, ...accounts.map(acc => ({ label: `${acc.name} (${acc.currency || ''})`, value: acc.id }))]}
          />
        )}

        {isEdit ? (
          <Input name="date" label="Date" type="date" defaultValue={((getVal('date') as string) || '').split('T')[0]} required />
        ) : (
          <Input name="date" label="Date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isEdit ? (
          <Input name="description" label="Description" defaultValue={(getVal('description') as string) || ''} required onChange={(e: any) => handleEditChange('description', e.target.value)} />
        ) : (
          <Input name="description" label="Description" placeholder="e.g. Event Venue Deposit" required />
        )}

        {isEdit ? (
          <Input name="referenceNumber" label="Reference Number (Optional)" defaultValue={(getVal('referenceNumber') as string) || ''} onChange={(e: any) => handleEditChange('referenceNumber', e.target.value)} />
        ) : (
          <Input name="referenceNumber" label="Reference Number (Optional)" placeholder="e.g. PR-default-lo-20250216-001" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isEdit ? (
          <Input name="amount" label="Amount" type="number" step="0.01" defaultValue={((getVal('amount') as any) || '').toString()} required onChange={(e: any) => handleEditChange('amount', parseFloat(e.target.value))} />
        ) : (
          <Input name="amount" label="Amount" type="number" step="0.01" placeholder="0.00" required />
        )}

        {isEdit ? (
          <Select name="type" label="Type" value={(getVal('type') as string) || 'Expense'} onChange={(e) => handleEditChange('type', e.target.value)} options={[{ label: 'Expense', value: 'Expense' }, { label: 'Income', value: 'Income' }]} required />
        ) : (
          <Select name="type" label="Type" options={[{ label: 'Expense', value: 'Expense' }, { label: 'Income', value: 'Income' }]} required />
        )}
      </div>

      <div className="border-t border-slate-100" />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-l-4 border-green-500 pl-2">
          Transaction Category
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="w-full">
            {isEdit ? (
              editingTransaction?.category === 'Administrative' ? (
                <Input name="year" label="Year" type="number" value={String(editingAdministrativeYear)} onChange={(e) => { const val = parseInt(e.target.value, 10); setEditingAdministrativeYear?.(val); setEditingModalYear?.(String(val)); }} placeholder="e.g. 2024" />
              ) : editingTransaction?.category === 'Membership' ? (
                <Input name="year" label="Year" type="number" value={String(editingMembershipYear)} onChange={(e) => { const val = parseInt(e.target.value, 10) || new Date().getFullYear(); setEditingMembershipYear?.(val); setEditingModalYear?.(String(val)); }} placeholder="e.g. 2024" />
              ) : (
                <Select
                  name="year"
                  label="Year"
                  value={editingModalYear || 'All'}
                  onChange={(e) => setEditingModalYear?.(e.target.value)}
                  options={[
                    { label: 'All Years', value: 'All' },
                    ...([...new Set([new Date().getFullYear(), ...projectYears])]
                      .sort((a, b) => b - a)
                      .map(y => ({ label: String(y), value: String(y) })))
                  ]}
                />
              )
            ) : recordFormCategory === 'Membership' ? (
              <Input name="year" label="Year" type="number" value={recordFormYear ? String(recordFormYear) : ''} onChange={(e: any) => setRecordFormYear?.(parseInt(e.target.value, 10))} placeholder="e.g. 2024" />
            ) : (
              <Select
                name="year"
                label="Year"
                value={editingModalYear || 'All'}
                onChange={(e) => setEditingModalYear?.(e.target.value)}
                options={[
                  { label: 'All Years', value: 'All' },
                  ...([...new Set([new Date().getFullYear(), ...projectYears])]
                    .sort((a, b) => b - a)
                    .map(y => ({ label: String(y), value: String(y) })))
                ]}
              />
            )}
          </div>

          <div className="w-full">
            {isEdit ? (
              <Select name="category" label="Category" value={(editingTransaction?.category as string) || 'Projects & Activities'} onChange={(e) => setEditingTransaction?.({ ...editingTransaction!, category: e.target.value as any })} options={[{ label: 'Projects & Activities', value: 'Projects & Activities' }, { label: 'Membership', value: 'Membership' }, { label: 'Administrative', value: 'Administrative' }]} required />
            ) : (
              <Select name="category" label="Category" value={recordFormCategory} onChange={(e) => setRecordFormCategory?.(e.target.value)} options={[{ label: 'Projects & Activities', value: 'Projects & Activities' }, { label: 'Membership', value: 'Membership' }, { label: 'Administrative', value: 'Administrative' }]} required />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="w-full">
            {isEdit ? (
              <>
                {editingTransaction?.category === 'Membership' && (
                  <Select name="memberId" label="Member" value={(editingTransaction?.memberId as string) || ''} onChange={(e) => setEditingTransaction?.({ ...editingTransaction!, memberId: e.target.value })} options={[{ label: 'Select...', value: '' }, ...members.map(m => ({ label: m.name, value: m.id }))]} required />
                )}

                {editingTransaction?.category === 'Projects & Activities' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                    <Combobox groupedOptions={groupedProjectsForModal} value={filteredProjectsForModal?.find(p => p.id === editingTransaction.projectId)?.name || ''} onChange={(value) => { const project = filteredProjectsForModal?.find(p => p.name === value); setEditingTransaction?.({ ...editingTransaction!, projectId: project?.id || '' }); }} placeholder="Select or type to search project..." />
                  </div>
                )}

                {editingTransaction?.category === 'Administrative' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Admin Account</label>
                    <Combobox options={['', ...administrativeProjectIds]} value={editingTransaction.projectId || ''} onChange={(value) => setEditingTransaction?.({ ...editingTransaction!, projectId: value })} placeholder="Select or type to search admin account..." />
                  </div>
                )}
              </>
            ) : (
              <>
                {recordFormCategory === 'Membership' && (
                  <Select name="memberId" label="Member" value={recordFormMemberId} onChange={(e) => setRecordFormMemberId?.(e.target.value)} options={[{ label: 'Select...', value: '' }, ...members.map(m => ({ label: m.name, value: m.id }))]} required />
                )}

                {recordFormCategory === 'Projects & Activities' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                    <Combobox
                      groupedOptions={groupedProjectsForModal}
                      value={filteredProjectsForModal?.find(p => p.id === recordFormProjectId)?.name || ''}
                      onChange={(value) => {
                        const project = filteredProjectsForModal?.find(p => p.name === value);
                        setRecordFormProjectId?.(project?.id || '');
                      }}
                      placeholder="Select or type to search project..."
                    />
                    <input type="hidden" name="projectId" value={recordFormProjectId} />
                    <input type="hidden" name="year" value={editingModalYear || 'All'} />
                  </div>
                )}

                {recordFormCategory === 'Administrative' && (
                  <Select name="projectId" label="Admin Account" options={[{ label: 'Select Admin Account...', value: '' }, ...administrativeProjectIds.map(p => ({ label: p, value: p }))]} />
                )}
              </>
            )}
          </div>

          <div className="w-full">
            {isEdit ? (
              editingTransaction?.category === 'Administrative' ? (
                <Select name="purpose" label="Purpose" value={editingAdministrativePurposeBase} onChange={(e) => setEditingAdministrativePurposeBase?.(e.target.value)} options={[{ label: 'Select...', value: '' }, ...adminPurposes.map(p => ({ label: p, value: p }))]} />
              ) : (
                <Input name="purpose" label="Purpose" defaultValue={editingTransaction?.purpose ?? ''} onChange={(e: any) => setEditingTransaction?.({ ...editingTransaction!, purpose: e.target.value })} />
              )
            ) : recordFormCategory === 'Administrative' ? (
              <Select name="purpose" label="Purpose" options={[{ label: 'Select...', value: '' }, ...adminPurposes.map(p => ({ label: p, value: p }))]} />
            ) : (
              <Input name="purpose" label="Purpose" placeholder="e.g. AGM venue deposit" />
            )}
          </div>
        </div>

        {/* Membership Derived Fields Helper shown in parent modal when needed */}
      </div>
      <div className="border-t border-slate-100" />

      {/* Inventory Linkage Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-l-4 border-blue-500 pl-2">
            Asset & Inventory Linkage (Optional)
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              label="Enable Linkage"
              checked={linkInventory}
              onChange={(e) => setLinkInventory(e.target.checked)}
            />
          </div>
        </div>

        {linkInventory && (
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                name="inventoryLinkId"
                label="Select Item"
                value={selectedInvId}
                onChange={(e) => {
                  setSelectedInvId(e.target.value);
                  setSelectedVar(''); // Reset variant when item changes
                }}
                options={[
                  { label: 'Select Asset...', value: '' },
                  ...inventoryItems.map(item => ({ label: item.name, value: item.id }))
                ]}
                required={linkInventory}
              />

              <Select
                name="inventoryVariant"
                label="Size / Variant"
                value={selectedVar}
                onChange={(e) => setSelectedVar(e.target.value)}
                options={[
                  { label: 'Select Size...', value: '' },
                  ...variantOptions
                ]}
                disabled={!selectedInvId}
                required={linkInventory}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                name="inventoryQuantity"
                label="Quantity"
                type="number"
                min="1"
                value={invQty}
                onChange={(e) => setInvQty(parseInt(e.target.value, 10))}
                required={linkInventory}
              />
              <div className="flex items-end pb-1 text-xs text-slate-500 italic">
                * Inventory will be automatically adjusted upon saving.
              </div>
            </div>

            {/* Hidden inputs to ensure these are included in FormData even if Select/Input state changes */}
            {!isEdit && (
              <>
                <input type="hidden" name="inventoryLinkId" value={selectedInvId} />
                <input type="hidden" name="inventoryVariant" value={selectedVar} />
                <input type="hidden" name="inventoryQuantity" value={invQty} />
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100" />
    </div>
  );
};

export default TransactionForm;

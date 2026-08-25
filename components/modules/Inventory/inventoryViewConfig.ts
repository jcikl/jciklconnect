export type InventoryTabId = 'items' | 'maintenance' | 'alerts' | 'depreciation' | 'finance';

export const INVENTORY_TAB_ITEMS: { id: InventoryTabId; label: string }[] = [
  { id: 'items', label: 'Items' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'depreciation', label: 'Depreciation' },
  { id: 'finance', label: 'Financial History' },
];

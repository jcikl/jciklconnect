import { useState, type FormEvent } from 'react';
import type { InventoryItem } from '../../../types';
import type { InventoryFormVariant } from './InventoryItemFormFields';

type InventoryCategory = 'Electronics' | 'Furniture' | 'Merchandise' | 'Stationery' | 'Equipment' | 'Supplies' | 'Other';
type DepreciationMethod = 'Straight Line' | 'Declining Balance' | 'Units of Production' | 'None';

interface UseInventoryItemFormOptions {
  selectedItem: InventoryItem | null;
  createItem: (item: Omit<InventoryItem, 'id'>) => Promise<string | void>;
  updateItem: (itemId: string, updates: Partial<InventoryItem>) => Promise<void>;
  showToast: (message: string, type?: any) => void;
  onAddComplete: (form: HTMLFormElement) => void;
  onEditComplete: () => void;
}

const VALID_CATEGORIES: InventoryCategory[] = [
  'Electronics',
  'Furniture',
  'Merchandise',
  'Stationery',
  'Equipment',
  'Supplies',
  'Other',
];

const parseOptionalFloat = (value: FormDataEntryValue | null) => value ? parseFloat(value as string) : undefined;
const parseOptionalInt = (value: FormDataEntryValue | null) => value ? parseInt(value as string) : undefined;

export const useInventoryItemForm = ({
  selectedItem,
  createItem,
  updateItem,
  showToast,
  onAddComplete,
  onEditComplete,
}: UseInventoryItemFormOptions) => {
  const [formVariants, setFormVariants] = useState<InventoryFormVariant[]>([]);

  const readItemFields = (formData: FormData) => {
    const categoryValue = formData.get('category') as string;

    if (!VALID_CATEGORIES.includes(categoryValue as InventoryCategory)) {
      showToast('Invalid category selected', 'error');
      return null;
    }

    const purchasePrice = parseOptionalFloat(formData.get('purchasePrice'));
    const purchaseDate = formData.get('purchaseDate') as string || undefined;
    const depreciationMethod = formData.get('depreciationMethod') as DepreciationMethod | undefined;
    const depreciationRate = parseOptionalFloat(formData.get('depreciationRate'));
    const usefulLife = parseOptionalInt(formData.get('usefulLife'));
    const quantity = formVariants.length > 0 ? formVariants.reduce((sum, v) => sum + v.quantity, 0) : (() => {
      const q = parseInt(formData.get('quantity') as string);
      return isNaN(q) ? 1 : q;
    })();

    return {
      fields: {
        name: formData.get('name') as string,
        category: categoryValue as InventoryCategory,
        location: formData.get('location') as string,
        quantity,
        condition: formData.get('condition') as string,
        description: formData.get('description') as string || '',
        purchaseDate,
        purchasePrice,
        depreciationMethod: depreciationMethod || 'None',
        depreciationRate,
        usefulLife,
        variants: formVariants.length > 0 ? formVariants : undefined,
      },
      purchasePrice,
      purchaseDate,
      depreciationMethod,
    };
  };

  const addVariant = () => setFormVariants(prev => [...prev, { size: '', quantity: 1 }]);

  const updateVariant = (index: number, field: 'size' | 'quantity', value: string | number) => {
    setFormVariants(prev => {
      const updated = [...prev];
      const finalValue = field === 'quantity' ? parseInt(value.toString()) || 0 : value;
      updated[index] = { ...updated[index], [field]: finalValue };
      return updated;
    });
  };

  const removeVariant = (index: number) => setFormVariants(prev => prev.filter((_, i) => i !== index));

  const handleAddItem = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = readItemFields(new FormData(e.currentTarget));
    if (!parsed) return;

    try {
      const newItem: Omit<InventoryItem, 'id'> = {
        ...parsed.fields,
        status: 'Available',
        condition: parsed.fields.condition || 'Good',
      };

      if (parsed.purchasePrice && parsed.purchaseDate && parsed.depreciationMethod && parsed.depreciationMethod !== 'None') {
        const { InventoryService } = await import('../../../services/inventoryService');
        newItem.currentValue = InventoryService.calculateDepreciation({ ...newItem, id: 'temp' } as InventoryItem);
      } else if (parsed.purchasePrice) {
        newItem.currentValue = parsed.purchasePrice;
      }

      await createItem(newItem);
      setFormVariants([]);
      onAddComplete(e.currentTarget);
    } catch (err) {
    }
  };

  const handleEditItem = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItem) return;

    const parsed = readItemFields(new FormData(e.currentTarget));
    if (!parsed) return;

    try {
      const updates: Partial<InventoryItem> = parsed.fields;

      if (parsed.purchasePrice && parsed.purchaseDate && parsed.depreciationMethod && parsed.depreciationMethod !== 'None') {
        const { InventoryService } = await import('../../../services/inventoryService');
        updates.currentValue = InventoryService.calculateDepreciation({ ...selectedItem, ...updates } as InventoryItem);
      } else if (parsed.purchasePrice) {
        updates.currentValue = parsed.purchasePrice;
      }

      await updateItem(selectedItem.id, updates);
      setFormVariants([]);
      onEditComplete();
    } catch (err) {
    }
  };

  return {
    formVariants,
    setFormVariants,
    handleAddItem,
    handleEditItem,
    addVariant,
    updateVariant,
    removeVariant,
  };
};

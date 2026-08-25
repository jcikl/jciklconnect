import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../ui/Common';
import { Input, Select, Textarea } from '../../ui/Form';
import type { InventoryItem } from '../../../types';

export type InventoryFormVariant = { size: string; quantity: number };

interface InventoryItemFormFieldsProps {
  formId: string;
  mode: 'add' | 'edit';
  item?: InventoryItem;
  variants: InventoryFormVariant[];
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onAddVariant: () => void;
  onUpdateVariant: (index: number, field: 'size' | 'quantity', value: string | number) => void;
  onRemoveVariant: (index: number) => void;
}

const CATEGORY_OPTIONS = [
  { label: 'Electronics', value: 'Electronics' },
  { label: 'Furniture', value: 'Furniture' },
  { label: 'Merchandise', value: 'Merchandise' },
  { label: 'Stationery', value: 'Stationery' },
  { label: 'Equipment', value: 'Equipment' },
  { label: 'Supplies', value: 'Supplies' },
  { label: 'Other', value: 'Other' },
];

const CONDITION_OPTIONS = [
  { label: 'Excellent', value: 'Excellent' },
  { label: 'Good', value: 'Good' },
  { label: 'Fair', value: 'Fair' },
  { label: 'Poor', value: 'Poor' },
];

const DEPRECIATION_OPTIONS = [
  { label: 'None', value: 'None' },
  { label: 'Straight Line', value: 'Straight Line' },
  { label: 'Declining Balance', value: 'Declining Balance' },
  { label: 'Units of Production', value: 'Units of Production' },
];

export const InventoryItemFormFields: React.FC<InventoryItemFormFieldsProps> = ({
  formId,
  mode,
  item,
  variants,
  onSubmit,
  onAddVariant,
  onUpdateVariant,
  onRemoveVariant,
}) => {
  const isEdit = mode === 'edit';
  const totalVariantQuantity = variants.reduce((sum, variant) => sum + variant.quantity, 0);

  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-4">
      <Input
        name="name"
        label="Item Name"
        placeholder={isEdit ? undefined : 'e.g. Projector'}
        defaultValue={item?.name}
        required
      />
      <Select
        name="category"
        label="Category"
        options={CATEGORY_OPTIONS}
        defaultValue={item?.category}
        required
      />
      <Input
        name="location"
        label="Location"
        placeholder={isEdit ? undefined : 'e.g. Storage Room A'}
        defaultValue={item?.location}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        {variants.length > 0 ? (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Total Quantity</label>
            <div className="h-10 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-md text-slate-600">
              {totalVariantQuantity}
            </div>
            <input type="hidden" name="quantity" value={totalVariantQuantity} />
          </div>
        ) : (
          <Input
            name="quantity"
            label="Quantity"
            type="number"
            defaultValue={item?.quantity?.toString() || '1'}
            required
          />
        )}
        <Select
          name="condition"
          label="Condition"
          options={CONDITION_OPTIONS}
          defaultValue={item?.condition || 'Good'}
          required
        />
      </div>
      <Textarea
        name="description"
        label="Description"
        placeholder={isEdit ? undefined : 'Additional notes...'}
        defaultValue={item?.description || ''}
      />

      <div className="pt-4 border-t border-slate-200">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-sm font-semibold text-slate-900">Variants (e.g. Sizes)</h4>
          <Button type="button" variant="outline" size="sm" onClick={onAddVariant}>
            <Plus size={14} className="mr-1" /> Add Variant
          </Button>
        </div>

        {variants.length > 0 ? (
          <div className="space-y-3">
            {variants.map((variant, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label={index === 0 ? 'Size/Specs' : ''}
                    value={variant.size}
                    onChange={(e) => onUpdateVariant(index, 'size', e.target.value)}
                    placeholder="e.g. M, L, Blue"
                    required
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    label={index === 0 ? 'Qty' : ''}
                    value={variant.quantity.toString()}
                    onChange={(e) => onUpdateVariant(index, 'quantity', e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveVariant(index)}
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

      <div className="pt-4 border-t border-slate-200">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          Depreciation Tracking{isEdit ? '' : ' (Optional)'}
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <Input name="purchaseDate" label="Purchase Date" type="date" defaultValue={item?.purchaseDate || ''} />
          <Input
            name="purchasePrice"
            label="Purchase Price (RM)"
            type="number"
            step="0.01"
            defaultValue={item?.purchasePrice?.toString() || ''}
            placeholder="0.00"
          />
        </div>
        <Select
          name="depreciationMethod"
          label="Depreciation Method"
          options={DEPRECIATION_OPTIONS}
          defaultValue={item?.depreciationMethod || 'None'}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            name="depreciationRate"
            label="Depreciation Rate (% per year)"
            type="number"
            step="0.1"
            defaultValue={item?.depreciationRate?.toString() || ''}
            placeholder="20"
          />
          <Input
            name="usefulLife"
            label="Useful Life (Years)"
            type="number"
            min="1"
            defaultValue={item?.usefulLife?.toString() || ''}
            placeholder="5"
          />
        </div>
        {isEdit && item?.currentValue !== undefined && item.purchasePrice !== undefined ? (
          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Purchase Price:</span>
              <span className="font-semibold text-slate-900">RM {item.purchasePrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-600">Current Value:</span>
              <span className="font-semibold text-green-600">RM {item.currentValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-600">Total Depreciation:</span>
              <span className="font-semibold text-red-600">
                RM {(item.purchasePrice - item.currentValue).toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          !isEdit && (
            <p className="text-xs text-slate-500 mt-2">
              Current value will be automatically calculated based on depreciation method and elapsed time.
            </p>
          )
        )}
      </div>

      <div className="pt-4" />
    </form>
  );
};

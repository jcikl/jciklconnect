import React from 'react';
import { Badge, Modal } from '../../ui/Common';
import { LoadingState } from '../../ui/Loading';
import type { InventoryItem, StockMovement } from '../../../types';
import { formatDate } from '../../../utils/dateUtils';

interface InventoryStockCardModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  movements: StockMovement[];
  loading: boolean;
  onClose: () => void;
}

export const InventoryStockCardModal: React.FC<InventoryStockCardModalProps> = ({
  isOpen,
  item,
  movements,
  loading,
  onClose,
}) => {
  if (!item) return null;

  const totalIn = movements
    .filter(movement => movement.type === 'In')
    .reduce((sum, movement) => sum + movement.quantity, 0);
  const totalOut = Math.abs(
    movements
      .filter(movement => movement.type === 'Out')
      .reduce((sum, movement) => sum + movement.quantity, 0)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Stock Card: ${item.name}`}
      size="xl"
      bottomSheet
      drawerOnMobile
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500 font-medium uppercase mb-1">Current Stock</p>
            <div className="text-2xl font-bold text-slate-900">{item.quantity}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-500 font-medium uppercase mb-1">Total In</p>
            <div className="text-2xl font-bold text-blue-600">{totalIn}</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-xl">
            <p className="text-xs text-orange-500 font-medium uppercase mb-1">Total Out</p>
            <div className="text-2xl font-bold text-orange-600">{totalOut}</div>
          </div>
        </div>

        <LoadingState loading={loading} error={null} empty={movements.length === 0} emptyMessage="No stock movements recorded.">
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
                {movements.map(movement => (
                  <tr key={movement.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 text-slate-500">{formatDate(new Date(movement.date))}</td>
                    <td className="py-3 px-3">
                      <Badge variant={movement.type === 'In' ? 'success' : movement.type === 'Out' ? 'warning' : 'info'}>
                        {movement.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{movement.variant || '-'}</td>
                    <td className={`py-3 px-3 font-bold ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                    </td>
                    <td className="py-3 px-3 font-medium">{movement.newQuantity}</td>
                    <td className="py-3 px-3 text-slate-600">{movement.reason}</td>
                    <td className="py-3 px-3 text-slate-500">{movement.performedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LoadingState>
      </div>
    </Modal>
  );
};

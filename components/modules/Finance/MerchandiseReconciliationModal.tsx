import React, { useState, useEffect } from 'react';
import { X, Package, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { InventoryService } from '../../../services/inventoryService';
import { Modal, Button } from '../../ui/Common';

interface MerchandiseReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MerchandiseReconciliationModal: React.FC<MerchandiseReconciliationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [reconciliationData, setReconciliationData] = useState<{
    totalItems: number;
    consistentItems: number;
    inconsistentItems: number;
    discrepancies: Array<{
      itemId: string;
      itemName: string;
      issues: string[];
      inventoryValue: number;
      transactionValue: number;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      performReconciliation();
    }
  }, [isOpen]);

  const performReconciliation = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await InventoryService.reconcileMerchandiseInventory();
      setReconciliationData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to reconcile merchandise inventory');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Merchandise Inventory Reconciliation"
      size="4xl"
      bottomSheet
      drawerOnMobile
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            onClick={performReconciliation}
            disabled={loading}
            variant="ghost"
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
            className="px-6 py-2"
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-gray-600">Verify inventory records match financial transactions</p>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-gray-600">Reconciling inventory...</span>
          </div>
        )}

        {/* Summary Cards */}
        {!loading && reconciliationData && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Total Items</span>
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {reconciliationData.totalItems}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Consistent</span>
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {reconciliationData.consistentItems}
                </div>
              </div>

              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-900">Inconsistent</span>
                </div>
                <div className="text-3xl font-bold text-red-600">
                  {reconciliationData.inconsistentItems}
                </div>
              </div>
            </div>

            {/* Consistency Status */}
            {reconciliationData.inconsistentItems === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">All merchandise items are consistent!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Inventory records match financial transactions for all {reconciliationData.totalItems} items.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-900">
                    {reconciliationData.inconsistentItems} item(s) have discrepancies
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Review the items below to resolve inconsistencies.
                  </p>
                </div>
              </div>
            )}

            {/* Discrepancies List */}
            {reconciliationData.discrepancies.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Discrepancies</h3>
                <div className="space-y-3">
                  {reconciliationData.discrepancies.map((discrepancy) => (
                    <div
                      key={discrepancy.itemId}
                      className="border border-red-200 rounded-lg p-4 bg-red-50"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{discrepancy.itemName}</h4>
                          <p className="text-sm text-gray-600">Item ID: {discrepancy.itemId}</p>
                        </div>
                        <div className="sm:text-right">
                          <div className="text-sm text-gray-600">Inventory Value</div>
                          <div className="font-bold text-gray-900">
                            RM {discrepancy.inventoryValue.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Transaction Value:</span>
                          <span className="font-medium text-gray-900">
                            RM {discrepancy.transactionValue.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Difference:</span>
                          <span className="font-medium text-red-600">
                            RM {Math.abs(discrepancy.inventoryValue - discrepancy.transactionValue).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {discrepancy.issues.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-red-200">
                          <p className="text-sm font-medium text-red-900 mb-2">Issues:</p>
                          <ul className="space-y-1">
                            {discrepancy.issues.map((issue, issueIndex) => (
                              <li key={issueIndex} className="text-sm text-red-700 flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">•</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

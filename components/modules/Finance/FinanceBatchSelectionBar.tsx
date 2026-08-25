import React from 'react';
import { Layers, Settings, Trash2, X } from 'lucide-react';

interface BatchOperationProgress {
  current: number;
  total: number;
}

interface FinanceBatchSelectionBarProps {
  selectedTransactionCount: number;
  selectedSplitCount: number;
  batchOperationProgress: BatchOperationProgress | null;
  onOpenBatchCategory: () => void;
  onOpenBatchDeleteConfirm: () => void;
  onClearSelection: () => void;
}

export const FinanceBatchSelectionBar: React.FC<FinanceBatchSelectionBarProps> = ({
  selectedTransactionCount,
  selectedSplitCount,
  batchOperationProgress,
  onOpenBatchCategory,
  onOpenBatchDeleteConfirm,
  onClearSelection,
}) => {
  const selectedCount = selectedTransactionCount + selectedSplitCount;
  const progressPercent = batchOperationProgress
    ? (batchOperationProgress.current / batchOperationProgress.total) * 100
    : 0;

  return (
    <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[40] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between md:justify-start gap-2 md:gap-6 bg-slate-900/95 backdrop-blur-md px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl border border-white/10">
        <div className="flex items-center gap-3 pr-2 md:pr-4 md:border-r border-slate-700">
          <div className="p-1.5 bg-blue-500 rounded-lg flex items-center justify-center">
            <Layers size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] md:text-sm font-bold text-white leading-tight">
              {batchOperationProgress ? 'Processing...' : `${selectedCount} Selected`}
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:block mt-0.5">
              {batchOperationProgress
                ? `${batchOperationProgress.current}/${batchOperationProgress.total}`
                : `${selectedTransactionCount} main \u2022 ${selectedSplitCount} splits`
              }
            </span>
          </div>
        </div>

        {batchOperationProgress ? (
          <div className="flex-1 max-w-[200px] md:w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-4">
            <button
              onClick={onOpenBatchCategory}
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-blue-400 hover:text-blue-300 transition-all px-2 py-1 rounded-lg hover:bg-white/5"
            >
              <Settings size={18} />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Batch Set</span>
            </button>
            <button
              onClick={onOpenBatchDeleteConfirm}
              className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-red-400 hover:text-red-300 transition-all px-2 py-1 rounded-lg hover:bg-white/5"
            >
              <Trash2 size={18} />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Delete</span>
            </button>
            <button
              onClick={onClearSelection}
              className="ml-2 p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Clear selection"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

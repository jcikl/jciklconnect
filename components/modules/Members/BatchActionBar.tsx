import * as React from 'react';
import { Trash2, Settings, X } from 'lucide-react';

// Batch Action Bar Component
export const BatchActionBar: React.FC<{
  selectedCount: number,
  onClear: () => void,
  onBatchDelete: () => void,
  onBatchSet: () => void,
  isDeveloper: boolean
}> = ({ selectedCount, onClear, onBatchDelete, onBatchSet, isDeveloper }) => {
  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[40] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900 text-white px-2 md:px-6 py-3 md:py-4 rounded-[40px] md:rounded-2xl shadow-2xl flex items-center justify-around md:justify-start gap-0 md:gap-6 border border-white/10 backdrop-blur-md h-20 md:h-auto">
        <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3 md:pr-6 md:border-r border-white/20 min-w-[70px] md:min-w-0">
          <div className="w-8 h-8 rounded-full bg-jci-blue flex items-center justify-center font-bold text-sm">
            {selectedCount}
          </div>
          <span className="text-[9px] md:text-sm font-bold md:font-medium tracking-widest md:tracking-normal uppercase md:capitalize whitespace-nowrap">Selected</span>
        </div>

        <button
          onClick={onBatchSet}
          className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-white hover:text-jci-blue transition-all min-w-[70px] md:min-w-0"
        >
          <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
            <Settings size={20} className="md:w-4 md:h-4" />
          </div>
          <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Batch Set</span>
        </button>

        {isDeveloper && (
          <button
            onClick={onBatchDelete}
            className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-red-400 hover:text-red-300 transition-all min-w-[70px] md:min-w-0"
          >
            <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
              <Trash2 size={20} className="md:w-4 md:h-4" />
            </div>
            <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Delete</span>
          </button>
        )}

        <button
          onClick={onClear}
          className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-slate-400 hover:text-white transition-all min-w-[70px] md:min-w-0"
        >
          <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
            <X size={20} className="md:w-4 md:h-4" />
          </div>
          <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Clear</span>
        </button>
      </div>
    </div>
  );
};

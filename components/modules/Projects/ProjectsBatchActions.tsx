import React from 'react';
import { Layers, Settings, Trash2, X } from 'lucide-react';
import { Button, Modal } from '../../ui/Common';
import type { Project } from '../../../types';

interface ProjectsBatchActionsProps {
  visible: boolean;
  selectedCount: number;
  progress: { current: number; total: number } | null;
  isStatusModalOpen: boolean;
  onOpenStatusModal: () => void;
  onCloseStatusModal: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  onStatusUpdate: (status: Project['status']) => void;
}

const BATCH_STATUSES: Project['status'][] = ['Planning', 'Draft', 'Under Review', 'Approved', 'Active', 'Completed', 'Cancelled'];

const statusLabel = (status: Project['status']) => {
  if (status === 'Active') return 'Published';
  if (status === 'Planning') return 'Draft / Unpublished';
  return status;
};

export const ProjectsBatchActions: React.FC<ProjectsBatchActionsProps> = ({
  visible,
  selectedCount,
  progress,
  isStatusModalOpen,
  onOpenStatusModal,
  onCloseStatusModal,
  onDelete,
  onClearSelection,
  onStatusUpdate,
}) => (
  <>
    {visible && (
      <div className="fixed bottom-6 left-6 right-6 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[60] animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-slate-900 text-white px-2 md:px-6 py-3 md:py-4 rounded-[40px] md:rounded-2xl shadow-2xl flex items-center justify-around md:justify-start gap-0 md:gap-6 border border-white/10 backdrop-blur-md h-20 md:h-auto">
          <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3 md:pr-4 md:border-r border-white/20 min-w-[70px] md:min-w-0">
            <Layers size={20} className="text-blue-400 md:w-4 md:h-4" />
            <span className="text-[9px] md:text-sm font-bold md:font-medium tracking-widest md:tracking-tight uppercase md:capitalize whitespace-nowrap">{selectedCount} Selected</span>
          </div>

          {progress ? (
            <div className="flex-1 max-w-[150px] md:w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          ) : (
            <>
              <button
                onClick={onOpenStatusModal}
                className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-blue-400 hover:text-blue-300 transition-all min-w-[70px] md:min-w-0"
              >
                <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
                  <Settings size={20} className="md:w-4 md:h-4" />
                </div>
                <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Status</span>
              </button>
              <button
                onClick={onDelete}
                className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-red-400 hover:text-red-300 transition-all min-w-[70px] md:min-w-0"
              >
                <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
                  <Trash2 size={20} className="md:w-4 md:h-4" />
                </div>
                <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Delete</span>
              </button>
              <button
                onClick={onClearSelection}
                className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-slate-400 hover:text-white transition-all min-w-[70px] md:min-w-0"
              >
                <div className="p-2 md:p-0 rounded-2xl md:rounded-none bg-white/5 md:bg-transparent">
                  <X size={20} className="md:w-4 md:h-4" />
                </div>
                <span className="text-[9px] md:text-sm font-bold tracking-widest md:tracking-normal uppercase md:capitalize">Clear</span>
              </button>
            </>
          )}
        </div>
      </div>
    )}

    <Modal
      isOpen={isStatusModalOpen}
      onClose={onCloseStatusModal}
      title="Batch Update Status"
      size="md"
      drawerOnMobile
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Apply a new status to the {selectedCount} selected events.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {BATCH_STATUSES.map((status) => (
            <Button
              key={status}
              variant="outline"
              className="justify-start"
              onClick={() => onStatusUpdate(status)}
            >
              {statusLabel(status)}
            </Button>
          ))}
        </div>
        <div className="pt-2">
          <Button variant="ghost" className="w-full" onClick={onCloseStatusModal}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  </>
);

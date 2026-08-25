import { useState } from 'react';
import type { MaintenanceSchedule } from '../../../types';

interface UseInventoryMaintenanceActionsOptions {
  createMaintenanceSchedule: (schedule: Omit<MaintenanceSchedule, 'id'>) => Promise<string | void>;
  updateMaintenanceSchedule: (scheduleId: string, updates: Partial<MaintenanceSchedule>) => Promise<void>;
  loadMaintenanceSchedules: () => Promise<void>;
  showToast: (message: string, type?: any) => void;
}

export const useInventoryMaintenanceActions = ({
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  loadMaintenanceSchedules,
  showToast,
}: UseInventoryMaintenanceActionsOptions) => {
  const [isMaintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);

  const handleOpenMaintenanceModal = (schedule?: MaintenanceSchedule) => {
    setSelectedSchedule(schedule ?? null);
    setMaintenanceModalOpen(true);
  };

  const handleCloseMaintenanceModal = () => {
    setMaintenanceModalOpen(false);
    setSelectedSchedule(null);
  };

  const handleSaveMaintenanceSchedule = async (scheduleData: Omit<MaintenanceSchedule, 'id'>) => {
    try {
      if (selectedSchedule) {
        await updateMaintenanceSchedule(selectedSchedule.id, scheduleData);
        showToast('Maintenance schedule updated', 'success');
      } else {
        await createMaintenanceSchedule(scheduleData);
        showToast('Maintenance schedule created', 'success');
      }

      await loadMaintenanceSchedules();
      handleCloseMaintenanceModal();
    } catch {
      showToast('Failed to save maintenance schedule', 'error');
    }
  };

  return {
    isMaintenanceModalOpen,
    selectedSchedule,
    handleOpenMaintenanceModal,
    handleCloseMaintenanceModal,
    handleSaveMaintenanceSchedule,
  };
};

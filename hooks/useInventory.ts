// Inventory Data Hook
import { useState, useRef } from 'react';
import { InventoryService } from '../services/inventoryService';
import { InventoryItem, MaintenanceSchedule, InventoryAlert } from '../types';
import { useToast } from '../components/ui/Common';
import { useFirestoreCollection } from './useFirestoreCollection';

export const useInventory = () => {
  const { showToast } = useToast();
  const isCreatingRef = useRef(false);
  const isUpdatingRef = useRef(false);
  const isDeletingRef = useRef(false);
  const isCheckingOutRef = useRef(false);
  const isCheckingInRef = useRef(false);
  const isSchedulingRef = useRef(false);
  const isCompletingRef = useRef(false);
  const isAcknowledgingRef = useRef(false);
  const isUpdatingScheduleRef = useRef(false);

  const { data: items, loading, error, reload: loadItems } = useFirestoreCollection<InventoryItem>({
    loader: () => InventoryService.getAllItems(),
  });

  const createItem = async (itemData: Omit<InventoryItem, 'id'>) => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    try {
      const id = await InventoryService.createItem(itemData);
      await loadItems();
      showToast('Inventory item created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create inventory item';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isCreatingRef.current = false;
    }
  };

  const updateItem = async (itemId: string, updates: Partial<InventoryItem>) => {
    if (isUpdatingRef.current) return;
    isUpdatingRef.current = true;
    try {
      await InventoryService.updateItem(itemId, updates);
      await loadItems();
      showToast('Inventory item updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update inventory item';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isUpdatingRef.current = false;
    }
  };

  const deleteItem = async (itemId: string) => {
    if (isDeletingRef.current) return;
    isDeletingRef.current = true;
    try {
      await InventoryService.deleteItem(itemId);
      await loadItems();
      showToast('Inventory item deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete inventory item';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isDeletingRef.current = false;
    }
  };

  const checkOutItem = async (itemId: string, memberId: string, expectedReturnDate?: string) => {
    if (isCheckingOutRef.current) return;
    isCheckingOutRef.current = true;
    try {
      await InventoryService.checkOutItem(itemId, memberId, expectedReturnDate ? new Date(expectedReturnDate) : undefined);
      await loadItems();
      showToast('Item checked out successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check out item';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isCheckingOutRef.current = false;
    }
  };

  const checkInItem = async (itemId: string) => {
    if (isCheckingInRef.current) return;
    isCheckingInRef.current = true;
    try {
      await InventoryService.checkInItem(itemId);
      await loadItems();
      showToast('Item checked in successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check in item';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isCheckingInRef.current = false;
    }
  };

  // Maintenance schedules and alerts are loaded on-demand (not in initial useEffect)
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<MaintenanceSchedule[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);

  const loadMaintenanceSchedules = async (itemId?: string) => {
    try {
      const data = await InventoryService.getMaintenanceSchedules();
      // Filter by itemId if provided
      const filteredData = itemId ? data.filter(schedule => schedule.itemId === itemId) : data;
      setMaintenanceSchedules(filteredData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load maintenance schedules';
      showToast(errorMessage, 'error');
    }
  };

  const loadAlerts = async (acknowledged?: boolean) => {
    try {
      const data = await InventoryService.getAlerts(acknowledged);
      setAlerts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load alerts';
      showToast(errorMessage, 'error');
    }
  };

  const createMaintenanceSchedule = async (schedule: Omit<MaintenanceSchedule, 'id'>) => {
    if (isSchedulingRef.current) return;
    isSchedulingRef.current = true;
    try {
      await InventoryService.createMaintenanceSchedule(schedule);
      await loadMaintenanceSchedules();
      showToast('Maintenance schedule created successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create maintenance schedule';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isSchedulingRef.current = false;
    }
  };

  const updateMaintenanceSchedule = async (scheduleId: string, updates: Partial<MaintenanceSchedule>) => {
    if (isUpdatingScheduleRef.current) return;
    isUpdatingScheduleRef.current = true;
    try {
      await InventoryService.updateMaintenanceSchedule(scheduleId, updates);
      await loadMaintenanceSchedules();
      showToast('Maintenance schedule updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update maintenance schedule';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isUpdatingScheduleRef.current = false;
    }
  };

  const completeMaintenance = async (scheduleId: string, notes?: string) => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    try {
      await InventoryService.completeMaintenance(scheduleId, notes);
      await loadMaintenanceSchedules();
      showToast('Maintenance completed successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete maintenance';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isCompletingRef.current = false;
    }
  };

  const acknowledgeAlert = async (alertId: string, acknowledgedBy: string) => {
    if (isAcknowledgingRef.current) return;
    isAcknowledgingRef.current = true;
    try {
      await InventoryService.acknowledgeAlert(alertId, acknowledgedBy);
      await loadAlerts();
      showToast('Alert acknowledged', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge alert';
      showToast(errorMessage, 'error');
      throw err;
    } finally {
      isAcknowledgingRef.current = false;
    }
  };

  const checkAndGenerateAlerts = async () => {
    try {
      await InventoryService.checkAndGenerateAlerts();
      await loadAlerts();
      showToast('Alerts checked and generated', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check alerts';
      showToast(errorMessage, 'error');
    }
  };

  return {
    items,
    loading,
    error,
    loadItems,
    createItem,
    updateItem,
    deleteItem,
    checkOutItem,
    checkInItem,
    maintenanceSchedules,
    alerts,
    loadMaintenanceSchedules,
    loadAlerts,
    createMaintenanceSchedule,
    updateMaintenanceSchedule,
    completeMaintenance,
    acknowledgeAlert,
    checkAndGenerateAlerts,
  };
};

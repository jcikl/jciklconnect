// Inventory Data Hook
import { useState, useEffect } from 'react';
import { InventoryService } from '../services/inventoryService';
import { InventoryItem, MaintenanceSchedule, InventoryAlert } from '../types';
import { useToast } from '../components/ui/Common';

export const useInventory = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await InventoryService.getAllItems();
      setItems(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load inventory items';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const createItem = async (itemData: Omit<InventoryItem, 'id'>) => {
    try {
      const id = await InventoryService.createItem(itemData);
      await loadItems();
      showToast('Inventory item created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create inventory item';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateItem = async (itemId: string, updates: Partial<InventoryItem>) => {
    try {
      await InventoryService.updateItem(itemId, updates);
      await loadItems();
      showToast('Inventory item updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update inventory item';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await InventoryService.deleteItem(itemId);
      await loadItems();
      showToast('Inventory item deleted successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete inventory item';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const checkOutItem = async (itemId: string, memberId: string, expectedReturnDate?: string) => {
    try {
      await InventoryService.checkOutItem(itemId, memberId, expectedReturnDate ? new Date(expectedReturnDate) : undefined);
      await loadItems();
      showToast('Item checked out successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check out item';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const checkInItem = async (itemId: string) => {
    try {
      await InventoryService.checkInItem(itemId);
      await loadItems();
      showToast('Item checked in successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check in item';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

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
    try {
      await InventoryService.createMaintenanceSchedule(schedule);
      await loadMaintenanceSchedules();
      showToast('Maintenance schedule created successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create maintenance schedule';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const updateMaintenanceSchedule = async (scheduleId: string, updates: Partial<MaintenanceSchedule>) => {
    try {
      await InventoryService.updateMaintenanceSchedule(scheduleId, updates);
      await loadMaintenanceSchedules();
      showToast('Maintenance schedule updated successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update maintenance schedule';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const completeMaintenance = async (scheduleId: string, notes?: string) => {
    try {
      await InventoryService.completeMaintenance(scheduleId, notes);
      await loadMaintenanceSchedules();
      showToast('Maintenance completed successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete maintenance';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const acknowledgeAlert = async (alertId: string, acknowledgedBy: string) => {
    try {
      await InventoryService.acknowledgeAlert(alertId, acknowledgedBy);
      await loadAlerts();
      showToast('Alert acknowledged', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge alert';
      showToast(errorMessage, 'error');
      throw err;
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


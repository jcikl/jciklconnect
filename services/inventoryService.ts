// Inventory Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  deleteField,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { InventoryItem, MaintenanceSchedule, InventoryAlert, StockMovement } from '../types';
import { withDevMode } from '../utils/devMode';
import { MOCK_INVENTORY } from './mockData';
import { removeUndefined } from '../utils/dataUtils';
import { apiCache } from './cacheService';
import { errorLoggingService } from './errorLoggingService';

export class InventoryService {
  // ── Cache helpers ──────────────────────────────────────────────────────────
  private static readonly CACHE_ALL = 'inventory:all';
  private static readonly CACHE_ITEM_PREFIX = 'inventory:item:';
  private static readonly CACHE_MOVEMENTS_PREFIX = 'inventory:movements:';
  private static readonly CACHE_ALERTS = 'inventory:alerts';
  private static readonly CACHE_MAINTENANCE = 'inventory:maintenance';
  private static readonly CACHE_TTL = 3 * 60 * 1000; // 3 min

  private static invalidateInventoryCache(itemId?: string): void {
    apiCache.delete(InventoryService.CACHE_ALL);
    if (itemId) {
      apiCache.delete(`${InventoryService.CACHE_ITEM_PREFIX}${itemId}`);
    }
  }

  private static invalidateMovementsCache(itemId: string): void {
    apiCache.delete(`${InventoryService.CACHE_MOVEMENTS_PREFIX}${itemId}`);
  }

  private static invalidateAlertsCache(): void {
    apiCache.delete(InventoryService.CACHE_ALERTS);
  }

  private static invalidateMaintenanceCache(): void {
    apiCache.delete(InventoryService.CACHE_MAINTENANCE);
  }

  // Get all inventory items
  static async getAllItems(): Promise<InventoryItem[]> {
    return withDevMode(
      () => MOCK_INVENTORY,
      async () => {
        return apiCache.getOrSet(
          InventoryService.CACHE_ALL,
          async () => {
            try {
              const snapshot = await getDocs(
                query(collection(db, COLLECTIONS.INVENTORY), orderBy('name', 'asc'))
              );
              return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
              } as InventoryItem));
            } catch (error) {
              errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'getAllItems' });
              throw error;
            }
          },
          InventoryService.CACHE_TTL,
          'InventoryService.getAllItems'
        );
      }
    );
  }

  // Get item by ID
  static async getItemById(itemId: string): Promise<InventoryItem | null> {
    return withDevMode(
      () => MOCK_INVENTORY.find(item => item.id === itemId) || null,
      async () => {
        return apiCache.getOrSet(
          `${InventoryService.CACHE_ITEM_PREFIX}${itemId}`,
          async () => {
            try {
              const docRef = doc(db, COLLECTIONS.INVENTORY, itemId);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as InventoryItem;
              }
              return null;
            } catch (error) {
              errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'getItemById' });
              throw error;
            }
          },
          InventoryService.CACHE_TTL,
          'InventoryService.getItemById'
        );
      }
    );
  }

  // Get items by category
  static async getItemsByCategory(category: string): Promise<InventoryItem[]> {
    return withDevMode(
      () => MOCK_INVENTORY.filter(item => item.category === category),
      async () => {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.INVENTORY),
          where('category', '==', category),
          orderBy('name', 'asc')
        )
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryItem));
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'getItemsByCategory' });
      throw error;
    }
});
  }

  // Add new item
  static async addItem(item: Omit<InventoryItem, 'id'>): Promise<string> {
    return withDevMode(
      () => { console.log('[DEV MODE] Adding inventory item:', item); return `mock_item_${Date.now()}`; },
      async () => {
    try {
      const newItem = {
        ...item,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const cleanItem = removeUndefined(newItem);
      const docRef = await addDoc(collection(db, COLLECTIONS.INVENTORY), cleanItem);
      InventoryService.invalidateInventoryCache();
      return docRef.id;
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'addItem' });
      throw error;
    }
});
  }

  // Update item
  static async updateItem(itemId: string, updates: Partial<InventoryItem>): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Updating inventory item ${itemId}:`, updates); },
      async () => {
    try {
      const docRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      const updatesData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      const cleanUpdates = removeUndefined(updatesData);
      await updateDoc(docRef, cleanUpdates);
      InventoryService.invalidateInventoryCache(itemId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'updateItem' });
      throw error;
    }
});
  }

  // Delete item
  static async deleteItem(itemId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Deleting inventory item ${itemId}`); },
      async () => {
    try {
      const [movementsSnap, alertsSnap, schedulesSnap] = await Promise.all([
        getDocs(query(collection(db, COLLECTIONS.STOCK_MOVEMENTS), where('itemId', '==', itemId))),
        getDocs(query(collection(db, COLLECTIONS.INVENTORY_ALERTS), where('itemId', '==', itemId))),
        getDocs(query(collection(db, COLLECTIONS.MAINTENANCE_SCHEDULES), where('itemId', '==', itemId))),
      ]);
      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTIONS.INVENTORY, itemId));
      movementsSnap.docs.forEach(d => batch.delete(d.ref));
      alertsSnap.docs.forEach(d => batch.delete(d.ref));
      schedulesSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      InventoryService.invalidateInventoryCache(itemId);
      InventoryService.invalidateMovementsCache(itemId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'deleteItem' });
      throw error;
    }
});
  }

  // Get low stock items
  static async getLowStockItems(): Promise<InventoryItem[]> {
    return withDevMode(
      () => MOCK_INVENTORY.filter(item => item.quantity <= (item.minQuantity || 0)),
      async () => {
    try {
      const allItems = await this.getAllItems();
      return allItems.filter(item =>
        item.quantity <= (item.minQuantity || 0)
      );
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'getLowStockItems' });
      throw error;
    }
});
  }

  // Get maintenance schedules
  static async getMaintenanceSchedules(): Promise<MaintenanceSchedule[]> {
    return withDevMode<MaintenanceSchedule[]>(
      () => {
        const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        return [
          {
            id: 'maint_1',
            itemId: 'i1',
            type: 'Preventive',
            frequency: 'Monthly',
            description: 'Regular maintenance check',
            scheduledDate: in7Days,
            nextMaintenanceDate: in7Days,
            status: 'Scheduled',
            assignedTo: 'u1',
            estimatedDuration: 120,
            priority: 'Medium',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'maint_2',
            itemId: 'i2',
            type: 'Inspection',
            frequency: 'Quarterly',
            description: 'Calibration and lens check',
            scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            nextMaintenanceDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'Scheduled',
            assignedTo: 'u2',
            estimatedDuration: 60,
            priority: 'High',
            createdAt: new Date().toISOString(),
          },
        ];
      },
      async () => {
    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.MAINTENANCE_SCHEDULES), orderBy('scheduledDate', 'asc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastMaintained: doc.data().lastMaintained?.toDate?.()?.toISOString() || doc.data().lastMaintained,
        nextMaintenanceDate: doc.data().nextMaintenanceDate?.toDate?.()?.toISOString() || doc.data().nextMaintenanceDate,
      } as MaintenanceSchedule));
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'getMaintenanceSchedules' });
      throw error;
    }
});
  }

  // Get inventory alerts
  static async getInventoryAlerts(itemId?: string, acknowledged?: boolean): Promise<InventoryAlert[]> {
    return withDevMode(
      () => {
        const list: InventoryAlert[] = [
          {
            id: 'alert_1',
            itemId: 'i2',
            type: 'Out of Stock',
            severity: 'High',
            message: 'Projector 4K is out of stock.',
            acknowledged: false,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'alert_2',
            itemId: 'i3',
            type: 'Low Stock',
            severity: 'Medium',
            message: 'Event T-Shirts (L) quantity is below recommended level.',
            acknowledged: false,
            createdAt: new Date().toISOString(),
          },
        ];
        if (acknowledged !== undefined) {
          return list.filter((a) => a.acknowledged === acknowledged);
        }
        return list;
      },
      async () => {
    try {
      let q = query(collection(db, COLLECTIONS.INVENTORY_ALERTS), orderBy('createdAt', 'desc'));

      if (itemId) {
        q = query(q, where('itemId', '==', itemId));
      }

      if (acknowledged !== undefined) {
        q = query(q, where('acknowledged', '==', acknowledged));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        acknowledgedAt: doc.data().acknowledgedAt?.toDate?.()?.toISOString() || doc.data().acknowledgedAt,
      } as InventoryAlert));
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'getInventoryAlerts' });
      throw error;
    }
});
  }

  // Create inventory alert
  static async createAlert(alert: Omit<InventoryAlert, 'id' | 'createdAt' | 'acknowledged'>): Promise<string> {
    return withDevMode(
      () => { console.log('[DEV MODE] Creating inventory alert:', alert); return `mock_alert_${Date.now()}`; },
      async () => {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.INVENTORY_ALERTS), {
        ...alert,
        acknowledged: false,
        createdAt: Timestamp.now(),
      });
      InventoryService.invalidateAlertsCache();
      return docRef.id;
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'createAlert' });
      throw error;
    }
});
  }

  // Generate alerts for low stock and maintenance
  static async generateAlerts(): Promise<void> {
    return withDevMode(
      () => { console.log('[DEV MODE] Generating inventory alerts'); },
      async () => {
    try {
      // Fetch all data and existing unacknowledged alerts in parallel (3 queries total, not 3×N)
      const [items, maintenanceSchedules, existingAlertsSnap] = await Promise.all([
        this.getAllItems(),
        this.getMaintenanceSchedules(),
        getDocs(query(
          collection(db, COLLECTIONS.INVENTORY_ALERTS),
          where('acknowledged', '==', false)
        )),
      ]);

      // Build an in-memory set of (itemId, type) pairs that already have active alerts
      const activeAlertKeys = new Set<string>();
      existingAlertsSnap.docs.forEach(d => {
        const data = d.data();
        activeAlertKeys.add(`${data.itemId}::${data.type}`);
      });

      type NewAlert = { itemId: string; type: string; severity: string; message: string };
      const newAlerts: NewAlert[] = [];

      // Check for low stock / out-of-stock items
      for (const item of items) {
        if (item.quantity <= (item.minQuantity || 0)) {
          const alertType = 'Low Stock';
          if (!activeAlertKeys.has(`${item.id}::${alertType}`)) {
            newAlerts.push({
              itemId: item.id,
              type: alertType,
              severity: item.quantity === 0 ? 'Critical' : 'High',
              message: `${item.name} is ${item.quantity === 0 ? 'out of stock' : `low (${item.quantity} remaining, minimum: ${item.minQuantity})`}`,
            });
          }
        }

        // Check for overdue returns
        if (item.status === 'Checked Out' && item.expectedReturnDate) {
          const returnDate = new Date(item.expectedReturnDate);
          if (returnDate < new Date()) {
            const alertType = 'Overdue Return';
            if (!activeAlertKeys.has(`${item.id}::${alertType}`)) {
              newAlerts.push({
                itemId: item.id,
                type: alertType,
                severity: 'Medium',
                message: `${item.name} is overdue for return (expected: ${item.expectedReturnDate})`,
              });
            }
          }
        }
      }

      // Check for upcoming / overdue maintenance
      const now = new Date();
      const itemMap = new Map(items.map(i => [i.id, i]));
      for (const schedule of maintenanceSchedules) {
        if (!schedule.scheduledDate) continue;
        const scheduledDate = new Date(schedule.scheduledDate);
        const daysUntil = Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil <= 7 && daysUntil >= -7) {
          const alertType = 'Maintenance Due';
          if (!activeAlertKeys.has(`${schedule.itemId}::${alertType}`)) {
            const item = itemMap.get(schedule.itemId);
            newAlerts.push({
              itemId: schedule.itemId,
              type: alertType,
              severity: daysUntil < 0 ? 'High' : 'Medium',
              message: `${item?.name || 'Item'} requires ${schedule.type.toLowerCase()} maintenance (${schedule.type})`,
            });
          }
        }
      }

      // Write all new alerts atomically in a single batch
      if (newAlerts.length > 0) {
        const batch = writeBatch(db);
        newAlerts.forEach(alert => {
          batch.set(doc(collection(db, COLLECTIONS.INVENTORY_ALERTS)), {
            ...alert,
            acknowledged: false,
            createdAt: Timestamp.now(),
          });
        });
        await batch.commit();
        InventoryService.invalidateAlertsCache();
      }
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'generateAlerts' });
      throw error;
    }
});
  }

  /**
   * Link a financial transaction to an inventory item
   * This creates a relationship between financial transactions and inventory items
   */
  static async linkTransactionToInventory(
    transactionId: string,
    itemId: string,
    quantity: number,
    unitPrice: number
  ): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Linking transaction ${transactionId} to inventory item ${itemId}`); },
      async () => {
    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        throw new Error(`Inventory item ${itemId} not found`);
      }

      // Update item with transaction reference
      const itemRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      await updateDoc(itemRef, {
        lastTransactionId: transactionId,
        lastTransactionDate: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      InventoryService.invalidateInventoryCache(itemId);

      // Update quantity based on transaction type (handled by caller)
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'linkTransactionToInventory' });
      throw error;
    }
});
  }

  /**
   * Record merchandise purchase (increases inventory)
   */
  static async recordMerchandisePurchase(
    itemId: string,
    quantity: number,
    transactionId: string,
    unitCost: number
  ): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Recording purchase of ${quantity} units for item ${itemId}`); },
      async () => {
    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        throw new Error(`Inventory item ${itemId} not found`);
      }

      const newQuantity = item.quantity + quantity;
      const batch = writeBatch(db);
      const itemRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      batch.update(itemRef, {
        quantity: newQuantity,
        status: newQuantity === 0 ? 'Out of Stock' : (newQuantity <= (item.minQuantity || 0) ? 'Low Stock' : 'Available'),
        purchasePrice: unitCost,
        purchaseDate: new Date().toISOString(),
        lastTransactionId: transactionId,
        lastTransactionDate: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      const movementRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
      batch.set(movementRef, {
        itemId,
        itemName: item.name,
        type: 'In',
        quantity,
        previousQuantity: item.quantity,
        newQuantity,
        reason: 'Purchase',
        performedBy: 'System',
        date: Timestamp.now(),
      });
      await batch.commit();
      InventoryService.invalidateInventoryCache(itemId);
      InventoryService.invalidateMovementsCache(itemId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'recordMerchandisePurchase' });
      throw error;
    }
});
  }

  /**
   * Record merchandise sale (decreases inventory)
   */
  static async recordMerchandiseSale(
    itemId: string,
    quantity: number,
    transactionId: string,
    unitPrice: number
  ): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Recording sale of ${quantity} units for item ${itemId}`); },
      async () => {
    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        throw new Error(`Inventory item ${itemId} not found`);
      }

      if (item.quantity < quantity) {
        throw new Error(`Insufficient inventory: ${item.quantity} available, ${quantity} requested`);
      }

      const newQuantity = item.quantity - quantity;
      const batch = writeBatch(db);
      const itemRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      batch.update(itemRef, {
        quantity: newQuantity,
        status: newQuantity === 0 ? 'Out of Stock' : (newQuantity <= (item.minQuantity || 0) ? 'Low Stock' : 'Available'),
        lastSaleDate: new Date().toISOString(),
        lastTransactionId: transactionId,
        lastTransactionDate: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      const movementRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
      batch.set(movementRef, {
        itemId,
        itemName: item.name,
        type: 'Out',
        quantity: -quantity,
        previousQuantity: item.quantity,
        newQuantity,
        reason: 'Sale',
        performedBy: 'System',
        date: Timestamp.now(),
      });
      await batch.commit();
      InventoryService.invalidateInventoryCache(itemId);
      InventoryService.invalidateMovementsCache(itemId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'recordMerchandiseSale' });
      throw error;
    }
});
  }

  /**
   * Validates that inventory records match financial transaction records
   */
  static async verifyInventoryFinanceConsistency(
    itemId: string,
    transactionId: string
  ): Promise<{
    consistent: boolean;
    issues: string[];
    inventoryValue: number;
    transactionValue: number;
  }> {
    return withDevMode<{ consistent: boolean; issues: string[]; inventoryValue: number; transactionValue: number }>(
      () => ({
        consistent: true,
        issues: [],
        inventoryValue: 100,
        transactionValue: 100,
      }),
      async () => {
    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        return {
          consistent: false,
          issues: ['Inventory item not found'],
          inventoryValue: 0,
          transactionValue: 0,
        };
      }

      const issues: string[] = [];

      // Fetch only the specific transaction to avoid loading all records
      const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
      const transactionSnap = await getDoc(transactionRef);
      const transaction = transactionSnap.exists()
        ? { id: transactionSnap.id, ...transactionSnap.data() } as { id: string; amount?: number }
        : null;

      if (!transaction) {
        issues.push('Transaction not found');
      }

      // Check if item has transaction reference
      if ((item as any).lastTransactionId !== transactionId) {
        issues.push('Inventory item not linked to this transaction');
      }

      const inventoryValue = item.quantity * (item.purchasePrice || 0);
      const transactionValue = transaction?.amount || 0;

      if (Math.abs(inventoryValue - transactionValue) > 0.01) {
        issues.push(`Value mismatch: inventory ${inventoryValue}, transaction ${transactionValue}`);
      }

      return {
        consistent: issues.length === 0,
        issues,
        inventoryValue,
        transactionValue,
      };
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'verifyInventoryFinanceConsistency' });
      throw error;
    }
});
  }

  /**
   * Get all merchandise items (items in Merchandise category)
   */
  static async getMerchandiseItems(): Promise<InventoryItem[]> {
    try {
      return await this.getItemsByCategory('Merchandise');
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'getMerchandiseItems' });
      throw error;
    }
  }

  /**
   * Reconcile merchandise inventory with financial records
   * Returns discrepancies between inventory and financial data
   */
  static async reconcileMerchandiseInventory(): Promise<{
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
  }> {
    return withDevMode(
      () => ({
        totalItems: 5,
        consistentItems: 4,
        inconsistentItems: 1,
        discrepancies: [
          {
            itemId: 'item_1',
            itemName: 'Sample Item',
            issues: ['Value mismatch'],
            inventoryValue: 100,
            transactionValue: 95,
          }
        ],
      }),
      async () => {
    try {
      const merchandiseItems = await this.getMerchandiseItems();
      const discrepancies: Array<{
        itemId: string;
        itemName: string;
        issues: string[];
        inventoryValue: number;
        transactionValue: number;
      }> = [];

      let consistentItems = 0;

      for (const item of merchandiseItems) {
        const lastTransactionId = (item as any).lastTransactionId;
        if (lastTransactionId) {
          const verification = await this.verifyInventoryFinanceConsistency(
            item.id,
            lastTransactionId
          );

          if (!verification.consistent) {
            discrepancies.push({
              itemId: item.id,
              itemName: item.name,
              issues: verification.issues,
              inventoryValue: verification.inventoryValue,
              transactionValue: verification.transactionValue,
            });
          } else {
            consistentItems++;
          }
        }
      }

      return {
        totalItems: merchandiseItems.length,
        consistentItems,
        inconsistentItems: discrepancies.length,
        discrepancies,
      };
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'reconcileMerchandiseInventory' });
      throw error;
    }
});
  }

  // Get items with depreciation calculations
  static async getItemsWithDepreciation(): Promise<(InventoryItem & { calculatedValue?: number })[]> {
    const items = await this.getAllItems();

    return items.map(item => {
      let calculatedValue = item.currentValue || item.purchasePrice || 0;

      // Calculate depreciation if applicable
      if (item.purchaseDate && item.purchasePrice && item.depreciationMethod && item.depreciationMethod !== 'None') {
        const purchaseDate = new Date(item.purchaseDate);
        const currentDate = new Date();
        const yearsElapsed = (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

        if (item.depreciationMethod === 'Straight Line' && item.usefulLife) {
          const annualDepreciation = item.purchasePrice / item.usefulLife;
          calculatedValue = Math.max(0, item.purchasePrice - (annualDepreciation * yearsElapsed));
        } else if (item.depreciationMethod === 'Declining Balance' && item.depreciationRate) {
          calculatedValue = item.purchasePrice * Math.pow(1 - (item.depreciationRate / 100), yearsElapsed);
        }
      }

      return {
        ...item,
        calculatedValue
      };
    });
  }

  // Calculate depreciation for a single item
  static calculateDepreciation(item: InventoryItem): number {
    let calculatedValue = item.currentValue || item.purchasePrice || 0;

    // Calculate depreciation if applicable
    if (item.purchaseDate && item.purchasePrice && item.depreciationMethod && item.depreciationMethod !== 'None') {
      const purchaseDate = new Date(item.purchaseDate);
      const currentDate = new Date();
      const yearsElapsed = (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

      if (item.depreciationMethod === 'Straight Line' && item.usefulLife) {
        const annualDepreciation = item.purchasePrice / item.usefulLife;
        calculatedValue = Math.max(0, item.purchasePrice - (annualDepreciation * yearsElapsed));
      } else if (item.depreciationMethod === 'Declining Balance' && item.depreciationRate) {
        calculatedValue = item.purchasePrice * Math.pow(1 - (item.depreciationRate / 100), yearsElapsed);
      }
    }

    return calculatedValue;
  }

  // Create new item
  static async createItem(itemData: Omit<InventoryItem, 'id'>): Promise<string> {
    return await this.addItem(itemData);
  }

  // Check out item
  static async checkOutItem(itemId: string, memberId: string, expectedReturnDate?: Date): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Checking out item ${itemId} to member ${memberId}`); },
      async () => {
    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      if (item.status !== 'Available') {
        throw new Error('Item is not available for checkout');
      }

      const batch = writeBatch(db);
      const itemRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      const quantityAfterCheckout = item.quantity - 1;
      batch.update(itemRef, {
        status: 'Checked Out',
        checkedOutTo: memberId,
        checkedOutDate: new Date().toISOString(),
        expectedReturnDate: expectedReturnDate?.toISOString() ?? deleteField(),
        quantity: increment(-1),
        updatedAt: Timestamp.now(),
      });
      const movementRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
      batch.set(movementRef, {
        itemId,
        itemName: item.name,
        type: 'Out',
        quantity: 1,
        previousQuantity: item.quantity,
        newQuantity: quantityAfterCheckout,
        reason: 'Checkout',
        performedBy: memberId,
        date: Timestamp.now(),
        createdAt: Timestamp.now(),
        reference: 'manual checkout',
      });
      await batch.commit();
      InventoryService.invalidateInventoryCache(itemId);
      InventoryService.invalidateMovementsCache(itemId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'checkOutItem' });
      throw error;
    }
});
  }

  // Check in item
  static async checkInItem(itemId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Checking in item ${itemId}`); },
      async () => {
    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }
      if (item.status !== 'Checked Out') {
        throw new Error('Item is not currently checked out — cannot check in');
      }
      const quantityAfterCheckin = item.quantity + 1;
      const batch = writeBatch(db);
      const docRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      batch.update(docRef, {
        status: 'Available',
        checkedOutTo: deleteField(),
        checkedOutDate: deleteField(),
        expectedReturnDate: deleteField(),
        returnedDate: new Date().toISOString(),
        quantity: increment(1),
        updatedAt: Timestamp.now(),
      });
      const movementRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
      batch.set(movementRef, {
        itemId,
        itemName: item.name,
        type: 'In',
        quantity: 1,
        previousQuantity: item.quantity,
        newQuantity: quantityAfterCheckin,
        reason: 'Checkin',
        performedBy: (item as any).checkedOutTo || 'unknown',
        date: Timestamp.now(),
        createdAt: Timestamp.now(),
        reference: 'manual checkin',
      });
      await batch.commit();
      InventoryService.invalidateInventoryCache(itemId);
      InventoryService.invalidateMovementsCache(itemId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'checkInItem' });
      throw error;
    }
});
  }

  // Get alerts with filtering
  static async getAlerts(acknowledged?: boolean): Promise<InventoryAlert[]> {
    return await this.getInventoryAlerts(undefined, acknowledged);
  }

  // Create maintenance schedule
  static async createMaintenanceSchedule(schedule: Omit<MaintenanceSchedule, 'id'>): Promise<string> {
    return withDevMode(
      () => { console.log('[DEV MODE] Creating maintenance schedule:', schedule); return `schedule_${Date.now()}`; },
      async () => {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.MAINTENANCE_SCHEDULES), {
        ...schedule,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      InventoryService.invalidateMaintenanceCache();
      return docRef.id;
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'createMaintenanceSchedule' });
      throw error;
    }
});
  }

  // Update maintenance schedule
  static async updateMaintenanceSchedule(scheduleId: string, updates: Partial<MaintenanceSchedule>): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Updating maintenance schedule ${scheduleId}:`, updates); },
      async () => {
    try {
      const docRef = doc(db, COLLECTIONS.MAINTENANCE_SCHEDULES, scheduleId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
      InventoryService.invalidateMaintenanceCache();
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'updateMaintenanceSchedule' });
      throw error;
    }
});
  }

  // Complete maintenance
  static async completeMaintenance(scheduleId: string, notes?: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Completing maintenance ${scheduleId} with notes:`, notes); },
      async () => {
    try {
      const scheduleRef = doc(db, COLLECTIONS.MAINTENANCE_SCHEDULES, scheduleId);
      const scheduleSnap = await getDoc(scheduleRef);
      if (!scheduleSnap.exists()) {
        throw new Error(`Maintenance schedule ${scheduleId} not found`);
      }
      const schedule = scheduleSnap.data() as MaintenanceSchedule;
      const now = Timestamp.now();
      const completedDate = new Date().toISOString();

      const batch = writeBatch(db);
      batch.update(scheduleRef, {
        status: 'Completed',
        completedDate,
        notes: notes ?? deleteField(),
        updatedAt: now,
      });
      // Sync lastCheckedAt on the inventory item so it reflects the latest maintenance
      const itemRef = doc(db, COLLECTIONS.INVENTORY, schedule.itemId);
      batch.update(itemRef, {
        lastCheckedAt: completedDate,
        updatedAt: now,
      });
      await batch.commit();
      InventoryService.invalidateMaintenanceCache();
      InventoryService.invalidateInventoryCache(schedule.itemId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'completeMaintenance' });
      throw error;
    }
});
  }

  // Acknowledge alert
  static async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Acknowledging alert ${alertId} by ${acknowledgedBy}`); },
      async () => {
    try {
      const docRef = doc(db, COLLECTIONS.INVENTORY_ALERTS, alertId);
      await updateDoc(docRef, {
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: Timestamp.now()
      });
      InventoryService.invalidateAlertsCache();
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'acknowledgeAlert' });
      throw error;
    }
});
  }

  // Check and generate alerts
  static async checkAndGenerateAlerts(): Promise<void> {
    return await this.generateAlerts();
  }

  // Update item depreciation
  static async updateItemDepreciation(itemId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Updating depreciation for item ${itemId}`); },
      async () => {
    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      const calculatedValue = this.calculateDepreciation(item);
      await this.updateItem(itemId, {
        currentValue: calculatedValue,
        lastDepreciationUpdate: new Date().toISOString()
      });
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'updateItemDepreciation' });
      throw error;
    }
});
  }

  /**
   * Update quantity of a specific variant (size)
   * operation: 'increment' (for purchases/restock) or 'decrement' (for sales/issue)
   */
  static async updateVariantQuantity(
    itemId: string,
    variantSize: string,
    quantity: number,
    operation: 'increment' | 'decrement',
    referenceId?: string
  ): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Updating variant ${variantSize} quantity for item ${itemId} by ${quantity} (${operation})`); },
      async () => {
    try {
      const item = await this.getItemById(itemId);
      if (!item) throw new Error(`Inventory item ${itemId} not found`);

      const variants = [...(item.variants || [])];
      const variantIndex = variants.findIndex(v => v.size === variantSize);

      if (variantIndex > -1) {
        const change = operation === 'increment' ? quantity : -quantity;
        variants[variantIndex].quantity += change;
      } else if (operation === 'increment') {
        // Add new variant if it doesn't exist and we are incrementing
        variants.push({ size: variantSize, quantity: quantity });
      } else {
        // If decrementing but variant doesn't exist, we can't do much unless we want to allow negative
        // For simplicity, let's just add it as negative if user really wants to
        variants.push({ size: variantSize, quantity: -quantity });
      }

      // Update total quantity as well (sum of all variants)
      const newTotalQuantity = variants.reduce((sum, v) => sum + v.quantity, 0);

      const batch = writeBatch(db);
      const itemRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      batch.update(itemRef, {
        variants,
        quantity: newTotalQuantity,
        status: newTotalQuantity === 0 ? 'Out of Stock' : (newTotalQuantity <= (item.minQuantity || 0) ? 'Low Stock' : 'Available'),
        updatedAt: Timestamp.now(),
      });
      const movementRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
      const movementData: Record<string, unknown> = {
        itemId,
        itemName: item.name,
        type: operation === 'increment' ? 'In' : 'Out',
        quantity: operation === 'increment' ? quantity : -quantity,
        previousQuantity: item.quantity,
        newQuantity: newTotalQuantity,
        variant: variantSize,
        reason: operation === 'increment' ? 'Restock' : 'Sale',
        performedBy: 'System',
        date: Timestamp.now(),
      };
      if (referenceId !== undefined) movementData.referenceId = referenceId;
      batch.set(movementRef, movementData);
      await batch.commit();
      InventoryService.invalidateInventoryCache(itemId);
      InventoryService.invalidateMovementsCache(itemId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'updateVariantQuantity' });
      throw error;
    }
});
  }

  // Check if a stock movement exists for a given reference ID (e.g. transaction ID)
  static async hasStockMovementForRef(referenceId: string): Promise<boolean> {
    return withDevMode(
      () => false,
      async () => {
    try {
      const q = query(
        collection(db, COLLECTIONS.STOCK_MOVEMENTS),
        where('referenceId', '==', referenceId),
        limit(1)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'hasStockMovementForRef' });
      return false;
    }
});
  }

  /**
   * Append-only replacement for the former updateStockMovementForRef.
   *
   * Instead of mutating the original movement document (which would destroy the
   * audit trail), this method:
   *   1. Finds the existing movement by referenceId.
   *   2. Writes a COMPENSATION movement that negates the original (append-only).
   *   3. Writes a NEW movement for the updated values.
   *   4. Applies the net inventory delta atomically via writeBatch.
   *
   * If no movement exists yet, it falls through to updateVariantQuantity (first
   * write path).  Callers in financeService do not need to change.
   */
  static async updateStockMovementForRef(
    referenceId: string,
    details: {
      itemId: string;
      variantSize: string;
      quantity: number;
      operation: 'increment' | 'decrement';
    }
  ): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          const q = query(
            collection(db, COLLECTIONS.STOCK_MOVEMENTS),
            where('referenceId', '==', referenceId),
            limit(1)
          );
          const snapshot = await getDocs(q);

          if (snapshot.empty) {
            // No previous movement → create it from scratch (first-write path)
            await this.updateVariantQuantity(
              details.itemId,
              details.variantSize,
              details.quantity,
              details.operation,
              referenceId
            );
            return;
          }

          // ── Append-only update path ──────────────────────────────────────
          const originalMovementDoc = snapshot.docs[0];
          const originalMovement = originalMovementDoc.data() as StockMovement;
          const originalSignedQty = originalMovement.quantity; // may be negative for 'Out'

          const newSignedQty = details.operation === 'increment' ? details.quantity : -details.quantity;
          // Net inventory delta = new desired quantity − what was previously applied
          const netDelta = newSignedQty - originalSignedQty;

          const [oldItem, newItem] = await Promise.all([
            this.getItemById(originalMovement.itemId),
            originalMovement.itemId !== details.itemId
              ? this.getItemById(details.itemId)
              : Promise.resolve(null),
          ]);
          const targetItem = newItem ?? oldItem;
          if (!targetItem) {
            throw new Error(`Inventory item not found for updateStockMovementForRef ref=${referenceId}`);
          }

          const batch = writeBatch(db);

          // 1. Compensation movement — negates the original so the log is coherent
          const compensationRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
          batch.set(compensationRef, {
            itemId: originalMovement.itemId,
            itemName: originalMovement.itemName ?? targetItem.name,
            type: originalMovement.type === 'In' ? 'Out' : 'In',
            quantity: -originalSignedQty,
            reason: 'Compensation',
            compensatesMovementId: originalMovementDoc.id,
            referenceId,
            performedBy: 'System',
            date: Timestamp.now(),
          });

          // 2. New movement for the updated values
          const newMovementRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
          batch.set(newMovementRef, {
            itemId: details.itemId,
            itemName: targetItem.name,
            variant: details.variantSize,
            type: details.operation === 'increment' ? 'In' : 'Out',
            quantity: newSignedQty,
            reason: details.operation === 'increment' ? 'Restock' : 'Sale',
            referenceId,
            performedBy: 'System',
            date: Timestamp.now(),
          });

          // 3. Update inventory quantity by net delta only (no mutation of movement docs)
          if (originalMovement.itemId !== details.itemId) {
            // Item changed — reverse the original on the old item, apply new on new item
            const oldItemRef = doc(db, COLLECTIONS.INVENTORY, originalMovement.itemId);
            batch.update(oldItemRef, {
              quantity: increment(-originalSignedQty),
              updatedAt: Timestamp.now(),
            });
            const newItemRef = doc(db, COLLECTIONS.INVENTORY, details.itemId);
            const newItemData = await this.getItemById(details.itemId);
            if (newItemData) {
              const variants = [...(newItemData.variants || [])];
              const vi = variants.findIndex(v => v.size === details.variantSize);
              if (vi > -1) variants[vi].quantity += newSignedQty;
              else variants.push({ size: details.variantSize, quantity: newSignedQty });
              batch.update(newItemRef, {
                variants,
                quantity: increment(newSignedQty),
                updatedAt: Timestamp.now(),
              });
            }
          } else if (netDelta !== 0) {
            // Same item — apply net delta
            const itemRef = doc(db, COLLECTIONS.INVENTORY, details.itemId);
            const variants = [...(targetItem.variants || [])];
            const vi = variants.findIndex(v => v.size === details.variantSize);
            if (vi > -1) variants[vi].quantity += netDelta;
            else variants.push({ size: details.variantSize, quantity: netDelta });
            batch.update(itemRef, {
              variants,
              quantity: increment(netDelta),
              updatedAt: Timestamp.now(),
            });
          }

          await batch.commit();
          InventoryService.invalidateInventoryCache(details.itemId);
          InventoryService.invalidateMovementsCache(details.itemId);
          if (originalMovement.itemId !== details.itemId) {
            InventoryService.invalidateInventoryCache(originalMovement.itemId);
            InventoryService.invalidateMovementsCache(originalMovement.itemId);
          }
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'updateStockMovementForRef' });
          throw error;
        }
      }
    );
  }

  /**
   * Compensate (reverse) a specific stock movement by its document ID.
   * Writes a new movement with negated quantity and links back via
   * `compensatesMovementId`. Updates inventory atomically. Append-only.
   */
  static async compensateStockMovement(originalMovementId: string, reason: string): Promise<string> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Compensating movement ${originalMovementId}`); return `mock_comp_${Date.now()}`; },
      async () => {
        try {
          const originalRef = doc(db, COLLECTIONS.STOCK_MOVEMENTS, originalMovementId);
          const originalSnap = await getDoc(originalRef);
          if (!originalSnap.exists()) {
            throw new Error(`Stock movement ${originalMovementId} not found`);
          }
          const original = originalSnap.data() as StockMovement;
          const compensationQty = -original.quantity; // negate to reverse the effect
          const compensationType = original.type === 'In' ? 'Out' : original.type === 'Out' ? 'In' : 'Adjustment';

          const batch = writeBatch(db);
          const compRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
          batch.set(compRef, {
            itemId: original.itemId,
            itemName: original.itemName,
            type: compensationType,
            quantity: compensationQty,
            reason,
            compensatesMovementId: originalMovementId,
            performedBy: 'System',
            date: Timestamp.now(),
          });
          // Apply the reversed delta to the inventory item
          const itemRef = doc(db, COLLECTIONS.INVENTORY, original.itemId);
          batch.update(itemRef, {
            quantity: increment(compensationQty),
            updatedAt: Timestamp.now(),
          });
          await batch.commit();
          InventoryService.invalidateInventoryCache(original.itemId);
          InventoryService.invalidateMovementsCache(original.itemId);
          return compRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'compensateStockMovement' });
          throw error;
        }
      }
    );
  }

  // Helper to adjust quantity without creating a movement record
  private static async adjustVariantQuantityOnly(itemId: string, variantSize: string, change: number): Promise<void> {
    try {
      const item = await this.getItemById(itemId);
      if (!item) return;

      const variants = [...(item.variants || [])];
      const variantIndex = variants.findIndex(v => v.size === variantSize);

      if (variantIndex > -1) {
        variants[variantIndex].quantity += change;
      } else if (change > 0) {
        variants.push({ size: variantSize, quantity: change });
      } else {
        // Variant not found and consuming? Add negative variant or ignore.
        // For consistency with updateVariantQuantity logic:
        variants.push({ size: variantSize, quantity: change });
      }

      const newTotalQuantity = variants.reduce((sum, v) => sum + v.quantity, 0);

      await this.updateItem(itemId, {
        variants,
        quantity: newTotalQuantity,
        status: newTotalQuantity === 0 ? 'Out of Stock' : (newTotalQuantity <= (item.minQuantity || 0) ? 'Low Stock' : 'Available'),
      });
    } catch (e) {
      errorLoggingService.logError(e as Error, { action: 'InventoryService.adjustVariantQuantityOnly' });
      throw e;
    }
  }

  // Delete stock movement for a reference (reverting inventory)
  static async deleteStockMovementForRef(referenceId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
    try {
      const q = query(
        collection(db, COLLECTIONS.STOCK_MOVEMENTS),
        where('referenceId', '==', referenceId),
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const movementDoc = snapshot.docs[0];
        const movement = movementDoc.data() as StockMovement;

        // Revert inventory and delete movement atomically
        const item = await this.getItemById(movement.itemId);
        if (item) {
          const variantSize = movement.variant || '';
          const change = -movement.quantity;
          const variants = [...(item.variants || [])];
          const variantIndex = variants.findIndex(v => v.size === variantSize);
          if (variantIndex > -1) {
            variants[variantIndex].quantity += change;
          } else if (change > 0) {
            variants.push({ size: variantSize, quantity: change });
          } else {
            variants.push({ size: variantSize, quantity: change });
          }
          const newTotalQuantity = variants.reduce((sum, v) => sum + v.quantity, 0);
          const batch = writeBatch(db);
          const itemRef = doc(db, COLLECTIONS.INVENTORY, movement.itemId);
          batch.update(itemRef, {
            variants,
            quantity: newTotalQuantity,
            status: newTotalQuantity === 0 ? 'Out of Stock' : (newTotalQuantity <= (item.minQuantity || 0) ? 'Low Stock' : 'Available'),
            updatedAt: Timestamp.now(),
          });
          batch.delete(movementDoc.ref);
          await batch.commit();
          InventoryService.invalidateInventoryCache(movement.itemId);
          InventoryService.invalidateMovementsCache(movement.itemId);
        } else {
          // Item no longer exists; just delete the orphan movement
          await deleteDoc(movementDoc.ref);
        }
      }
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'deleteStockMovementForRef' });
      throw error;
    }
});
  }

  // Record a stock movement — atomically updates both the movement log and
  // the inventoryItems.quantity field so the two collections never diverge.
  static async recordStockMovement(movement: Omit<StockMovement, 'id' | 'date'>): Promise<string> {
    return withDevMode(
      () => { console.log('[DEV MODE] Recording stock movement:', movement); return `mock_mov_${Date.now()}`; },
      async () => {
        try {
          // Calculate signed quantity delta:
          //   'In'  → positive (stock increases)
          //   'Out' → negative (stock decreases); stored quantity may already be negative
          //   'Adjustment' → take the signed value as-is
          const absQty = Math.abs(movement.quantity);
          const delta =
            movement.type === 'In'
              ? absQty
              : movement.type === 'Out'
              ? -absQty
              : movement.quantity; // Adjustment is already signed

          const cleanMovement = removeUndefined(movement);
          const batch = writeBatch(db);

          // 1. Append the movement record (append-only — never update existing)
          const movementRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
          batch.set(movementRef, {
            ...cleanMovement,
            date: Timestamp.now(),
          });

          // 2. Atomically update inventory quantity
          const itemRef = doc(db, COLLECTIONS.INVENTORY, movement.itemId);
          batch.update(itemRef, {
            quantity: increment(delta),
            updatedAt: Timestamp.now(),
          });

          await batch.commit();
          InventoryService.invalidateInventoryCache(movement.itemId);
          InventoryService.invalidateMovementsCache(movement.itemId);
          return movementRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'recordStockMovement' });
          throw error;
        }
      }
    );
  }

  // Get stock card (movements) for an item
  static async getStockCard(itemId: string): Promise<StockMovement[]> {
    return withDevMode(
      () => [],
      async () => {
        return apiCache.getOrSet(
          `${InventoryService.CACHE_MOVEMENTS_PREFIX}${itemId}`,
          async () => {
            try {
              const q = query(
                collection(db, COLLECTIONS.STOCK_MOVEMENTS),
                where('itemId', '==', itemId),
                orderBy('date', 'desc')
              );
              const snapshot = await getDocs(q);
              return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                date: d.data().date?.toDate?.()?.toISOString() || d.data().date,
              } as StockMovement));
            } catch (error) {
              errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'getStockCard' });
              throw error;
            }
          },
          InventoryService.CACHE_TTL,
          'InventoryService.getStockCard'
        );
      }
    );
  }

  // Manual stock adjustment
  static async adjustStock(
    itemId: string,
    variantSize: string | undefined,
    adjustmentQuantity: number,
    reason: string,
    performedBy: string
  ): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Adjusting stock for ${itemId} (${variantSize || 'base'}): ${adjustmentQuantity} Reason: ${reason}`); },
      async () => {
    try {
      const item = await this.getItemById(itemId);
      if (!item) throw new Error('Item not found');

      const previousTotal = item.quantity;
      let newTotal = previousTotal;
      let updatedVariants = item.variants ? [...item.variants] : undefined;

      if (variantSize && updatedVariants) {
        const vIdx = updatedVariants.findIndex(v => v.size === variantSize);
        if (vIdx > -1) {
          updatedVariants[vIdx].quantity += adjustmentQuantity;
        } else {
          updatedVariants.push({ size: variantSize, quantity: adjustmentQuantity });
        }
        newTotal = updatedVariants.reduce((sum, v) => sum + v.quantity, 0);
      } else {
        newTotal += adjustmentQuantity;
      }

      const batch = writeBatch(db);
      const itemRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      const itemUpdate: Record<string, unknown> = {
        quantity: newTotal,
        status: newTotal === 0 ? 'Out of Stock' : (newTotal <= (item.minQuantity || 0) ? 'Low Stock' : 'Available'),
        updatedAt: Timestamp.now(),
      };
      if (updatedVariants !== undefined) itemUpdate.variants = updatedVariants;
      batch.update(itemRef, itemUpdate);
      const movementRef = doc(collection(db, COLLECTIONS.STOCK_MOVEMENTS));
      const movementData: Record<string, unknown> = {
        itemId,
        itemName: item.name,
        type: 'Adjustment',
        quantity: adjustmentQuantity,
        previousQuantity: previousTotal,
        newQuantity: newTotal,
        reason,
        performedBy,
        date: Timestamp.now(),
      };
      if (variantSize !== undefined) movementData.variant = variantSize;
      batch.set(movementRef, movementData);
      await batch.commit();
      InventoryService.invalidateInventoryCache(itemId);
      InventoryService.invalidateMovementsCache(itemId);
    } catch (error) {
      errorLoggingService.logError(error as Error, { component: 'InventoryService', action: 'adjustStock' });
      throw error;
    }
});
  }
}
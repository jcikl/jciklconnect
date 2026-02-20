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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { InventoryItem, MaintenanceSchedule, InventoryAlert, StockMovement } from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_INVENTORY } from './mockData';
import { removeUndefined } from '../utils/dataUtils';

export class InventoryService {
  // Get all inventory items
  static async getAllItems(): Promise<InventoryItem[]> {
    if (isDevMode()) {
      return MOCK_INVENTORY;
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, COLLECTIONS.INVENTORY), orderBy('name', 'asc'))
      );
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryItem));
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      throw error;
    }
  }

  // Get item by ID
  static async getItemById(itemId: string): Promise<InventoryItem | null> {
    if (isDevMode()) {
      return MOCK_INVENTORY.find(item => item.id === itemId) || null;
    }

    try {
      const docRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as InventoryItem;
      }
      return null;
    } catch (error) {
      console.error('Error fetching inventory item:', error);
      throw error;
    }
  }

  // Get items by category
  static async getItemsByCategory(category: string): Promise<InventoryItem[]> {
    if (isDevMode()) {
      return MOCK_INVENTORY.filter(item => item.category === category);
    }

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
      console.error('Error fetching items by category:', error);
      throw error;
    }
  }

  // Add new item
  static async addItem(item: Omit<InventoryItem, 'id'>): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Adding inventory item:', item);
      return `mock_item_${Date.now()}`;
    }

    try {
      const newItem = {
        ...item,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      const cleanItem = removeUndefined(newItem);
      const docRef = await addDoc(collection(db, COLLECTIONS.INVENTORY), cleanItem);
      return docRef.id;
    } catch (error) {
      console.error('Error adding inventory item:', error);
      throw error;
    }
  }

  // Update item
  static async updateItem(itemId: string, updates: Partial<InventoryItem>): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Updating inventory item ${itemId}:`, updates);
      return;
    }

    try {
      const docRef = doc(db, COLLECTIONS.INVENTORY, itemId);
      const updatesData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      const cleanUpdates = removeUndefined(updatesData);
      await updateDoc(docRef, cleanUpdates);
    } catch (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }
  }

  // Delete item
  static async deleteItem(itemId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Deleting inventory item ${itemId}`);
      return;
    }

    try {
      await deleteDoc(doc(db, COLLECTIONS.INVENTORY, itemId));
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }
  }

  // Get low stock items
  static async getLowStockItems(): Promise<InventoryItem[]> {
    if (isDevMode()) {
      return MOCK_INVENTORY.filter(item =>
        item.quantity <= (item.minQuantity || 0)
      );
    }

    try {
      const allItems = await this.getAllItems();
      return allItems.filter(item =>
        item.quantity <= (item.minQuantity || 0)
      );
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      throw error;
    }
  }

  // Get maintenance schedules
  static async getMaintenanceSchedules(): Promise<MaintenanceSchedule[]> {
    if (isDevMode()) {
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
    }

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
      console.error('Error fetching maintenance schedules:', error);
      throw error;
    }
  }

  // Get inventory alerts
  static async getInventoryAlerts(itemId?: string, acknowledged?: boolean): Promise<InventoryAlert[]> {
    if (isDevMode()) {
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
    }

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
      console.error('Error fetching inventory alerts:', error);
      throw error;
    }
  }

  // Create inventory alert
  static async createAlert(alert: Omit<InventoryAlert, 'id' | 'createdAt' | 'acknowledged'>): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Creating inventory alert:', alert);
      return `mock_alert_${Date.now()}`;
    }

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.INVENTORY_ALERTS), {
        ...alert,
        acknowledged: false,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating inventory alert:', error);
      throw error;
    }
  }

  // Generate alerts for low stock and maintenance
  static async generateAlerts(): Promise<void> {
    if (isDevMode()) {
      console.log('[DEV MODE] Generating inventory alerts');
      return;
    }

    try {
      const items = await this.getAllItems();
      const maintenanceSchedules = await this.getMaintenanceSchedules();

      // Check for low stock items
      for (const item of items) {
        if (item.quantity <= (item.minQuantity || 0)) {
          await this.createAlert({
            itemId: item.id,
            type: 'Low Stock',
            severity: item.quantity === 0 ? 'Critical' : 'High',
            message: `${item.name} is ${item.quantity === 0 ? 'out of stock' : `low (${item.quantity} remaining, minimum: ${item.minQuantity})`}`,
          });
        }

        // Check for overdue returns (if applicable)
        if (item.status === 'Checked Out' && item.expectedReturnDate) {
          const returnDate = new Date(item.expectedReturnDate);
          if (returnDate < new Date()) {
            await this.createAlert({
              itemId: item.id,
              type: 'Overdue Return',
              severity: 'Medium',
              message: `${item.name} is overdue for return (expected: ${item.expectedReturnDate})`,
            });
          }
        }
      }

      // Check for upcoming maintenance
      for (const schedule of maintenanceSchedules) {
        const scheduledDate = new Date(schedule.scheduledDate);
        const now = new Date();
        const daysUntil = Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil <= 7 && daysUntil >= -7) { // Within a week (past or future)
          const item = items.find(i => i.id === schedule.itemId);
          await this.createAlert({
            itemId: schedule.itemId,
            type: 'Maintenance Due',
            severity: daysUntil < -7 ? 'High' : 'Medium',
            message: `${item?.name || 'Item'} requires ${schedule.type.toLowerCase()} maintenance (${schedule.type})`,
          });
        }
      }
    } catch (error) {
      console.error('Error generating alerts:', error);
      throw error;
    }
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
    if (isDevMode()) {
      console.log(`[DEV MODE] Linking transaction ${transactionId} to inventory item ${itemId}`);
      return;
    }

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

      // Update quantity based on transaction type (handled by caller)
    } catch (error) {
      console.error('Error linking transaction to inventory:', error);
      throw error;
    }
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
    if (isDevMode()) {
      console.log(`[DEV MODE] Recording purchase of ${quantity} units for item ${itemId}`);
      return;
    }

    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        throw new Error(`Inventory item ${itemId} not found`);
      }

      const newQuantity = item.quantity + quantity;
      await this.updateItem(itemId, {
        quantity: newQuantity,
        status: newQuantity > 0 ? 'Available' : 'Out of Stock',
        purchasePrice: unitCost,
        purchaseDate: new Date().toISOString(),
      });

      await this.linkTransactionToInventory(transactionId, itemId, quantity, unitCost);

      await this.recordStockMovement({
        itemId,
        itemName: item.name,
        type: 'In',
        quantity,
        previousQuantity: item.quantity,
        newQuantity,
        variant: undefined, // Base item logic for now
        reason: 'Purchase',
        performedBy: 'System', // Could enhance to pass user
      });
    } catch (error) {
      console.error('Error recording merchandise purchase:', error);
      throw error;
    }
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
    if (isDevMode()) {
      console.log(`[DEV MODE] Recording sale of ${quantity} units for item ${itemId}`);
      return;
    }

    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        throw new Error(`Inventory item ${itemId} not found`);
      }

      if (item.quantity < quantity) {
        throw new Error(`Insufficient inventory: ${item.quantity} available, ${quantity} requested`);
      }

      const newQuantity = item.quantity - quantity;
      await this.updateItem(itemId, {
        quantity: newQuantity,
        status: newQuantity > 0 ? 'Available' : 'Out of Stock',
        lastSaleDate: new Date().toISOString(),
      });

      await this.linkTransactionToInventory(transactionId, itemId, quantity, unitPrice);

      await this.recordStockMovement({
        itemId,
        itemName: item.name,
        type: 'Out',
        quantity: -quantity,
        previousQuantity: item.quantity,
        newQuantity,
        variant: undefined, // Base item logic for now
        reason: 'Sale',
        performedBy: 'System', // Could enhance to pass user
      });
    } catch (error) {
      console.error('Error recording merchandise sale:', error);
      throw error;
    }
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
    if (isDevMode()) {
      return {
        consistent: true,
        issues: [],
        inventoryValue: 100,
        transactionValue: 100,
      };
    }

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

      // Import FinanceService dynamically to avoid circular dependency
      const { FinanceService } = await import('./financeService');
      const allTransactions = await FinanceService.getAllTransactions();
      const transaction = allTransactions.find(t => t.id === transactionId);

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
      console.error('Error verifying inventory-finance consistency:', error);
      throw error;
    }
  }

  /**
   * Get all merchandise items (items in Merchandise category)
   */
  static async getMerchandiseItems(): Promise<InventoryItem[]> {
    try {
      return await this.getItemsByCategory('Merchandise');
    } catch (error) {
      console.error('Error fetching merchandise items:', error);
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
    if (isDevMode()) {
      return {
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
      };
    }

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
      console.error('Error reconciling merchandise inventory:', error);
      throw error;
    }
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
    if (isDevMode()) {
      console.log(`[DEV MODE] Checking out item ${itemId} to member ${memberId}`);
      return;
    }

    try {
      const item = await this.getItemById(itemId);
      if (!item) {
        throw new Error('Item not found');
      }

      if (item.status !== 'Available') {
        throw new Error('Item is not available for checkout');
      }

      await this.updateItem(itemId, {
        status: 'Checked Out',
        checkedOutTo: memberId,
        checkedOutDate: new Date().toISOString(),
        expectedReturnDate: expectedReturnDate?.toISOString()
      });
    } catch (error) {
      console.error('Error checking out item:', error);
      throw error;
    }
  }

  // Check in item
  static async checkInItem(itemId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Checking in item ${itemId}`);
      return;
    }

    try {
      await this.updateItem(itemId, {
        status: 'Available',
        checkedOutTo: undefined,
        checkedOutDate: undefined,
        expectedReturnDate: undefined,
        returnedDate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking in item:', error);
      throw error;
    }
  }

  // Get alerts with filtering
  static async getAlerts(acknowledged?: boolean): Promise<InventoryAlert[]> {
    return await this.getInventoryAlerts(undefined, acknowledged);
  }

  // Create maintenance schedule
  static async createMaintenanceSchedule(schedule: Omit<MaintenanceSchedule, 'id'>): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Creating maintenance schedule:', schedule);
      return `schedule_${Date.now()}`;
    }

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.MAINTENANCE_SCHEDULES), {
        ...schedule,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating maintenance schedule:', error);
      throw error;
    }
  }

  // Update maintenance schedule
  static async updateMaintenanceSchedule(scheduleId: string, updates: Partial<MaintenanceSchedule>): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Updating maintenance schedule ${scheduleId}:`, updates);
      return;
    }

    try {
      const docRef = doc(db, COLLECTIONS.MAINTENANCE_SCHEDULES, scheduleId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating maintenance schedule:', error);
      throw error;
    }
  }

  // Complete maintenance
  static async completeMaintenance(scheduleId: string, notes?: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Completing maintenance ${scheduleId} with notes:`, notes);
      return;
    }

    try {
      await this.updateMaintenanceSchedule(scheduleId, {
        status: 'Completed',
        completedDate: new Date().toISOString(),
        notes
      });
    } catch (error) {
      console.error('Error completing maintenance:', error);
      throw error;
    }
  }

  // Acknowledge alert
  static async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Acknowledging alert ${alertId} by ${acknowledgedBy}`);
      return;
    }

    try {
      const docRef = doc(db, COLLECTIONS.INVENTORY_ALERTS, alertId);
      await updateDoc(docRef, {
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  // Check and generate alerts
  static async checkAndGenerateAlerts(): Promise<void> {
    return await this.generateAlerts();
  }

  // Update item depreciation
  static async updateItemDepreciation(itemId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Updating depreciation for item ${itemId}`);
      return;
    }

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
      console.error('Error updating item depreciation:', error);
      throw error;
    }
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
    if (isDevMode()) {
      console.log(`[DEV MODE] Updating variant ${variantSize} quantity for item ${itemId} by ${quantity} (${operation})`);
      return;
    }

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

      await this.updateItem(itemId, {
        variants,
        quantity: newTotalQuantity,
        status: newTotalQuantity > 0 ? 'Available' : 'Out of Stock',
      });

      // Record movement
      await this.recordStockMovement({
        itemId,
        itemName: item.name,
        type: operation === 'increment' ? 'In' : 'Out',
        quantity: operation === 'increment' ? quantity : -quantity,
        previousQuantity: item.quantity,
        newQuantity: newTotalQuantity,
        variant: variantSize,
        reason: operation === 'increment' ? 'Restock' : 'Sale',
        performedBy: 'System', // This shouldIdeally be passed in
        referenceId,
      });
    } catch (error) {
      console.error('Error updating variant quantity:', error);
      throw error;
    }
  }

  // Check if a stock movement exists for a given reference ID (e.g. transaction ID)
  static async hasStockMovementForRef(referenceId: string): Promise<boolean> {
    if (isDevMode()) return false;
    try {
      const q = query(
        collection(db, COLLECTIONS.STOCK_MOVEMENTS),
        where('referenceId', '==', referenceId),
        limit(1)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking stock movement existence:', error);
      return false;
    }
  }

  // Update an existing stock movement for a reference ID
  static async updateStockMovementForRef(
    referenceId: string,
    details: {
      itemId: string;
      variantSize: string;
      quantity: number;
      operation: 'increment' | 'decrement';
    }
  ): Promise<void> {
    if (isDevMode()) return;
    try {
      // 1. Find the existing movement
      const q = query(
        collection(db, COLLECTIONS.STOCK_MOVEMENTS),
        where('referenceId', '==', referenceId),
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // If it doesn't exist, create it anew
        await this.updateVariantQuantity(
          details.itemId,
          details.variantSize,
          details.quantity,
          details.operation,
          referenceId
        );
        return;
      }

      const movementDoc = snapshot.docs[0];
      const movement = movementDoc.data() as StockMovement;

      // Determine new signed quantity
      const newSignedQty = details.operation === 'increment' ? details.quantity : -details.quantity;

      // Handle Inventory Logic
      const sameItem = movement.itemId === details.itemId;
      const sameVariant = movement.variant === details.variantSize;

      if (sameItem && sameVariant) {
        // Same item, just update the difference
        const netChange = newSignedQty - movement.quantity;
        if (netChange !== 0) {
          await this.adjustVariantQuantityOnly(details.itemId, details.variantSize, netChange);
        }
      } else {
        // Different item/variant: Revert old, Apply new
        // 1. Revert Old: subtract old quantity
        await this.adjustVariantQuantityOnly(movement.itemId, movement.variant || '', -movement.quantity);

        // 2. Apply New: add new quantity
        await this.adjustVariantQuantityOnly(details.itemId, details.variantSize, newSignedQty);
      }

      // Update the Stock Movement Record
      const newItem = await this.getItemById(details.itemId);
      const newItemQty = newItem?.quantity || 0;

      await updateDoc(movementDoc.ref, {
        itemId: details.itemId,
        itemName: newItem?.name || 'Unknown',
        variant: details.variantSize,
        quantity: newSignedQty,
        type: details.operation === 'increment' ? 'In' : 'Out',
        reason: details.operation === 'increment' ? 'Restock' : 'Sale',
        newQuantity: newItemQty,
        previousQuantity: newItemQty - newSignedQty,
        updatedAt: Timestamp.now()
      });

    } catch (error) {
      console.error('Error updating stock movement:', error);
      // Don't throw if just a sync issue, but log it
    }
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
        status: newTotalQuantity > 0 ? 'Available' : 'Out of Stock',
      });
    } catch (e) {
      console.error('Error inside adjustVariantQuantityOnly:', e);
      throw e;
    }
  }

  // Delete stock movement for a reference (reverting inventory)
  static async deleteStockMovementForRef(referenceId: string): Promise<void> {
    if (isDevMode()) return;
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

        // Revert inventory
        await this.adjustVariantQuantityOnly(movement.itemId, movement.variant || '', -movement.quantity);

        // Delete the record
        await deleteDoc(movementDoc.ref);
      }
    } catch (error) {
      console.error('Error deleting stock movement:', error);
      throw error;
    }
  }

  // Record a stock movement
  static async recordStockMovement(movement: Omit<StockMovement, 'id' | 'date'>): Promise<string> {
    if (isDevMode()) {
      console.log('[DEV MODE] Recording stock movement:', movement);
      return `mock_mov_${Date.now()}`;
    }

    try {
      const cleanMovement = removeUndefined(movement);
      const docRef = await addDoc(collection(db, COLLECTIONS.STOCK_MOVEMENTS), {
        ...cleanMovement,
        date: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error recording stock movement:', error);
      throw error;
    }
  }

  // Get stock card (movements) for an item
  static async getStockCard(itemId: string): Promise<StockMovement[]> {
    if (isDevMode()) {
      return []; // Implement mock data if needed
    }

    try {
      const q = query(
        collection(db, COLLECTIONS.STOCK_MOVEMENTS),
        where('itemId', '==', itemId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
      } as StockMovement));
    } catch (error) {
      console.error('Error getting stock card:', error);
      throw error;
    }
  }

  // Manual stock adjustment
  static async adjustStock(
    itemId: string,
    variantSize: string | undefined,
    adjustmentQuantity: number,
    reason: string,
    performedBy: string
  ): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Adjusting stock for ${itemId} (${variantSize || 'base'}): ${adjustmentQuantity} Reason: ${reason}`);
      return;
    }

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

      await this.updateItem(itemId, {
        quantity: newTotal,
        variants: updatedVariants,
        status: newTotal > 0 ? 'Available' : 'Out of Stock',
      });

      await this.recordStockMovement({
        itemId,
        itemName: item.name,
        type: 'Adjustment',
        quantity: adjustmentQuantity,
        previousQuantity: previousTotal,
        newQuantity: newTotal,
        variant: variantSize,
        reason,
        performedBy,
      });
    } catch (error) {
      console.error('Error adjusting stock:', error);
      throw error;
    }
  }
}
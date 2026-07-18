import { collection, doc, getDoc, setDoc, getDocs, deleteDoc, serverTimestamp, addDoc, updateDoc, query, where, orderBy, limit, increment, writeBatch, runTransaction, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';
import { COLLECTIONS, TOYYIB_CONFIG } from '../config/constants';
import { errorLoggingService } from './errorLoggingService';
import { apiCache } from './cacheService';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export interface ToyyibApiCategoryRaw {
  CategoryCode: string;
  CategoryName: string;
  categoryDescription?: string;
  CategoryDescription?: string;
  categoryStatus?: string;
  CategoryStatus?: string;
}

export interface ToyyibApiSettlement {
  billCode: string;
  billpaymentSettlement?: string;
  billpaymentStatus?: string;
  billpaymentAmount?: number;
  billPaymentDate?: string;
  [key: string]: string | number | undefined;
}

export interface CreateBillParams {
  billName: string;
  billDescription: string;
  billAmount: number;
  billTo: string;
  billEmail: string;
  billPhone: string;
  externalReferenceNo?: string;
  categoryCode?: string;
  /** Member UID — used for duplicate-bill detection */
  memberId?: string;
  /** Project ID — used for duplicate-bill detection on event payments */
  projectId?: string;
  /** Membership year this bill covers, e.g. 2026 (falls back to current year if omitted) */
  membershipYear?: number;
}

export interface ToyyibBillResponse {
  billCode: string;
  paymentUrl: string;
}

export interface ToyyibCategory {
  categoryCode: string;
  categoryName: string;
  categoryDescription: string;
  categoryStatus?: string;
  createdAt?: any;
  billCount?: number;
  totalAmount?: number;
  linkedType?: 'membership' | 'project';
  linkedProjectId?: string;
  linkedProjectName?: string;
  /** Membership type this category is for — amount auto-resolved from MembershipConfigService */
  membershipType?: string;
  /** Year this membership category covers, e.g. "2026" */
  linkedYear?: string;
}

export interface ToyyibBillRecord {
  billCode: string;
  categoryCode: string;
  billName: string;
  billDescription?: string;
  billAmount: number;
  billTo: string;
  billEmail: string;
  /** ToyyibPay billpaymentStatus: "1"=paid, "2"=pending, "3"=failed, "4"=settling */
  billpaymentStatus: string;
  billPaymentDate?: string;
  /** Member UID — used for duplicate-bill detection */
  memberId?: string;
  /** Project ID — used for duplicate-bill detection on event payments */
  projectId?: string;
  createdAt?: any;
  /** Written by webhook callback after payment confirmation */
  billExternalReferenceNo?: string;
  /**
   * P1-C: Set by the webhook's rollback path (billpaymentStatus='3') to the Firestore
   * transaction ID that was reverted when the payment was reversed/refunded.
   * Allows finance views to link the bill reversal to its income transaction.
   */
  refundTransactionId?: string;
  /** Timestamp written by the webhook when a payment reversal (status=3) is processed. */
  refundedAt?: any;
  updatedAt?: any;
}

// All ToyyibPay API calls go through our Netlify Function proxy to avoid CORS.
// In local Vite dev, the function isn't available (404) — callers should handle null gracefully.
async function proxyCall(action: string, params: Record<string, string> = {}): Promise<any> {
  const idToken = await getAuth().currentUser?.getIdToken().catch(() => null);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  // ERR-R-005: use fetchWithTimeout so a hung Netlify function doesn't leave
  // the caller's spinner running indefinitely.
  const response = await fetchWithTimeout('/.netlify/functions/toyyibpay-api', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...params }),
  });
  if (response.status === 404) {
    // Netlify function not available (local dev environment) — return null so callers can degrade gracefully
    return null;
  }
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ToyyibPay proxy error (${action}): ${err}`);
  }
  return response.json();
}

export class ToyyibService {
  /**
   * P0-B (order guarantee): The ToyyibPay API is called FIRST via proxyCall.
   * Only if the API call succeeds does this method write to Firestore (toyyibBills).
   * Callers (e.g. useToyyibPayment) MUST update the member document AFTER this
   * method returns — never before — so a failed API call never leaves stale bill
   * codes on the member record.
   */
  static async createBill(params: CreateBillParams): Promise<ToyyibBillResponse> {
    if (!TOYYIB_CONFIG.USER_SECRET_KEY || !TOYYIB_CONFIG.CATEGORY_CODE) {
      console.warn('ToyyibPay: Missing API keys, simulating response');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockBillCode = 'MOCK-' + Math.random().toString(36).substring(7).toUpperCase();
      return {
        billCode: mockBillCode,
        paymentUrl: `https://${TOYYIB_CONFIG.IS_SANDBOX ? 'dev.' : ''}toyyibpay.com/${mockBillCode}`
      };
    }

    if (!Number.isFinite(params.billAmount) || params.billAmount <= 0) {
      throw new Error('billAmount must be a positive number (in RM)');
    }
    const effectiveCategoryCode = params.categoryCode || TOYYIB_CONFIG.CATEGORY_CODE;
    if (!effectiveCategoryCode?.trim()) {
      throw new Error('No ToyyibPay category code — set VITE_TOYYIB_CATEGORY_CODE in environment');
    }

    const data = await proxyCall('createBill', {
      categoryCode: effectiveCategoryCode,
      billName: params.billName,
      billDescription: params.billDescription,
      billPriceSetting: '0',
      billPayorInfo: '1',
      billMultiPayment: '1',
      billPaymentChannel: '2', // 0=FPX only, 1=Credit Card only, 2=both
      billAmount: Math.round(params.billAmount * 100).toString(), // ToyyibPay expects sen (cents)
      billReturnUrl: window.location.origin + TOYYIB_CONFIG.RETURN_URL_SUFFIX,
      billCallbackUrl: window.location.origin + TOYYIB_CONFIG.CALLBACK_URL_SUFFIX,
      billExternalReferenceNo: params.externalReferenceNo || '',
      billTo: params.billTo,
      billEmail: params.billEmail,
      billPhone: params.billPhone,
    });

    if (Array.isArray(data) && data.length > 0) {
      const billCode = data[0].BillCode;
      // Persist to Firestore for per-category aggregation
      const billRecord: Omit<ToyyibBillRecord, 'createdAt'> & { createdAt: any; year?: number } = {
        billCode,
        categoryCode: effectiveCategoryCode,
        billName: params.billName,
        billDescription: params.billDescription,
        billAmount: params.billAmount,
        billTo: params.billTo,
        billEmail: params.billEmail,
        billpaymentStatus: '2',
        // BIZ-004: dedicated year field so the webhook can extract billYear even when
        // billName doesn't start with "YYYY " (e.g. "JCI KL Membership 2026").
        year: params.membershipYear ?? new Date().getFullYear(),
        createdAt: serverTimestamp(),
      };
      if (params.memberId) billRecord.memberId = params.memberId;
      if (params.projectId) billRecord.projectId = params.projectId;
      // P1-fix: write bill record + increment category billCount atomically via writeBatch
      const usedCategoryCode = params.categoryCode || TOYYIB_CONFIG.CATEGORY_CODE;
      const billBatch = writeBatch(db);
      const billRef = doc(collection(db, COLLECTIONS.TOYYIB_BILLS));
      billBatch.set(billRef, billRecord);
      if (usedCategoryCode) {
        // Fix 4 (P1): use set+merge so this succeeds whether or not the category doc exists yet.
        billBatch.set(doc(db, COLLECTIONS.TOYYIB_CATEGORIES, usedCategoryCode), {
          billCount: increment(1),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      await billBatch.commit();
      return {
        billCode,
        paymentUrl: `https://${TOYYIB_CONFIG.IS_SANDBOX ? 'dev.' : ''}toyyibpay.com/${billCode}`
      };
    }
    throw new Error(data?.msg || 'Failed to create bill');
  }

  // ToyyibPay has no "list all categories" endpoint — getCategoryDetails requires a specific code.
  // Category codes are stored in Firestore (toyyibCategories collection), seeded with CATEGORY_CODE.

  static async getCategories(): Promise<ToyyibCategory[]> {
    // Load known category codes from Firestore, plus bill aggregates in parallel.
    // Bills scan is cached for 5 min to avoid a full unbounded collection read on every call.
    const BILLS_CACHE_KEY = 'toyyib:billStats';
    const BILLS_CACHE_TTL = 5 * 60 * 1000;

    const [snap, billStats] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.TOYYIB_CATEGORIES)),
      apiCache.getOrSet(BILLS_CACHE_KEY, async () => {
        const billsSnap = await getDocs(collection(db, COLLECTIONS.TOYYIB_BILLS));
        const stats: Record<string, { count: number; total: number }> = {};
        billsSnap.docs.forEach(d => {
          const b = d.data() as ToyyibBillRecord;
          if (!b.categoryCode) return;
          if (!stats[b.categoryCode]) stats[b.categoryCode] = { count: 0, total: 0 };
          stats[b.categoryCode].count += 1;
          stats[b.categoryCode].total += b.billAmount || 0;
        });
        return stats;
      }, BILLS_CACHE_TTL),
    ]);

    // Build a map of Firestore metadata (linked fields, membershipType) keyed by code
    const firestoreMeta: Record<string, any> = {};
    snap.docs.forEach(d => { firestoreMeta[d.id] = d.data(); });

    let codes: string[] = snap.docs.map(d => d.id);

    // Always include the configured default category code
    if (TOYYIB_CONFIG.CATEGORY_CODE && !codes.includes(TOYYIB_CONFIG.CATEGORY_CODE)) {
      codes = [TOYYIB_CONFIG.CATEGORY_CODE, ...codes];
      // Persist it so future calls don't need to re-seed
      await ToyyibService.saveCategoryToFirestore({
        categoryCode: TOYYIB_CONFIG.CATEGORY_CODE,
        categoryName: 'Default',
        categoryDescription: '',
      });
    }

    if (codes.length === 0) return [];

    // Fetch live details from ToyyibPay for each code
    const results = await Promise.allSettled(
      codes.map(async code => {
        const details = await proxyCall('getCategoryDetails', { categoryCode: code });
        // ToyyibPay returns a plain object (sandbox) or array (production)
        const raw = Array.isArray(details) ? details[0] : details;
        if (!raw || typeof raw !== 'object') return null;
        const stats = billStats[code] || { count: 0, total: 0 };
        const meta = firestoreMeta[code] || {};
        return {
          categoryCode: code,
          categoryName: raw.CategoryName || raw.categoryName || '',
          categoryDescription: raw.categoryDescription || raw.CategoryDescription || '',
          categoryStatus: raw.categoryStatus ?? raw.CategoryStatus ?? '0',
          billCount: stats.count,
          totalAmount: stats.total,
          linkedType: meta.linkedType,
          linkedProjectId: meta.linkedProjectId,
          linkedProjectName: meta.linkedProjectName,
          membershipType: meta.membershipType,
        } as ToyyibCategory;
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<ToyyibCategory> => r.status === 'fulfilled' && r.value !== null && r.value !== undefined)
      .map(r => r.value!);
  }

  private static async saveCategoryToFirestore(cat: Omit<ToyyibCategory, 'createdAt'> & { createdBy?: string }): Promise<void> {
    const payload: Record<string, any> = {
      categoryName: cat.categoryName,
      categoryDescription: cat.categoryDescription,
      createdAt: serverTimestamp(),
      isActive: true,
    };
    if (cat.linkedType) payload.linkedType = cat.linkedType;
    if (cat.linkedProjectId) payload.linkedProjectId = cat.linkedProjectId;
    if (cat.linkedProjectName) payload.linkedProjectName = cat.linkedProjectName;
    if (cat.membershipType) payload.membershipType = cat.membershipType;
    if (cat.createdBy) payload.createdBy = cat.createdBy;
    await setDoc(doc(db, COLLECTIONS.TOYYIB_CATEGORIES, cat.categoryCode), payload, { merge: true });
  }

  static async createCategory(catname: string, catdescription: string, currentUserId?: string): Promise<ToyyibApiCategoryRaw[]> {
    // TODO: Add 'description' field to the ToyyibCategory creation form in UI.
    const result = await proxyCall('createCategory', { catname, catdescription });
    // Save the new category code to Firestore so getCategories can find it
    if (Array.isArray(result) && result[0]?.CategoryCode) {
      const cat: Omit<ToyyibCategory, 'createdAt'> & { createdBy?: string } = {
        categoryCode: result[0].CategoryCode,
        categoryName: catname,
        categoryDescription: catdescription,
      };
      if (currentUserId) cat.createdBy = currentUserId;
      await ToyyibService.saveCategoryToFirestore(cat);
    }
    return result;
  }

  /**
   * Update mutable metadata fields on a category (name, description, link).
   * Note: categoryCode is assigned by ToyyibPay and cannot be changed via API.
   * If the category needs to be recreated, use deleteCategory + createCategory.
   */
  static async updateCategory(categoryCode: string, updateData: Partial<Omit<ToyyibCategory, 'categoryCode'>> & { categoryCode?: string }): Promise<void> {
    if (updateData.categoryCode) {
      // categoryCode is immutable — set only on creation by ToyyibPay API
      delete updateData.categoryCode;
      console.warn('[ToyyibService] Attempted to update categoryCode directly — ignored. categoryCode is set by ToyyibPay API.');
    }
    const payload: Record<string, any> = { ...updateData, updatedAt: serverTimestamp() };
    await updateDoc(doc(db, COLLECTIONS.TOYYIB_CATEGORIES, categoryCode), payload);
  }

  static async updateCategoryLink(
    categoryCode: string,
    link: Pick<ToyyibCategory, 'linkedType' | 'linkedProjectId' | 'linkedProjectName' | 'membershipType'>
  ): Promise<void> {
    const payload: Record<string, any> = { linkedType: link.linkedType ?? null };
    payload.linkedProjectId = link.linkedProjectId ?? null;
    payload.linkedProjectName = link.linkedProjectName ?? null;
    payload.membershipType = link.membershipType ?? null;
    await setDoc(doc(db, COLLECTIONS.TOYYIB_CATEGORIES, categoryCode), payload, { merge: true });
  }

  static async deleteCategory(categoryCode: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.TOYYIB_CATEGORIES, categoryCode));
  }

  // Re-link an existing ToyyibPay category by code (fetch live details, then save to Firestore)
  static async importCategory(categoryCode: string): Promise<ToyyibCategory> {
    const details = await proxyCall('getCategoryDetails', { categoryCode });
    const raw = Array.isArray(details) ? details[0] : details;
    if (!raw || typeof raw !== 'object' || (!raw.CategoryName && !raw.categoryName)) {
      throw new Error('Category not found in ToyyibPay — check the code and try again');
    }
    const cat: Omit<ToyyibCategory, 'createdAt'> = {
      categoryCode,
      categoryName: raw.CategoryName || raw.categoryName || '',
      categoryDescription: raw.categoryDescription || raw.CategoryDescription || '',
    };
    await ToyyibService.saveCategoryToFirestore(cat);
    return cat;
  }

  static async getCategoryDetails(categoryCode: string): Promise<ToyyibApiCategoryRaw[]> {
    const data = await proxyCall('getCategoryDetails', { categoryCode });
    return Array.isArray(data) ? data : [];
  }

  static async getBills(): Promise<ToyyibBillRecord[]> {
    // TODO: Implement cursor-based pagination for admin view
    const snap = await getDocs(query(collection(db, COLLECTIONS.TOYYIB_BILLS), orderBy('createdAt', 'desc'), limit(200)));
    return snap.docs.map(d => ({ ...(d.data() as ToyyibBillRecord), id: d.id }));
  }

  /**
   * Check whether an active (non-failed) bill already exists for this member + category.
   * Used to prevent duplicate bills when the user clicks the payment button more than once.
   *
   * Pass `projectId` for event payments; omit for membership dues (category alone is sufficient).
   *
   * Returns the existing bill's paymentUrl if found, or null if safe to create a new bill.
   */
  static async findExistingActiveBill(
    memberId: string,
    categoryCode: string,
    projectId?: string,
  ): Promise<{ billCode: string; paymentUrl: string } | null> {
    // Fetch up to 10 bills for this member+category, then filter out failed ones
    // client-side. Using != at query level would require a composite Firestore index;
    // this approach works without any extra index since bills per member+category are few.
    const constraints: any[] = [
      where('memberId', '==', memberId),
      where('categoryCode', '==', categoryCode),
      limit(10),
    ];
    if (projectId) constraints.splice(2, 0, where('projectId', '==', projectId));

    const snap = await getDocs(query(collection(db, COLLECTIONS.TOYYIB_BILLS), ...constraints));
    const active = snap.docs.find(d => (d.data() as ToyyibBillRecord).billpaymentStatus !== '3');
    if (!active) return null;
    const bill = active.data() as ToyyibBillRecord;
    return {
      billCode: bill.billCode,
      paymentUrl: `https://${TOYYIB_CONFIG.IS_SANDBOX ? 'dev.' : ''}toyyibpay.com/${bill.billCode}`,
    };
  }

  /**
   * Fetch the latest payment status from ToyyibPay for a single bill and persist to Firestore.
   * Returns the updated record, or null if no transaction data is available.
   */
  static async syncBillStatus(billCode: string): Promise<Pick<ToyyibBillRecord, 'billpaymentStatus' | 'billPaymentDate'> | null> {
    const data = await proxyCall('getBillTransactions', { billCode });
    console.log('[ToyyibPay] getBillTransactions raw response:', data);
    if (!Array.isArray(data) || data.length === 0) return null;
    const txn = data[0];
    console.log('[ToyyibPay] txn[0] fields:', {
      billpaymentStatus: txn.billpaymentStatus,
      billPaymentDate: txn.billPaymentDate,
      billpaymentChannel: txn.billpaymentChannel,
      billpaymentAmount: txn.billpaymentAmount,
      billpaymentSettlement: txn.billpaymentSettlement,
      billStatus: txn.billStatus,
    });
    // billpaymentStatus: "1"=paid, "2"=pending, "3"=failed, "4"=settling (pending settlement)
    const billpaymentStatus: string = String(txn.billpaymentStatus ?? '2');
    const billPaymentDate: string = txn.billPaymentDate ?? '';

    // Fix 5 (P2): wrap priority comparison + updateDoc in a runTransaction so concurrent
    // webhook callbacks can't both downgrade the status.
    // Priority: 1 (paid) > 4 (settling) > 2 (pending) > 3 (failed)
    const STATUS_PRIORITY: Record<string, number> = { '1': 4, '4': 3, '2': 2, '3': 1 };
    const snap = await getDocs(query(collection(db, COLLECTIONS.TOYYIB_BILLS), where('billCode', '==', billCode), limit(1)));
    const match = snap.docs[0];
    if (match) {
      const billRef = doc(db, COLLECTIONS.TOYYIB_BILLS, match.id);
      await runTransaction(db, async (txn) => {
        const freshSnap = await txn.get(billRef);
        if (!freshSnap.exists()) return;
        const existingStatus = String(freshSnap.data().billpaymentStatus ?? '2');
        const existingPriority = STATUS_PRIORITY[existingStatus] ?? 0;
        const incomingPriority = STATUS_PRIORITY[billpaymentStatus] ?? 0;
        if (incomingPriority >= existingPriority) {
          txn.update(billRef, { billpaymentStatus, billPaymentDate });
        }
      });
    }
    return { billpaymentStatus, billPaymentDate };
  }

  // ── Bill description formatters ───────────────────────────────────────────────

  static formatMembershipBillDescription(
    name: string,
    nationalId: string | undefined,
    contact: string,
    year: number,
    isGuest = false,
  ): string {
    const idSuffix = nationalId?.slice(-4);
    const prefix = `[${year} Renewal Membership]`;
    if (isGuest || !idSuffix) return `${prefix} ${name}, ${contact}`;
    return `${prefix} ${name} (${idSuffix}), ${contact}`;
  }

  static formatEventBillDescription(
    projectTitle: string,
    name: string,
    nationalId: string | undefined,
    contact: string,
  ): string {
    const idSuffix = nationalId?.slice(-4);
    const prefix = `[${projectTitle} - Ticketing]`;
    if (!idSuffix) return `${prefix} ${name}, ${contact}`;
    return `${prefix} ${name} (${idSuffix}), ${contact}`;
  }

  // ── Lazy category creation ────────────────────────────────────────────────────

  /**
   * Return the categoryCode for the given membership year's ToyyibPay category,
   * creating it on first use.
   */
  static async getOrCreateMembershipCategory(year: number): Promise<string> {
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.TOYYIB_CATEGORIES),
      where('linkedType', '==', 'membership'),
      where('linkedYear', '==', String(year)),
      where('isActive', '==', true),
      limit(1),
    ));
    if (!snap.empty) return (snap.docs[0].data().categoryCode as string) || snap.docs[0].id;

    // Fix 4 (P1): use a Firestore transaction to atomically claim the deterministic doc slot.
    // Two concurrent callers both pass the getDocs check above; only one wins the transaction
    // and proceeds to call the ToyyibPay API. The other finds the __pending__ placeholder and
    // polls with backoff instead of falling through to the API, preventing duplicate categories.
    const categoryDocRef = doc(db, COLLECTIONS.TOYYIB_CATEGORIES, `${year}_membership`);
    let categoryCode: string | null = null;
    let didWinRace = false;

    await runTransaction(db, async (txn) => {
      const existing = await txn.get(categoryDocRef);
      if (existing.exists()) {
        const data = existing.data();
        if (data.categoryCode && data.categoryCode !== '__pending__') {
          categoryCode = data.categoryCode as string;
        }
        return; // Slot already claimed — another caller is creating or already created it
      }
      // Reserve the slot with a placeholder to block concurrent callers
      txn.set(categoryDocRef, { categoryCode: '__pending__', createdAt: Timestamp.now() });
      didWinRace = true;
    });

    if (categoryCode) return categoryCode;

    if (!didWinRace) {
      // Another call is creating the category — poll with exponential backoff instead of
      // falling through to the API (which would create a duplicate ToyyibPay category).
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        const pollSnap = await getDoc(categoryDocRef);
        const code = pollSnap.data()?.categoryCode;
        if (code && code !== '__pending__') return code as string;
      }
      throw new Error(`ToyyibPay category creation timed out for ${year} Membership`);
    }

    // Won the race — now call the ToyyibPay API outside the transaction
    const catName = `${year} Membership`;
    const result = await proxyCall('createCategory', { catname: catName, catdescription: catName });
    if (!Array.isArray(result) || !result[0]?.CategoryCode) {
      // Roll back the placeholder so a future attempt can try again
      await setDoc(categoryDocRef, { categoryCode: null, isActive: false, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      throw new Error(`Failed to create ToyyibPay category for ${catName}`);
    }
    categoryCode = result[0].CategoryCode as string;

    // Replace the placeholder with the real code — retry up to 3 times so a transient
    // network error doesn't permanently lock the slot with __pending__.
    const membershipFinalPayload = {
      categoryCode,
      categoryName: catName,
      categoryDescription: catName,
      linkedType: 'membership',
      linkedYear: String(year),
      isActive: true,
      createdAt: serverTimestamp(),
    };
    let membershipSetErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await setDoc(categoryDocRef, membershipFinalPayload, { merge: true });
        return categoryCode;
      } catch (setErr) {
        membershipSetErr = setErr;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    // All retries failed — log with the categoryCode so it can be recovered manually
    errorLoggingService.logError(
      membershipSetErr instanceof Error ? membershipSetErr : new Error(`[categoryCode=${categoryCode}] ${String(membershipSetErr)}`),
      { component: 'toyyibService', action: 'getOrCreateMembershipCategory' }
    );
    throw new Error(`Failed to persist ToyyibPay category ${categoryCode} for ${catName} after 3 attempts`);
  }

  /**
   * Return the categoryCode for the given project's ToyyibPay category,
   * creating it on first use.
   */
  static async getOrCreateProjectCategory(projectId: string, projectTitle: string): Promise<string> {
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.TOYYIB_CATEGORIES),
      where('linkedType', '==', 'project'),
      where('linkedProjectId', '==', projectId),
      where('isActive', '==', true),
      limit(1),
    ));
    if (!snap.empty) return (snap.docs[0].data().categoryCode as string) || snap.docs[0].id;

    // Fix 4 (P1): use a Firestore transaction to atomically claim the deterministic doc slot.
    // Mirrors the same pattern used in getOrCreateMembershipCategory, including the polling
    // fix so concurrent caller B doesn't fall through to the API and create a duplicate category.
    const categoryDocRef = doc(db, COLLECTIONS.TOYYIB_CATEGORIES, `${projectId}_category`);
    let categoryCode: string | null = null;
    let didWinProjectRace = false;

    await runTransaction(db, async (txn) => {
      const existing = await txn.get(categoryDocRef);
      if (existing.exists()) {
        const data = existing.data();
        if (data.categoryCode && data.categoryCode !== '__pending__') {
          categoryCode = data.categoryCode as string;
        }
        return; // Slot already claimed
      }
      txn.set(categoryDocRef, { categoryCode: '__pending__', createdAt: Timestamp.now() });
      didWinProjectRace = true;
    });

    if (categoryCode) return categoryCode;

    if (!didWinProjectRace) {
      // Another call is creating the category — poll with exponential backoff
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        const pollSnap = await getDoc(categoryDocRef);
        const code = pollSnap.data()?.categoryCode;
        if (code && code !== '__pending__') return code as string;
      }
      throw new Error(`ToyyibPay category creation timed out for project ${projectTitle}`);
    }

    // Won the race — call the ToyyibPay API outside the transaction
    const result = await proxyCall('createCategory', { catname: projectTitle, catdescription: projectTitle });
    if (!Array.isArray(result) || !result[0]?.CategoryCode) {
      await setDoc(categoryDocRef, { categoryCode: null, isActive: false, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      throw new Error(`Failed to create ToyyibPay category for ${projectTitle}`);
    }
    categoryCode = result[0].CategoryCode as string;

    // Replace the placeholder with the real code — retry up to 3 times
    const projectFinalPayload = {
      categoryCode,
      categoryName: projectTitle,
      categoryDescription: projectTitle,
      linkedType: 'project',
      linkedProjectId: projectId,
      linkedProjectName: projectTitle,
      isActive: true,
      createdAt: serverTimestamp(),
    };
    let projectSetErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await setDoc(categoryDocRef, projectFinalPayload, { merge: true });
        return categoryCode;
      } catch (setErr) {
        projectSetErr = setErr;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    errorLoggingService.logError(
      projectSetErr instanceof Error ? projectSetErr : new Error(`[categoryCode=${categoryCode}] ${String(projectSetErr)}`),
      { component: 'toyyibService', action: 'getOrCreateProjectCategory' }
    );
    throw new Error(`Failed to persist ToyyibPay category ${categoryCode} for ${projectTitle} after 3 attempts`);
  }

  static async getSettlements(): Promise<ToyyibApiSettlement[]> {
    try {
      const data = await proxyCall('getSettlements');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('ToyyibPay getSettlements failed:', error);
      errorLoggingService.logError(error instanceof Error ? error : new Error(String(error)), { component: 'toyyibService', action: 'getSettlements' });
      return [];
    }
  }

  /**
   * Parse the callback data from ToyyibPay
   * Usually parameters are sent as POST: status_id, billcode, order_id, msg, transaction_id
   */
  static parseCallback(data: any) {
    return {
      status: data.status_id === '1' ? 'SUCCESS' : 'FAILED',
      billCode: data.billcode,
      transactionId: data.transaction_id,
      orderId: data.order_id,
      message: data.msg
    };
  }
}

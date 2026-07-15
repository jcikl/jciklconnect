import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp, addDoc, updateDoc, query, where, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS, TOYYIB_CONFIG } from '../config/constants';

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
  updatedAt?: any;
}

// All ToyyibPay API calls go through our Netlify Function proxy to avoid CORS.
// In local Vite dev, the function isn't available (404) — callers should handle null gracefully.
async function proxyCall(action: string, params: Record<string, string> = {}): Promise<any> {
  const response = await fetch('/.netlify/functions/toyyibpay-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

    const data = await proxyCall('createBill', {
      categoryCode: params.categoryCode || TOYYIB_CONFIG.CATEGORY_CODE,
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
      const billRecord: Omit<ToyyibBillRecord, 'createdAt'> & { createdAt: any } = {
        billCode,
        categoryCode: params.categoryCode || TOYYIB_CONFIG.CATEGORY_CODE,
        billName: params.billName,
        billDescription: params.billDescription,
        billAmount: params.billAmount,
        billTo: params.billTo,
        billEmail: params.billEmail,
        billpaymentStatus: '2',
        createdAt: serverTimestamp(),
      };
      if (params.memberId) billRecord.memberId = params.memberId;
      if (params.projectId) billRecord.projectId = params.projectId;
      await addDoc(collection(db, COLLECTIONS.TOYYIB_BILLS), billRecord);
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
    // Load known category codes from Firestore, plus bill aggregates in parallel
    const [snap, billsSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.TOYYIB_CATEGORIES)),
      getDocs(collection(db, COLLECTIONS.TOYYIB_BILLS)),
    ]);

    // Aggregate bills by categoryCode
    const billStats: Record<string, { count: number; total: number }> = {};
    billsSnap.docs.forEach(d => {
      const b = d.data() as ToyyibBillRecord;
      if (!b.categoryCode) return;
      if (!billStats[b.categoryCode]) billStats[b.categoryCode] = { count: 0, total: 0 };
      billStats[b.categoryCode].count += 1;
      billStats[b.categoryCode].total += b.billAmount || 0;
    });
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

  private static async saveCategoryToFirestore(cat: Omit<ToyyibCategory, 'createdAt'>): Promise<void> {
    const payload: Record<string, any> = {
      categoryName: cat.categoryName,
      categoryDescription: cat.categoryDescription,
      createdAt: serverTimestamp(),
    };
    if (cat.linkedType) payload.linkedType = cat.linkedType;
    if (cat.linkedProjectId) payload.linkedProjectId = cat.linkedProjectId;
    if (cat.linkedProjectName) payload.linkedProjectName = cat.linkedProjectName;
    if (cat.membershipType) payload.membershipType = cat.membershipType;
    await setDoc(doc(db, COLLECTIONS.TOYYIB_CATEGORIES, cat.categoryCode), payload, { merge: true });
  }

  static async createCategory(catname: string, catdescription: string): Promise<any[]> {
    const result = await proxyCall('createCategory', { catname, catdescription });
    // Save the new category code to Firestore so getCategories can find it
    if (Array.isArray(result) && result[0]?.CategoryCode) {
      await ToyyibService.saveCategoryToFirestore({
        categoryCode: result[0].CategoryCode,
        categoryName: catname,
        categoryDescription: catdescription,
      });
    }
    return result;
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

  static async getCategoryDetails(categoryCode: string): Promise<any[]> {
    const data = await proxyCall('getCategoryDetails', { categoryCode });
    return Array.isArray(data) ? data : [];
  }

  static async getBills(): Promise<ToyyibBillRecord[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.TOYYIB_BILLS));
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

    const snap = await getDocs(query(collection(db, COLLECTIONS.TOYYIB_BILLS), where('billCode', '==', billCode), limit(1)));
    const match = snap.docs[0];
    if (match) {
      await updateDoc(doc(db, COLLECTIONS.TOYYIB_BILLS, match.id), { billpaymentStatus, billPaymentDate });
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
      limit(1),
    ));
    if (!snap.empty) return snap.docs[0].id;

    const catName = `${year} Membership`;
    const result = await proxyCall('createCategory', { catname: catName, catdescription: catName });
    if (!Array.isArray(result) || !result[0]?.CategoryCode) {
      throw new Error(`Failed to create ToyyibPay category for ${catName}`);
    }
    const categoryCode: string = result[0].CategoryCode;
    await setDoc(doc(db, COLLECTIONS.TOYYIB_CATEGORIES, categoryCode), {
      categoryName: catName,
      categoryDescription: catName,
      linkedType: 'membership',
      linkedYear: String(year),
      createdAt: serverTimestamp(),
    });
    return categoryCode;
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
      limit(1),
    ));
    if (!snap.empty) return snap.docs[0].id;

    const result = await proxyCall('createCategory', { catname: projectTitle, catdescription: projectTitle });
    if (!Array.isArray(result) || !result[0]?.CategoryCode) {
      throw new Error(`Failed to create ToyyibPay category for ${projectTitle}`);
    }
    const categoryCode: string = result[0].CategoryCode;
    await setDoc(doc(db, COLLECTIONS.TOYYIB_CATEGORIES, categoryCode), {
      categoryName: projectTitle,
      categoryDescription: projectTitle,
      linkedType: 'project',
      linkedProjectId: projectId,
      linkedProjectName: projectTitle,
      createdAt: serverTimestamp(),
    });
    return categoryCode;
  }

  static async getSettlements(): Promise<any[]> {
    try {
      const data = await proxyCall('getSettlements');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('ToyyibPay getSettlements failed:', error);
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

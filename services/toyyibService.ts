import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
}

export interface ToyyibBillResponse {
  billCode: string;
  paymentUrl: string;
}

export interface ToyyibCategory {
  categoryCode: string;
  categoryName: string;
  categoryDescription: string;
  createdAt?: any;
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
      billAmount: params.billAmount.toFixed(2),
      billReturnUrl: window.location.origin + TOYYIB_CONFIG.RETURN_URL_SUFFIX,
      billCallbackUrl: window.location.origin + TOYYIB_CONFIG.CALLBACK_URL_SUFFIX,
      billExternalReferenceNo: params.externalReferenceNo || '',
      billTo: params.billTo,
      billEmail: params.billEmail,
      billPhone: params.billPhone,
    });

    if (Array.isArray(data) && data.length > 0) {
      const billCode = data[0].BillCode;
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
    // Load known category codes from Firestore
    const snap = await getDocs(collection(db, COLLECTIONS.TOYYIB_CATEGORIES));
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
        if (Array.isArray(details) && details.length > 0) return details[0] as ToyyibCategory;
        return null;
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<ToyyibCategory> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);
  }

  private static async saveCategoryToFirestore(cat: Omit<ToyyibCategory, 'createdAt'>): Promise<void> {
    await setDoc(
      doc(db, COLLECTIONS.TOYYIB_CATEGORIES, cat.categoryCode),
      { categoryName: cat.categoryName, categoryDescription: cat.categoryDescription, createdAt: serverTimestamp() },
      { merge: true }
    );
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

  static async deleteCategory(categoryCode: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.TOYYIB_CATEGORIES, categoryCode));
  }

  static async getCategoryDetails(categoryCode: string): Promise<any[]> {
    const data = await proxyCall('getCategoryDetails', { categoryCode });
    return Array.isArray(data) ? data : [];
  }

  static async getBills(): Promise<any[]> {
    try {
      const data = await proxyCall('getBills');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('ToyyibPay getBills failed:', error);
      return [];
    }
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

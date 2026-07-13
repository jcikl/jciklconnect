import { TOYYIB_CONFIG } from '../config/constants';

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
  // We maintain a localStorage cache of known category codes and fetch details for each.
  private static readonly CATEGORIES_CACHE_KEY = 'toyyib_category_codes';

  private static getCachedCategoryCodes(): string[] {
    try {
      const stored = localStorage.getItem(ToyyibService.CATEGORIES_CACHE_KEY);
      const codes: string[] = stored ? JSON.parse(stored) : [];
      // Always include the configured default category code
      if (TOYYIB_CONFIG.CATEGORY_CODE && !codes.includes(TOYYIB_CONFIG.CATEGORY_CODE)) {
        codes.unshift(TOYYIB_CONFIG.CATEGORY_CODE);
      }
      return codes;
    } catch {
      return TOYYIB_CONFIG.CATEGORY_CODE ? [TOYYIB_CONFIG.CATEGORY_CODE] : [];
    }
  }

  private static saveCategoryCode(code: string): void {
    try {
      const codes = ToyyibService.getCachedCategoryCodes();
      if (!codes.includes(code)) {
        codes.push(code);
        localStorage.setItem(ToyyibService.CATEGORIES_CACHE_KEY, JSON.stringify(codes));
      }
    } catch {}
  }

  static async getCategories(): Promise<any[]> {
    const codes = ToyyibService.getCachedCategoryCodes();
    if (codes.length === 0) return [];
    const results = await Promise.allSettled(
      codes.map(code => ToyyibService.getCategoryDetails(code))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(Boolean);
  }

  static async createCategory(catname: string, catdescription: string): Promise<any[]> {
    const result = await proxyCall('createCategory', { catname, catdescription });
    // Save the new category code to local cache so getCategories can find it
    if (Array.isArray(result) && result[0]?.CategoryCode) {
      ToyyibService.saveCategoryCode(result[0].CategoryCode);
    }
    return result;
  }

  static async getCategoryDetails(categoryCode: string): Promise<any[]> {
    return proxyCall('getCategoryDetails', { categoryCode });
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

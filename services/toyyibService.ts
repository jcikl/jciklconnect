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

  static async getCategories(): Promise<any[]> {
    try {
      const data = await proxyCall('getCategories');
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('ToyyibPay getCategories failed:', error);
      return [];
    }
  }

  static async createCategory(catname: string, catdescription: string): Promise<any[]> {
    return proxyCall('createCategory', { catname, catdescription });
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

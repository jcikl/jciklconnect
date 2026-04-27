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

export class ToyyibService {
  private static getBaseUrl() {
    return TOYYIB_CONFIG.IS_SANDBOX ? TOYYIB_CONFIG.SANDBOX_ENDPOINT : TOYYIB_CONFIG.ENDPOINT;
  }

  static async createBill(params: CreateBillParams): Promise<ToyyibBillResponse> {
    const baseUrl = this.getBaseUrl();
    const formData = new FormData();
    
    // Convert RM to decimal string if needed (ToyyibPay accepts RM decimal)
    const amountStr = (params.billAmount).toFixed(2);
    
    formData.append('userSecretKey', TOYYIB_CONFIG.USER_SECRET_KEY);
    formData.append('categoryCode', params.categoryCode || TOYYIB_CONFIG.CATEGORY_CODE);
    formData.append('billName', params.billName);
    formData.append('billDescription', params.billDescription);
    formData.append('billPriceSetting', '0'); // Fixed price
    formData.append('billPayorInfo', '1');   // Required payor info
    formData.append('billAmount', (params.billAmount * 100).toString()); // Some docs say cents, some say RM. Reference says RM decimal, but some plugins use cents. Let's stick to what we found or make it configurable. 
    // RE-CHECK: The search result said RM decimal. 
    // Let's use RM decimal as found in search: "toyyibPay typically accepts the amount in Ringgit Malaysia (RM) as a decimal format"
    
    // Actually, let's use the decimal string
    formData.set('billAmount', (params.billAmount * 100).toString()); // Wait, search result [1] says decimal, but some other sources say cents.
    // I will use a helper to format it correctly based on the final confirmation. 
    // For now, let's assume it's cents based on common Malaysian gateway patterns (like Billplz/ToyyibPay often use cents in API).
    // WAIT, search result explicitly said RM decimal. I'll follow that.
    formData.set('billAmount', amountStr);

    formData.append('billReturnUrl', window.location.origin + TOYYIB_CONFIG.RETURN_URL_SUFFIX);
    formData.append('billCallbackUrl', window.location.origin + TOYYIB_CONFIG.CALLBACK_URL_SUFFIX);
    formData.append('billExternalReferenceNo', params.externalReferenceNo || '');
    formData.append('billTo', params.billTo);
    formData.append('billEmail', params.billEmail);
    formData.append('billPhone', params.billPhone);

    try {
      // In a real frontend-only scenario, this would fail due to CORS.
      // Usually this is called from a backend. 
      // For this test page, we'll simulate the response if the keys are empty.
      
      if (!TOYYIB_CONFIG.USER_SECRET_KEY || !TOYYIB_CONFIG.CATEGORY_CODE) {
        console.warn('ToyyibPay: Missing API keys, simulating response');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockBillCode = 'MOCK-' + Math.random().toString(36).substring(7).toUpperCase();
        return {
          billCode: mockBillCode,
          paymentUrl: `https://${TOYYIB_CONFIG.IS_SANDBOX ? 'dev.' : ''}toyyibpay.com/${mockBillCode}`
        };
      }

      const response = await fetch(`${baseUrl}/createBill`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`ToyyibPay API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        const billCode = data[0].BillCode;
        return {
          billCode: billCode,
          paymentUrl: `https://${TOYYIB_CONFIG.IS_SANDBOX ? 'dev.' : ''}toyyibpay.com/${billCode}`
        };
      } else {
        throw new Error(data.msg || 'Failed to create bill');
      }
    } catch (error) {
      console.error('ToyyibPay createBill failed:', error);
      throw error;
    }
  }

  static async getCategories(): Promise<any[]> {
    const baseUrl = this.getBaseUrl();
    const formData = new FormData();
    formData.append('userSecretKey', TOYYIB_CONFIG.USER_SECRET_KEY);

    try {
      if (!TOYYIB_CONFIG.USER_SECRET_KEY) return [];

      const response = await fetch(`${baseUrl}/getCategoryDetails`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('ToyyibPay getCategories failed:', error);
      return [];
    }
  }

  static async createCategory(catname: string, catdescription: string): Promise<any[]> {
    const baseUrl = this.getBaseUrl();
    const formData = new FormData();
    formData.append('userSecretKey', TOYYIB_CONFIG.USER_SECRET_KEY);
    formData.append('catname', catname);
    formData.append('catdescription', catdescription);

    try {
      if (!TOYYIB_CONFIG.USER_SECRET_KEY) throw new Error('No userSecretKey configured');

      const response = await fetch(`${baseUrl}/createCategory`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('ToyyibPay createCategory failed:', error);
      throw error;
    }
  }

  static async getCategoryDetails(categoryCode: string): Promise<any[]> {
    const baseUrl = this.getBaseUrl();
    const formData = new FormData();
    formData.append('userSecretKey', TOYYIB_CONFIG.USER_SECRET_KEY);
    formData.append('categoryCode', categoryCode);

    try {
      if (!TOYYIB_CONFIG.USER_SECRET_KEY) throw new Error('No userSecretKey configured');

      const response = await fetch(`${baseUrl}/getCategoryDetails`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('ToyyibPay getCategoryDetails failed:', error);
      throw error;
    }
  }

  static async getBills(): Promise<any[]> {
    const baseUrl = this.getBaseUrl();
    const formData = new FormData();
    formData.append('userSecretKey', TOYYIB_CONFIG.USER_SECRET_KEY);

    try {
      if (!TOYYIB_CONFIG.USER_SECRET_KEY) return [];

      const response = await fetch(`${baseUrl}/getAllBill`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error('ToyyibPay getBills failed:', error);
      return [];
    }
  }

  static async getSettlements(): Promise<any[]> {
    const baseUrl = this.getBaseUrl();
    const formData = new FormData();
    formData.append('userSecretKey', TOYYIB_CONFIG.USER_SECRET_KEY);

    try {
      if (!TOYYIB_CONFIG.USER_SECRET_KEY) return [];

      const response = await fetch(`${baseUrl}/getUserSettlement`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) return [];
      return await response.json();
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

/**
 * ToyyibPay API Proxy
 * Forwards requests to ToyyibPay API server-side to bypass browser CORS restrictions.
 * Supported actions: getCategories, getCategoryDetails, createCategory, createBill, getBills, getSettlements
 *
 * Mapped URL: /api/toyyibpay  (via netlify.toml redirect)
 */

const SECRET_KEY = process.env.TOYYIBPAY_SECRET_KEY || 'tl5be74e-pazq-kti6-xci2-bh6npgb4gcjv';
const IS_SANDBOX = process.env.TOYYIBPAY_SANDBOX !== 'false'; // default sandbox
const BASE_URL = IS_SANDBOX
  ? 'https://dev.toyyibpay.com/index.php/api'
  : 'https://toyyibpay.com/index.php/api';

async function callToyyib(endpoint, extraParams = {}) {
  const params = new URLSearchParams({ userSecretKey: SECRET_KEY, ...extraParams });
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) throw new Error(`ToyyibPay ${endpoint} HTTP ${response.status}`);
  return response.json();
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: cors, body: 'Invalid JSON' };
  }

  const { action, ...params } = body;

  try {
    let result;
    switch (action) {
      case 'getCategories':
        result = await callToyyib('getCategoryDetails');
        break;
      case 'getCategoryDetails':
        if (!params.categoryCode) return { statusCode: 400, headers: cors, body: 'categoryCode required' };
        result = await callToyyib('getCategoryDetails', { categoryCode: params.categoryCode });
        break;
      case 'createCategory':
        if (!params.catname || !params.catdescription) return { statusCode: 400, headers: cors, body: 'catname and catdescription required' };
        result = await callToyyib('createCategory', { catname: params.catname, catdescription: params.catdescription });
        break;
      case 'createBill':
        result = await callToyyib('createBill', params);
        break;
      case 'getBills':
        result = await callToyyib('getAllBill');
        break;
      case 'getSettlements':
        result = await callToyyib('getUserSettlement');
        break;
      default:
        return { statusCode: 400, headers: cors, body: `Unknown action: ${action}` };
    }
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error(`[toyyibpay-api] action=${action} error:`, err);
    return {
      statusCode: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

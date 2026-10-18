// ToyyibPay sandbox / production selection shared by toyyibpay-api and toyyibpay-callback,
// so creating a bill and verifying its payment always talk to the same environment.
// Sandbox key = TOYYIBPAY_SECRET_KEY, production key = TOYYIBPAY_SECRET_KEY_PROD.

export const TOYYIB_API_BASE = {
  sandbox: 'https://dev.toyyibpay.com/index.php/api',
  production: 'https://toyyibpay.com/index.php/api',
};

/** Env fallback when Firestore has no setting: sandbox unless TOYYIBPAY_SANDBOX === 'false'. */
export function envDefaultIsSandbox(env = process.env) {
  return env.TOYYIBPAY_SANDBOX !== 'false';
}

/** Site-wide mode from systemConfig/toyyibpay (written by the settings switch), else the env fallback. */
export async function readToyyibIsSandbox(firestore, { env = process.env, logPrefix = '[toyyib]' } = {}) {
  try {
    const snap = await firestore.doc('systemConfig/toyyibpay').get();
    const value = snap.exists ? snap.data()?.isSandbox : undefined;
    if (typeof value === 'boolean') return value;
  } catch (err) {
    console.warn(`${logPrefix} Could not read systemConfig/toyyibpay, using env fallback:`, err.message);
  }
  return envDefaultIsSandbox(env);
}

export function secretKeyFor(isSandbox, env = process.env) {
  return isSandbox ? env.TOYYIBPAY_SECRET_KEY : (env.TOYYIBPAY_SECRET_KEY_PROD || env.TOYYIBPAY_SECRET_KEY);
}

export function apiBaseFor(isSandbox) {
  return isSandbox ? TOYYIB_API_BASE.sandbox : TOYYIB_API_BASE.production;
}

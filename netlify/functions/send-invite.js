const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const clientEmail = process.env.VITE_FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n');

console.log('[send-invite] init check:', {
  hasProjectId: !!projectId,
  hasClientEmail: !!clientEmail,
  hasPrivateKey: !!privateKey,
  privateKeyStart: privateKey?.slice(0, 40),
});

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'email is required' }) };
  }

  const auth = getAuth();

  try {
    try {
      await auth.getUserByEmail(email);
    } catch (notFoundErr) {
      if (notFoundErr.code === 'auth/user-not-found') {
        await auth.createUser({ email, emailVerified: false });
      } else {
        throw notFoundErr;
      }
    }

    const link = await auth.generatePasswordResetLink(email);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, link }),
    };
  } catch (err) {
    console.error('[send-invite] error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

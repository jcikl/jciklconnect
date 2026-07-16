const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const clientEmail = process.env.VITE_FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

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

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
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
      body: JSON.stringify({ success: true, message: 'Invite sent' }),
    };
  } catch (err) {
    console.error('[send-invite] error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

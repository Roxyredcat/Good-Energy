import admin from 'firebase-admin';

const CLEANUP_API_KEY = process.env.CLEANUP_API_KEY;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

function parseServiceAccount(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (jsonError) {
    try {
      const decoded = Buffer.from(value, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (base64Error) {
      return null;
    }
  }
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return admin;
  const serviceAccount = parseServiceAccount(FIREBASE_SERVICE_ACCOUNT);
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured or is invalid JSON');
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  return admin;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!CLEANUP_API_KEY) {
    return res.status(500).json({ error: 'CLEANUP_API_KEY is not configured' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim() !== CLEANUP_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const job = (req.body?.job || req.query.job || 'black-games').toString();
  if (job !== 'black-games') {
    return res.status(400).json({ error: 'Unsupported cleanup job. Use job=black-games.' });
  }

  let adminApp;
  try {
    adminApp = initFirebaseAdmin();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  const db = adminApp.firestore();
  const cutoffMillis = Date.now() - 48 * 60 * 60 * 1000;

  try {
    const snapshot = await db.collection('black_games').get();
    let deleted = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const created = data.createdAt;
      const createdMillis = created?.toMillis ? created.toMillis() : (created?.seconds ? created.seconds * 1000 : null);
      if (createdMillis && createdMillis < cutoffMillis) {
        await doc.ref.delete();
        deleted += 1;
      }
    }

    return res.status(200).json({
      success: true,
      job,
      deleted,
      scanned: snapshot.size,
      cutoff: new Date(cutoffMillis).toISOString()
    });
  } catch (error) {
    return res.status(500).json({ error: 'Cleanup failed: ' + error.message });
  }
}

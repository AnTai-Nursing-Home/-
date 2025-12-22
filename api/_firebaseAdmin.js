/**
 * Firebase Admin singleton for Vercel (Node runtime).
 * Required env vars:
 *  - FIREBASE_PROJECT_ID
 *  - FIREBASE_CLIENT_EMAIL
 *  - FIREBASE_PRIVATE_KEY          (keep as env; replace \n properly)
 *  - FIREBASE_STORAGE_BUCKET       (e.g. antai-nursing-home.firebasestorage.app)
 */
const admin = require('firebase-admin');

function getAdmin() {
  if (admin.apps && admin.apps.length) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new Error('Missing Firebase Admin env vars. Need FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket
  });

  return admin;
}

module.exports = { getAdmin };

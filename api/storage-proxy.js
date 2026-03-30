import { Storage } from '@google-cloud/storage';

let storageClient = null;

function getStorageClient() {
  if (storageClient) return storageClient;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin/GCS 環境變數未完整設定');
  }

  privateKey = String(privateKey).replace(/\\n/g, '\n');

  storageClient = new Storage({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });

  return storageClient;
}

function getBucketName() {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'antai-nursing-home.firebasestorage.app'
  );
}

function normalizePath(input) {
  return String(input || '').trim().replace(/^\/+/, '');
}

function isAllowedPath(path) {
  return path.startsWith('consults/');
}

function decodeHouseSession(headerValue) {
  if (!headerValue) return null;
  try {
    const json = Buffer.from(String(headerValue), 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    const staffId = String(parsed?.staffId || '').trim();
    const displayName = String(parsed?.displayName || '').trim();
    if (!staffId && !displayName) return null;
    return {
      staffId,
      displayName,
      sourceKey: String(parsed?.sourceKey || '').trim(),
    };
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const sessionUser = decodeHouseSession(req.headers['x-house-session']);
    if (!sessionUser) {
      return res.status(401).json({ error: '尚未登入或登入資訊無效' });
    }

    const path = normalizePath(req.query.path);
    if (!path || !isAllowedPath(path)) {
      return res.status(403).json({ error: '不允許存取此路徑' });
    }

    const client = getStorageClient();
    const bucket = client.bucket(getBucketName());
    const file = bucket.file(path);

    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: '找不到檔案' });
    }

    const [meta] = await file.getMetadata();
    const [buffer] = await file.download();

    res.setHeader('Content-Type', meta.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('storage-proxy error:', err);
    return res.status(500).json({
      error: '讀取檔案失敗',
      detail: err?.message || String(err),
    });
  }
}

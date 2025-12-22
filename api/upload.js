const Busboy = require('busboy');
const { randomUUID } = require('crypto');
const { getAdmin } = require('./_firebaseAdmin');

function sanitizeFileName(name) {
  const s = String(name || 'file').replace(/[\\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
  return s || 'file';
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  let docId = '';
  let who = '';
  const uploaded = [];

  try {
    const admin = getAdmin();
    const bucket = admin.storage().bucket();

    const bb = Busboy({ headers: req.headers, limits: { files: 10, fileSize: 25 * 1024 * 1024 } }); // 25MB/file
    const uploads = [];

    bb.on('field', (name, val) => {
      if (name === 'docId') docId = String(val || '').trim();
      if (name === 'who') who = String(val || '').trim();
    });

    bb.on('file', (name, file, info) => {
      if (name !== 'files') {
        // ignore unknown field name
        file.resume();
        return;
      }

      const filename = sanitizeFileName(info.filename);
      const contentType = info.mimeType || 'application/octet-stream';
      const token = randomUUID();

      // fallback if fields not arrived yet (rare): use temp values, we will validate later
      const _docId = docId || 'unknown';
      const _who = who || 'unknown';

      const path = `consults/${_docId}/${_who}/${Date.now()}_${filename}`;
      const gcsFile = bucket.file(path);

      let size = 0;

      const p = new Promise((resolve, reject) => {
        const stream = gcsFile.createWriteStream({
          resumable: false,
          metadata: {
            contentType,
            metadata: {
              firebaseStorageDownloadTokens: token
            }
          }
        });

        file.on('data', (d) => { size += d.length; });
        file.on('error', reject);
        stream.on('error', reject);
        stream.on('finish', async () => {
          const bucketName = bucket.name;
          const encoded = encodeURIComponent(path);
          const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
          uploaded.push({ name: filename, contentType, size, path, url });
          resolve();
        });

        file.pipe(stream);
      });

      uploads.push(p);
    });

    bb.on('close', async () => {
      try {
        // Validate required fields after parsing
        if (!docId) return json(res, 400, { error: 'Missing docId' });
        if (!who) return json(res, 400, { error: 'Missing who' });

        // If files arrived before fields, paths contain "unknown". Fix: move them is complex.
        // In practice fields arrive first in browsers; but we still guard by rejecting if any unknown path.
        const bad = uploaded.find(x => /\/unknown\//.test(x.path));
        if (bad) {
          return json(res, 400, { error: 'Upload order error: missing docId/who before files. Please retry.' });
        }

        await Promise.all(uploads);
        return json(res, 200, { uploaded });
      } catch (e) {
        return json(res, 500, { error: e.message || String(e) });
      }
    });

    req.pipe(bb);
  } catch (e) {
    return json(res, 500, { error: e.message || String(e) });
  }
};

// IMPORTANT for Vercel: disable default body parser
module.exports.config = {
  api: { bodyParser: false }
};

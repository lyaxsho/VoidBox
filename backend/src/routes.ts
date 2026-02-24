import { Router, Request, Response } from 'express';
import { createClient, sendFileToChannel, downloadFile } from './telegram.js';
import crypto from 'crypto';
import path from 'path';
import AdmZip from 'adm-zip';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { File, AbuseFlag, UserFile, User } from './models.js';

const JWT_SECRET = process.env.JWT_SECRET || 'voidbox-secret-key-change-in-production';

const router = Router();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
router.use(limiter);

function isValidDate(d: any) { return !isNaN(new Date(d).getTime()); }

// Extract user session from JWT
interface AuthPayload {
  id: string;
  telegram_id: number;
  session: string;
  channel_id?: number;
}

function extractAuth(req: Request): AuthPayload | null {
  let token: string | undefined;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Fall back to query parameter (for img/video/iframe/window.open)
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

// POST /upload
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const auth = extractAuth(req);
    if (!auth || !auth.session) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!auth.channel_id) {
      return res.status(400).json({ error: 'No VoidBox Drive channel. Please re-login.' });
    }

    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
    const { name, size, mimetype, data } = file;
    if (size > 2 * 1024 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max 2GB).' });
    }

    const slug = crypto.randomBytes(6).toString('base64url');
    const ext = path.extname(name);
    const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;

    // Upload via user's own session
    const client = createClient(auth.session);
    await client.connect();

    let tgInfo;
    try {
      tgInfo = await sendFileToChannel(client, auth.channel_id, data, uniqueName, mimetype);
    } catch (err: any) {
      console.error('User session upload failed:', err?.message || err);
      await client.disconnect();
      const msg = err?.message || '';
      if (msg.includes('AUTH_KEY') || msg.includes('SESSION') || msg.includes('Unauthorized')) {
        return res.status(401).json({ error: 'Telegram session expired. Please re-login.' });
      }
      if (msg.includes('TIMEOUT') || msg.includes('timeout')) {
        return res.status(504).json({ error: 'Telegram connection timed out. Please try again.' });
      }
      return res.status(500).json({ error: `Failed to upload file: ${msg || 'Unknown error'}` });
    }
    await client.disconnect();

    if (!tgInfo || !tgInfo.file_id) {
      return res.status(500).json({ error: 'Upload did not return a file_id.' });
    }

    const uploader_ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;
    let expiry_at: Date | undefined = undefined;
    if (req.body.expiry_at && isValidDate(req.body.expiry_at)) {
      expiry_at = new Date(req.body.expiry_at);
    } else if (req.body.expiry_days && !isNaN(Number(req.body.expiry_days))) {
      expiry_at = new Date(Date.now() + Number(req.body.expiry_days) * 86400000);
    }

    const fileMeta = await File.create({
      name,
      size,
      mimetype,
      slug,
      uploader_ip,
      telegram_file_id: tgInfo.file_id,
      telegram_message_id: tgInfo.message_id,
      download_count: 0,
      ...(expiry_at && { expiry_at }),
    });

    // Store in user files
    const isNote = req.body.is_note === 'true';
    await UserFile.create({
      user_id: auth.id,
      name,
      slug,
      mimetype,
      size,
      notes: req.body.notes || null,
      type: isNote ? 'note' : 'file',
    });

    res.status(201).json({
      slug,
      file: {
        name: fileMeta.name,
        size: fileMeta.size,
        mimetype: fileMeta.mimetype,
        created_at: fileMeta.created_at,
        download_count: fileMeta.download_count,
        expiry_at: fileMeta.expiry_at,
      },
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

// GET /file/:slug
router.get('/file/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const file = await File.findOne({ slug });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }
    res.json({
      name: file.name,
      size: file.size,
      mimetype: file.mimetype,
      created_at: file.created_at,
      download_count: file.download_count,
      expiry_at: file.expiry_at,
      download_url: `/api/download/${slug}`,
    });
  } catch (err) {
    console.error('File info error:', err);
    res.status(500).json({ error: 'Failed to fetch file info.' });
  }
});

// GET /download/:slug
router.get('/download/:slug', async (req: Request, res: Response) => {
  try {
    const auth = extractAuth(req);
    if (!auth || !auth.session || !auth.channel_id) {
      return res.status(401).json({ error: 'Authentication required for downloads' });
    }

    const { slug } = req.params;
    const file = await File.findOne({ slug });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }
    if (file.expiry_at && new Date(file.expiry_at) < new Date()) {
      return res.status(410).json({ error: 'File expired.' });
    }

    await File.updateOne({ _id: file._id }, { $inc: { download_count: 1 } });

    const client = createClient(auth.session);
    await client.connect();

    let buffer: Buffer;
    try {
      buffer = await downloadFile(client, auth.channel_id, parseInt(file.telegram_message_id, 10));
    } catch (err) {
      console.error('Download error:', err);
      await client.disconnect();
      return res.status(500).json({ error: 'Failed to download file.' });
    }
    await client.disconnect();

    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9_\-.]/g, '_');
    if (file.mimetype === 'application/pdf') {
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }
    res.send(buffer);
  } catch (err: any) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download file.' });
    }
  }
});

// POST /flag
router.post('/flag', async (req: Request, res: Response) => {
  try {
    const { file_id, slug, reason } = req.body;
    if (!reason || (!file_id && !slug)) {
      return res.status(400).json({ error: 'Missing file_id/slug or reason.' });
    }
    let fid = file_id;
    if (!fid && slug) {
      const file = await File.findOne({ slug });
      if (!file) return res.status(404).json({ error: 'File not found.' });
      fid = file._id;
    }
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;
    await AbuseFlag.create({ file_id: fid, reason, ip });
    res.json({ success: true });
  } catch (err) {
    console.error('Flag error:', err);
    res.status(500).json({ error: 'Failed to flag file.' });
  }
});

// GET /note-content/:slug
router.get('/note-content/:slug', async (req: Request, res: Response) => {
  try {
    const auth = extractAuth(req);
    if (!auth || !auth.session || !auth.channel_id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { slug } = req.params;
    const file = await File.findOne({ slug });
    if (!file) return res.status(404).json({ error: 'File not found.' });

    const client = createClient(auth.session);
    await client.connect();
    const buffer = await downloadFile(client, auth.channel_id, parseInt(file.telegram_message_id, 10));
    await client.disconnect();

    res.set('Content-Type', 'text/plain');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(buffer.toString('utf-8'));
  } catch (err) {
    console.error('Note content error:', err);
    res.status(500).json({ error: 'Failed to fetch note content.' });
  }
});

// GET /zip-list/:slug
router.get('/zip-list/:slug', async (req: Request, res: Response) => {
  try {
    const auth = extractAuth(req);
    if (!auth || !auth.session || !auth.channel_id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { slug } = req.params;
    const file = await File.findOne({ slug });
    if (!file) return res.status(404).json({ error: 'File not found.' });
    if (file.mimetype !== 'application/zip' && file.mimetype !== 'application/x-zip-compressed') {
      return res.status(400).json({ error: 'Not a ZIP file.' });
    }

    const client = createClient(auth.session);
    await client.connect();
    const buffer = await downloadFile(client, auth.channel_id, parseInt(file.telegram_message_id, 10));
    await client.disconnect();

    const zip = new AdmZip(buffer);
    const files = zip.getEntries().map((e: AdmZip.IZipEntry) => e.entryName);
    res.json({ files });
  } catch (err) {
    console.error('ZIP list error:', err);
    res.status(500).json({ error: 'Failed to extract ZIP file list.' });
  }
});

// GET /mydrops
router.get('/mydrops', async (req: Request, res: Response) => {
  try {
    const user_id = req.query.user_id;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
    const files = await UserFile.find({ user_id }).sort({ created_at: -1 });
    res.json({ files });
  } catch (err) {
    console.error('mydrops fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user files.' });
  }
});

// DELETE /mydrops/:slug
router.delete('/mydrops/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const auth = extractAuth(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    // Verify the file belongs to this user
    const userFile = await UserFile.findOne({ slug, user_id: auth.id });
    if (!userFile) return res.status(404).json({ error: 'File not found' });

    // Delete the message from Telegram if we have session + channel
    if (auth.session && auth.channel_id) {
      const fileMeta = await File.findOne({ slug });
      if (fileMeta?.telegram_message_id) {
        try {
          const { deleteMessage } = await import('./telegram.js');
          const client = createClient(auth.session);
          await client.connect();
          await deleteMessage(client, auth.channel_id, parseInt(fileMeta.telegram_message_id, 10));
          await client.disconnect();
        } catch (tgErr: any) {
          console.error('Telegram delete error (non-fatal):', tgErr?.message);
          // Continue even if Telegram delete fails
        }
      }
      // Delete from File collection
      await File.deleteOne({ slug });
    }

    // Delete from UserFile collection
    await UserFile.deleteOne({ slug, user_id: auth.id });
    res.json({ success: true });
  } catch (err) {
    console.error('mydrops delete error:', err);
    res.status(500).json({ error: 'Failed to delete user file.' });
  }
});

export default router;
import { Router, Request, Response } from 'express';
import {
  sendFileToChannel,
  downloadFile,
  streamFileToResponse,
  parseRangeHeader,
  isSessionAuthError,
} from './telegram.js';
import { acquireClient, releaseClient, invalidateClient } from './telegramPool.js';
import {
  streamBotFileToResponse,
  downloadBotFileBuffer,
  deleteBotMessage,
  streamChunkedBotFileToResponse,
  downloadChunkedBotFileBuffer,
} from './telegramBot.js';
import {
  uploadViaStandardQueue,
  uploadChunkedViaQueue,
  STANDARD_MAX_BYTES,
  STANDARD_CHUNK_SIZE,
} from './standardStorage.js';
import { extractAuth, usesSecureStorage } from './jwtAuth.js';
import { User, File, AbuseFlag, UserFile, FileChunk, StorageMode } from './models.js';
import { initUploadProgress, updateUploadProgress, markUploadDone, getUploadProgress } from './uploadProgressStore.js';
import crypto from 'crypto';
import path from 'path';
import AdmZip from 'adm-zip';
import rateLimit from 'express-rate-limit';

const router = Router();
const isDev = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({ windowMs: 60 * 1000, max: isDev ? 5_000 : 60 });
router.use(limiter);

function isValidDate(d: any) {
  return !isNaN(new Date(d).getTime());
}

function safeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9_\-.]/g, '_');
}

async function resolveSecureMode(req: Request): Promise<{
  auth: NonNullable<ReturnType<typeof extractAuth>>;
  user: NonNullable<Awaited<ReturnType<typeof User.findById>>>;
  secure: boolean;
  effectiveSession: string | undefined;
  effectiveChannelId: number | undefined;
} | null> {
  const auth = extractAuth(req);
  if (!auth) return null;
  const user = await User.findById(auth.id) as any;
  if (!user) return null;
  // Fall back to DB values if JWT is missing session/channel (stale token scenario)
  const effectiveSession: string | undefined = auth.session || user.telegram_session || undefined;
  const effectiveChannelId: number | undefined = auth.channel_id || user.channel_id || undefined;
  const secure = Boolean(
    (user.secure_upload_enabled ?? auth.secure_upload_enabled) &&
    effectiveSession &&
    effectiveChannelId &&
    user.telegram_id
  );
  return { auth, user, secure, effectiveSession, effectiveChannelId };
}

// POST /upload
router.post('/upload', async (req: Request, res: Response) => {
  const resolved = await resolveSecureMode(req);
  if (!resolved) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { auth, user, secure, effectiveSession, effectiveChannelId } = resolved;

  const u = user as any;
  console.log(
    `[upload] mode=\x1b[${secure ? '32' : '33'}m${secure ? 'SECURE' : 'STANDARD'}\x1b[0m` +
    ` | secure_enabled=${u.secure_upload_enabled}` +
    ` | has_session=${!!effectiveSession}` +
    ` | jwt_session=${!!auth.session}` +
    ` | db_session=${!!u.telegram_session}` +
    ` | channel_id=${effectiveChannelId ?? 'none'}` +
    ` | telegram_id=${u.telegram_id ?? 'none'}`
  );

  // If user wants secure but credentials are missing, fail loudly instead of silent fallback
  if (u.secure_upload_enabled && !secure) {
    return res.status(400).json({
      error: 'Telegram session missing. Please re-link Telegram to use Secure Upload.',
      code: 'telegram_link_required',
    });
  }

  if (!req.files?.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const file = Array.isArray(req.files.file) ? req.files.file[0] : req.files.file;
  const { name, size, mimetype, data } = file;

  const maxSize = secure ? 2 * 1024 * 1024 * 1024 : STANDARD_MAX_BYTES;
  if (size > maxSize) {
    return res.status(413).json({
      error: secure
        ? 'File too large (max 2GB for Secure Upload).'
        : `File too large (max ${STANDARD_MAX_BYTES / 1024 / 1024}MB on standard storage).`,
    });
  }

  const slug = crypto.randomBytes(12).toString('base64url');
  const ext = path.extname(name);
  const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const storage_mode: StorageMode = secure ? 'secure' : 'standard';

  const uploader_ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;
  let expiry_at: Date | undefined;
  if (req.body.expiry_at && isValidDate(req.body.expiry_at)) {
    const d = new Date(req.body.expiry_at);
    if (d <= new Date()) return res.status(400).json({ error: 'Expiry date must be in the future.' });
    expiry_at = d;
  } else if (req.body.expiry_days && !isNaN(Number(req.body.expiry_days))) {
    const days = Number(req.body.expiry_days);
    if (days <= 0) return res.status(400).json({ error: 'Expiry days must be greater than 0.' });
    expiry_at = new Date(Date.now() + days * 86400000);
  }
  const isNote = req.body.is_note === 'true';

  if (secure) {
    // ── Secure path: GramJS → user's personal channel ──
    const client = await acquireClient(effectiveSession!);
    let tgInfo;
    try {
      tgInfo = await sendFileToChannel(client, effectiveChannelId!, data, uniqueName, mimetype);
    } catch (err: any) {
      const msg = err?.message || '';
      if (isSessionAuthError(msg)) {
        await invalidateClient(effectiveSession!);
        return res.status(401).json({ error: 'Telegram session expired. Please re-link Telegram.' });
      }
      if (msg.includes('TIMEOUT') || msg.includes('timeout')) {
        return res.status(504).json({ error: 'Telegram connection timed out. Please try again.' });
      }
      return res.status(500).json({ error: `Upload failed: ${msg || 'Unknown error'}` });
    } finally {
      releaseClient(effectiveSession!);
    }

    try {
      const fileMeta = await File.create({
        name, size, mimetype, slug, uploader_ip,
        telegram_file_id: tgInfo.file_id,
        telegram_message_id: tgInfo.message_id,
        storage_mode,
        download_count: 0,
        ...(expiry_at && { expiry_at }),
      });
      await UserFile.create({ user_id: auth.id, name, slug, mimetype, size, storage_mode, notes: req.body.notes || null, type: isNote ? 'note' : 'file', thumbnail: req.body.thumbnail || undefined });
      return res.status(201).json({
        slug, storage_mode,
        file: { name: fileMeta.name, size: fileMeta.size, mimetype: fileMeta.mimetype, created_at: fileMeta.created_at, download_count: fileMeta.download_count, expiry_at: fileMeta.expiry_at },
      });
    } catch (err) {
      console.error('Upload DB error:', err);
      return res.status(500).json({ error: 'Upload failed while saving metadata.' });
    }
  }

  const uploadId = typeof req.body.upload_id === 'string' ? req.body.upload_id : undefined;

  // ── Standard path: Bot API → shared channel ──
  if (size > STANDARD_CHUNK_SIZE) {
    // Large file: split into chunks and upload each one
    const totalChunks = Math.ceil(size / STANDARD_CHUNK_SIZE);
    console.log(`[upload] "${name}" ${(size / 1024 / 1024).toFixed(2)}MB > ${STANDARD_CHUNK_SIZE / 1024 / 1024}MB limit → chunked upload | slug=${slug} | total_chunks=${totalChunks}`);
    if (uploadId) initUploadProgress(uploadId, size, totalChunks);
    try {
      const fileMeta = await File.create({
        name, size, mimetype, slug, uploader_ip,
        telegram_file_id: '',
        telegram_message_id: '',
        storage_mode,
        is_chunked: true,
        total_chunks: totalChunks,
        download_count: 0,
        ...(expiry_at && { expiry_at }),
      });

      await uploadChunkedViaQueue(data, uniqueName, async (chunkIndex, _total, tgInfo) => {
        const chunkBytes = Math.min(STANDARD_CHUNK_SIZE, size - chunkIndex * STANDARD_CHUNK_SIZE);
        if (uploadId) updateUploadProgress(uploadId, chunkBytes);
        console.log(`[upload] chunk ${chunkIndex + 1}/${totalChunks} → tg_file_id=${tgInfo.file_id} | msg_id=${tgInfo.message_id}`);
        await FileChunk.create({
          file_slug: slug,
          chunk_index: chunkIndex,
          telegram_file_id: tgInfo.file_id,
          telegram_message_id: tgInfo.message_id,
          size: chunkBytes,
        });
      });
      console.log(`[upload] all ${totalChunks} chunks saved | slug=${slug}`);
      if (uploadId) markUploadDone(uploadId);

      await UserFile.create({ user_id: auth.id, name, slug, mimetype, size, storage_mode, notes: req.body.notes || null, type: isNote ? 'note' : 'file', thumbnail: req.body.thumbnail || undefined });
      return res.status(201).json({
        slug, storage_mode,
        file: { name: fileMeta.name, size: fileMeta.size, mimetype: fileMeta.mimetype, created_at: fileMeta.created_at, download_count: fileMeta.download_count, expiry_at: fileMeta.expiry_at },
      });
    } catch (err: any) {
      console.error('Chunked standard upload failed:', err);
      await File.deleteOne({ slug }).catch(() => {});
      await FileChunk.deleteMany({ file_slug: slug }).catch(() => {});
      return res.status(500).json({ error: `Upload failed: ${err.message || 'Unknown error'}` });
    }
  }

  // Small file: direct single upload (≤ STANDARD_CHUNK_SIZE)
  console.log(`[upload] "${name}" ${(size / 1024 / 1024).toFixed(2)}MB ≤ ${STANDARD_CHUNK_SIZE / 1024 / 1024}MB → direct standard upload | slug=${slug}`);
  if (uploadId) initUploadProgress(uploadId, size, 1);
  let tgInfo;
  try {
    tgInfo = await uploadViaStandardQueue(data, uniqueName, mimetype);
  } catch (err: any) {
    console.error('[upload] standard upload failed:', err);
    return res.status(500).json({ error: `Upload failed: ${err.message || 'Unknown error'}` });
  }

  if (!tgInfo?.file_id) {
    return res.status(500).json({ error: 'Upload did not return a file_id.' });
  }
  if (uploadId) { updateUploadProgress(uploadId, size); markUploadDone(uploadId); }

  try {
    const fileMeta = await File.create({
      name, size, mimetype, slug, uploader_ip,
      telegram_file_id: tgInfo.file_id,
      telegram_message_id: tgInfo.message_id,
      storage_mode,
      download_count: 0,
      ...(expiry_at && { expiry_at }),
    });
    await UserFile.create({ user_id: auth.id, name, slug, mimetype, size, storage_mode, notes: req.body.notes || null, type: isNote ? 'note' : 'file', thumbnail: req.body.thumbnail || undefined });
    return res.status(201).json({
      slug, storage_mode,
      file: { name: fileMeta.name, size: fileMeta.size, mimetype: fileMeta.mimetype, created_at: fileMeta.created_at, download_count: fileMeta.download_count, expiry_at: fileMeta.expiry_at },
    });
  } catch (err) {
    console.error('Upload DB error:', err);
    return res.status(500).json({ error: 'Upload failed while saving metadata.' });
  }
});

router.get('/file/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const file = await File.findOne({ slug });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Start 24hr link-access timer on first visit by a non-owner
    const viewer = extractAuth(req);
    const isOwner = viewer && await UserFile.exists({ slug, user_id: viewer.id });
    let link_accessed_at = (file as any).link_accessed_at as Date | undefined;
    if (!link_accessed_at && !isOwner) {
      link_accessed_at = new Date();
      await File.updateOne({ _id: file._id }, { link_accessed_at });
    }
    const link_expires_at = link_accessed_at
      ? new Date(link_accessed_at.getTime() + 24 * 60 * 60 * 1000)
      : undefined;

    res.json({
      name: file.name,
      size: file.size,
      mimetype: file.mimetype,
      storage_mode: file.storage_mode,
      created_at: file.created_at,
      download_count: file.download_count,
      expiry_at: file.expiry_at,
      link_accessed_at,
      link_expires_at,
      download_url: `/api/download/${slug}`,
    });
  } catch (err) {
    console.error('File info error:', err);
    res.status(500).json({ error: 'Failed to fetch file info.' });
  }
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 5_000 : 20,
  keyGenerator: (req) => `${req.params.slug}:${(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anon') as string}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many download requests for this file. Try again in a minute.' },
});

router.get('/download/:slug', downloadLimiter, async (req: Request, res: Response) => {
  const auth = extractAuth(req);
  const { slug } = req.params;

  try {
    const file = await File.findOne({ slug });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }
    if (file.expiry_at && new Date(file.expiry_at) < new Date()) {
      return res.status(410).json({ error: 'File expired.' });
    }
    const fileAccessedAt = (file as any).link_accessed_at as Date | undefined;
    if (fileAccessedAt && fileAccessedAt.getTime() + 24 * 60 * 60 * 1000 < Date.now()) {
      return res.status(410).json({ error: 'Link expired. The 24-hour access window has closed.' });
    }

    await File.updateOne({ _id: file._id }, { $inc: { download_count: 1 } });

    const safeName = safeFilename(file.name);
    const inline = file.mimetype === 'application/pdf';

    if (file.storage_mode === 'secure') {
      if (!auth) {
        return res.status(401).json({ error: 'Authentication required (this file is stored in a private Telegram channel).' });
      }
      const dbUser = await User.findById(auth.id) as any;
      const dlSession: string | undefined = auth.session || dbUser?.telegram_session || undefined;
      const dlChannelId: number | undefined = auth.channel_id || dbUser?.channel_id || undefined;
      if (!dlSession || !dlChannelId) {
        return res.status(401).json({ error: 'Telegram session required for this file. Please re-link Telegram.' });
      }

      const range = parseRangeHeader(
        typeof req.headers.range === 'string' ? req.headers.range : undefined,
        file.size
      );

      const client = await acquireClient(dlSession);
      try {
        await streamFileToResponse(
          client,
          dlChannelId,
          parseInt(file.telegram_message_id, 10),
          res,
          {
            fileSize: file.size,
            mimetype: file.mimetype || 'application/octet-stream',
            filename: safeName,
            inline,
            range,
          }
        );
      } catch (err: any) {
        if (isSessionAuthError(err?.message || '')) {
          await invalidateClient(dlSession);
          if (!res.headersSent) {
            return res.status(401).json({ error: 'Telegram session expired. Please re-link Telegram.' });
          }
        }
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Failed to download file.' });
        }
      } finally {
        releaseClient(dlSession);
      }
      return;
    }

    if (file.is_chunked) {
      const chunks = await FileChunk.find({ file_slug: slug }).sort({ chunk_index: 1 });
      console.log(`[download] "${file.name}" is_chunked=true | chunks_found=${chunks.length}/${file.total_chunks} | slug=${slug}`);
      chunks.forEach((c, i) => console.log(`  chunk ${i}: index=${c.chunk_index} file_id=${c.telegram_file_id}`));
      if (chunks.length === 0) {
        return res.status(500).json({ error: 'File chunks not found.' });
      }
      await streamChunkedBotFileToResponse(chunks, res, file.size, {
        mimetype: file.mimetype || 'application/octet-stream',
        filename: safeName,
        inline,
      });
    } else {
      await streamBotFileToResponse(file.telegram_file_id, res, {
        mimetype: file.mimetype || 'application/octet-stream',
        filename: safeName,
        inline,
      });
    }
  } catch (err: any) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download file.' });
    }
  }
});

router.post('/flag', async (req, res) => {
  try {
    const auth = extractAuth(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });
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

router.get('/note-content/:slug', async (req, res) => {
  const auth = extractAuth(req);
  const { slug } = req.params;

  try {
    const file = await File.findOne({ slug });
    if (!file) return res.status(404).json({ error: 'File not found.' });

    let buffer: Buffer;

    if (file.storage_mode === 'secure') {
      if (!auth) {
        return res.status(401).json({ error: 'Authentication required (private storage).' });
      }
      const dbUser2 = await User.findById(auth.id) as any;
      const noteSession: string | undefined = auth.session || dbUser2?.telegram_session || undefined;
      const noteChannelId: number | undefined = auth.channel_id || dbUser2?.channel_id || undefined;
      if (!noteSession || !noteChannelId) {
        return res.status(401).json({ error: 'Telegram session required' });
      }
      const client = await acquireClient(noteSession);
      try {
        buffer = await downloadFile(
          client,
          noteChannelId,
          parseInt(file.telegram_message_id, 10)
        );
      } finally {
        releaseClient(noteSession);
      }
    } else if (file.is_chunked) {
      const chunks = await FileChunk.find({ file_slug: slug }).sort({ chunk_index: 1 });
      buffer = await downloadChunkedBotFileBuffer(chunks);
    } else {
      buffer = await downloadBotFileBuffer(file.telegram_file_id);
    }

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(buffer.toString('utf-8'));
  } catch (err) {
    console.error('Note content error:', err);
    res.status(500).json({ error: 'Failed to fetch note content.' });
  }
});

router.get('/zip-list/:slug', async (req, res) => {
  const auth = extractAuth(req);
  const { slug } = req.params;

  try {
    const file = await File.findOne({ slug });
    if (!file) return res.status(404).json({ error: 'File not found.' });
    if (file.mimetype !== 'application/zip' && file.mimetype !== 'application/x-zip-compressed') {
      return res.status(400).json({ error: 'Not a ZIP file.' });
    }
    if (file.size > 20 * 1024 * 1024) {
      return res.status(400).json({ error: 'ZIP file too large for preview.' });
    }

    let buffer: Buffer;

    if (file.storage_mode === 'secure') {
      if (!auth) {
        return res.status(401).json({ error: 'Authentication required (private storage).' });
      }
      const dbUser3 = await User.findById(auth.id) as any;
      const zipSession: string | undefined = auth.session || dbUser3?.telegram_session || undefined;
      const zipChannelId: number | undefined = auth.channel_id || dbUser3?.channel_id || undefined;
      if (!zipSession || !zipChannelId) {
        return res.status(401).json({ error: 'Telegram session required' });
      }
      const client = await acquireClient(zipSession);
      try {
        buffer = await downloadFile(
          client,
          zipChannelId,
          parseInt(file.telegram_message_id, 10)
        );
      } finally {
        releaseClient(zipSession);
      }
    } else if (file.is_chunked) {
      const chunks = await FileChunk.find({ file_slug: slug }).sort({ chunk_index: 1 });
      buffer = await downloadChunkedBotFileBuffer(chunks);
    } else {
      buffer = await downloadBotFileBuffer(file.telegram_file_id);
    }

    const zip = new AdmZip(buffer);
    const files = zip.getEntries().map((e: AdmZip.IZipEntry) => e.entryName);
    res.json({ files });
  } catch (err) {
    console.error('ZIP list error:', err);
    res.status(500).json({ error: 'Failed to extract ZIP file list.' });
  }
});

router.get('/mydrops', async (req, res) => {
  try {
    const auth = extractAuth(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });
    const files = await UserFile.find({ user_id: auth.id }).sort({ created_at: -1 });
    res.json({ files });
  } catch (err) {
    console.error('mydrops fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user files.' });
  }
});

async function deleteUserDrop(slug: string, auth: any): Promise<{ ok: boolean; reason?: string }> {
  const userFile = await UserFile.findOne({ slug, user_id: auth.id });
  if (!userFile) return { ok: false, reason: 'not_found' };

  const fileMeta = await File.findOne({ slug });
  if (fileMeta) {
    try {
      if (fileMeta.storage_mode === 'secure' && auth.session && auth.channel_id) {
        const { deleteMessage } = await import('./telegram.js');
        const client = await acquireClient(auth.session);
        try {
          await deleteMessage(client, auth.channel_id, parseInt(fileMeta.telegram_message_id, 10));
        } finally {
          releaseClient(auth.session);
        }
      } else if (fileMeta.storage_mode === 'standard') {
        if (fileMeta.is_chunked) {
          const chunks = await FileChunk.find({ file_slug: slug });
          for (const chunk of chunks) {
            await deleteBotMessage(chunk.telegram_message_id).catch(() => {});
          }
          await FileChunk.deleteMany({ file_slug: slug });
        } else {
          await deleteBotMessage(fileMeta.telegram_message_id).catch(() => {});
        }
      }
    } catch (tgErr: any) {
      console.error('Telegram delete error (non-fatal):', tgErr?.message);
    }
    await File.deleteOne({ slug });
  }
  await UserFile.deleteOne({ slug, user_id: auth.id });
  return { ok: true };
}

router.delete('/mydrops/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const auth = extractAuth(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });
    const result = await deleteUserDrop(slug, auth);
    if (!result.ok) return res.status(404).json({ error: 'File not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('mydrops delete error:', err);
    res.status(500).json({ error: 'Failed to delete user file.' });
  }
});

router.post('/mydrops/bulk-delete', async (req, res) => {
  try {
    const auth = extractAuth(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });
    const slugs: unknown = req.body?.slugs;
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return res.status(400).json({ error: 'slugs must be a non-empty array' });
    }
    if (slugs.length > 100) {
      return res.status(400).json({ error: 'Cannot delete more than 100 files at once' });
    }
    let deleted = 0;
    const failed: string[] = [];
    for (const s of slugs) {
      if (typeof s !== 'string') continue;
      const r = await deleteUserDrop(s, auth);
      if (r.ok) deleted++;
      else failed.push(s);
    }
    res.json({ success: true, deleted, failed });
  } catch (err) {
    console.error('mydrops bulk-delete error:', err);
    res.status(500).json({ error: 'Failed to bulk-delete user files.' });
  }
});

// GET /upload-progress/:uploadId — polled by frontend during processing phase
router.get('/upload-progress/:uploadId', (req, res) => {
  const { uploadId } = req.params;
  const progress = getUploadProgress(uploadId);
  if (!progress) {
    // Unknown ID — either already done/cleaned or never started
    return res.json({ totalBytes: 0, processedBytes: 0, totalChunks: 0, processedChunks: 0, done: true });
  }
  res.json(progress);
});

export default router;

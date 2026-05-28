import { Router, Request, Response, NextFunction } from 'express';
import { User, UserFile } from './models.js';
import { extractAuth } from './jwtAuth.js';

const router = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const incomingSecret = req.headers['x-admin-secret'] as string;
  if (ADMIN_SECRET && incomingSecret === ADMIN_SECRET) return next();
  const auth = extractAuth(req);
  if (auth?.is_admin) return next();
  return res.status(403).json({ error: 'Admin access required' });
}

// POST /api/admin/verify — check secret or JWT admin flag
router.post('/verify', (req, res) => {
  const incomingSecret = req.body?.secret as string;
  if (ADMIN_SECRET && incomingSecret === ADMIN_SECRET) {
    return res.json({ ok: true });
  }
  const auth = extractAuth(req);
  if (auth?.is_admin) return res.json({ ok: true });
  return res.status(403).json({ error: 'Invalid admin credentials' });
});

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const [totalUsers, verifiedUsers, telegramUsers, totalFiles, secureFiles, storageResult] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ email_verified: true }),
        User.countDocuments({ telegram_id: { $exists: true } }),
        UserFile.countDocuments(),
        UserFile.countDocuments({ storage_mode: 'secure' }),
        UserFile.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]),
      ]);

    res.json({
      users: { total: totalUsers, verified: verifiedUsers, telegram: telegramUsers },
      files: { total: totalFiles, secure: secureFiles, standard: totalFiles - secureFiles },
      storage: storageResult[0]?.total ?? 0,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users?page=1&limit=20&q=
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const q     = req.query.q as string;

    const filter: Record<string, unknown> = {};
    if (q) filter.email = { $regex: q, $options: 'i' };

    const [users, total] = await Promise.all([
      User.find(filter, { password_hash: 0, telegram_session: 0, email_verify_token: 0 })
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const userIds = users.map((u) => u._id);
    const fileCounts = await UserFile.aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $group: { _id: '$user_id', count: { $sum: 1 }, size: { $sum: '$size' } } },
    ]);
    const fileMap = Object.fromEntries(fileCounts.map((f) => [f._id, f]));

    res.json({
      users: users.map((u) => ({
        ...u,
        file_count: fileMap[u._id]?.count ?? 0,
        total_size: fileMap[u._id]?.size  ?? 0,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id  { action: 'verify_email' | 'toggle_admin' | 'unlink_telegram' }
router.patch('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { action } = req.body;
    if (action === 'verify_email') {
      await User.updateOne({ _id: req.params.id }, { $set: { email_verified: true }, $unset: { email_verify_token: 1 } });
    } else if (action === 'toggle_admin') {
      await User.updateOne({ _id: req.params.id }, { $set: { is_admin: !user.is_admin } });
    } else if (action === 'unlink_telegram') {
      await User.updateOne(
        { _id: req.params.id },
        { $set: { secure_upload_enabled: false }, $unset: { telegram_id: 1, telegram_session: 1, channel_id: 1, username: 1, photo_url: 1 } }
      );
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    await Promise.all([
      User.deleteOne({ _id: req.params.id }),
      UserFile.deleteMany({ user_id: req.params.id }),
    ]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/files?page=1&limit=20&q=
router.get('/files', requireAdmin, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const q     = req.query.q as string;

    const filter: Record<string, unknown> = {};
    if (q) filter.name = { $regex: q, $options: 'i' };

    const [files, total] = await Promise.all([
      UserFile.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      UserFile.countDocuments(filter),
    ]);

    const userIds = [...new Set(files.map((f) => f.user_id))];
    const owners  = await User.find({ _id: { $in: userIds } }, { email: 1 }).lean();
    const emailMap = Object.fromEntries(owners.map((u) => [u._id, u.email]));

    res.json({
      files: files.map((f) => ({ ...f, user_email: emailMap[f.user_id] ?? '—' })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// DELETE /api/admin/files/:id
router.delete('/files/:id', requireAdmin, async (req, res) => {
  try {
    await UserFile.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;

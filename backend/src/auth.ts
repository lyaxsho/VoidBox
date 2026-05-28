import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { computeCheck } from 'telegram/Password.js';
import { User, type IUser } from './models.js';
import {
  JWT_SECRET,
  TEMP_TOKEN_SECRET,
  buildJwtPayload,
  signToken,
  extractAuth,
  userResponse,
} from './jwtAuth.js';
import { createDriveChannel } from './telegram.js';
import { sendVerificationEmail, sendMagicLinkEmail } from './email.js';

const router = Router();

const TG_API_ID = parseInt(process.env.TG_API_ID || '0', 10);
const TG_API_HASH = process.env.TG_API_HASH || '';
const REQUIRE_EMAIL_VERIFICATION =
  process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

if (!TG_API_ID || !TG_API_HASH) {
  console.warn('WARNING: TG_API_ID or TG_API_HASH not set — Secure Upload / Telegram link will not work');
}

function createTelegramClient(sessionStr: string = ''): TelegramClient {
  const session = new StringSession(sessionStr);
  return new TelegramClient(session, TG_API_ID, TG_API_HASH, {
    connectionRetries: 3,
  });
}

async function issueTokenForUser(user: IUser, session?: string) {
  const fresh = await User.findById(user._id);
  if (!fresh) throw new Error('User not found');
  const payload = buildJwtPayload(fresh, session);
  return {
    token: signToken(payload),
    user: userResponse(fresh, { channel_id: payload.channel_id }),
  };
}

// ——— Email auth (local MongoDB, no Supabase) ———

router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const exists = await User.exists({ email: String(email).toLowerCase().trim() });
    res.json({ exists: !!exists });
  } catch (err) {
    console.error('check-email error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    // Don't leak whether email exists; silently succeed for unknown emails
    if (!user || user.email_verified) {
      return res.json({ message: 'If that email is pending verification, a new link has been sent.' });
    }
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await User.updateOne({ _id: user._id }, { email_verify_token: verifyToken });
    try {
      await sendVerificationEmail(normalizedEmail, verifyToken);
    } catch (emailErr) {
      console.error('[resend-verification] send failed:', emailErr);
    }
    res.json({ message: 'Verification email sent. Check your inbox.' });
  } catch (err) {
    console.error('resend-verification error:', err);
    res.status(500).json({ error: 'Failed to resend' });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(String(password), 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const userId = `usr_${crypto.randomUUID()}`;

    const user = await User.create({
      _id: userId,
      email: normalizedEmail,
      password_hash,
      email_verified: !REQUIRE_EMAIL_VERIFICATION,
      email_verify_token: REQUIRE_EMAIL_VERIFICATION ? verifyToken : undefined,
      secure_upload_enabled: false,
      first_name: firstName || normalizedEmail.split('@')[0],
      last_name: lastName || undefined,
    });

    if (REQUIRE_EMAIL_VERIFICATION) {
      try {
        await sendVerificationEmail(normalizedEmail, verifyToken);
      } catch (emailErr) {
        console.error('[email-verify] send failed:', emailErr);
        // Don't block signup — user can request resend later
      }
      return res.status(201).json({
        message: 'Account created. Check your email to verify your address.',
        verifyToken: process.env.NODE_ENV === 'development' ? verifyToken : undefined,
      });
    }

    const { token, user: u } = await issueTokenForUser(user);
    return res.status(201).json({ token, user: u });
  } catch (err) {
    console.error('signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user?.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before signing in' });
    }

    // Re-embed the stored Telegram session so secure upload works after re-login
    const { token, user: u } = await issueTokenForUser(user, user.telegram_session);
    res.json({ token, user: u });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Magic link sign-in: email-only login flow.
// 1) Client calls POST /magic-link/request with { email } — backend mails a one-time link.
// 2) User clicks link → frontend /magic-link?token=X → calls GET /magic-link/verify → JWT returned.
router.post('/magic-link/request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    // Always return generic success to not leak whether email exists.
    if (!user) {
      return res.json({ message: 'If that email is registered, a sign-in link is on its way.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min TTL
    await User.updateOne(
      { _id: user._id },
      { $set: { magic_link_token: token, magic_link_expires_at: expiresAt } }
    );
    try {
      await sendMagicLinkEmail(normalizedEmail, token);
    } catch (emailErr) {
      console.error('[magic-link] send failed:', emailErr);
    }
    res.json({ message: 'If that email is registered, a sign-in link is on its way.' });
  } catch (err) {
    console.error('magic-link/request error:', err);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

router.get('/magic-link/verify', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const user = await User.findOne({ magic_link_token: token });
    if (!user) return res.status(400).json({ error: 'Invalid or expired sign-in link' });
    if (!user.magic_link_expires_at || user.magic_link_expires_at.getTime() < Date.now()) {
      return res.status(400).json({ error: 'This sign-in link has expired. Request a new one.' });
    }
    // Consume the token. Also auto-verify email if not yet — magic link click proves email ownership.
    await User.updateOne(
      { _id: user._id },
      {
        $set: { email_verified: true },
        $unset: { magic_link_token: 1, magic_link_expires_at: 1 },
      }
    );
    const refreshed = await User.findById(user._id);
    const { token: jwtToken, user: u } = await issueTokenForUser(refreshed!, refreshed?.telegram_session);
    res.json({ success: true, token: jwtToken, user: u });
  } catch (err) {
    console.error('magic-link/verify error:', err);
    res.status(500).json({ error: 'Magic link verification failed' });
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).json({ error: 'Missing verification token' });
    }

    const user = await User.findOne({ email_verify_token: token });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { email_verified: true }, $unset: { email_verify_token: 1 } }
    );

    const { token: jwt, user: u } = await issueTokenForUser(user);
    res.json({ success: true, token: jwt, user: u });
  } catch (err) {
    console.error('verify-email error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ——— Secure Upload preference ———

router.patch('/secure-upload', async (req, res) => {
  try {
    const auth = extractAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const user = await User.findById(auth.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (enabled && (!user.telegram_id || !user.channel_id)) {
      return res.status(400).json({
        error: 'Link your Telegram account to enable Secure Upload',
        code: 'telegram_link_required',
      });
    }

    await User.updateOne({ _id: user._id }, { secure_upload_enabled: enabled });
    const updated = await User.findById(user._id);
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Prefer session from current JWT; fall back to persisted session in DB
    const sessionToUse = auth.session || updated.telegram_session;
    const { token, user: u } = await issueTokenForUser(updated, sessionToUse);
    res.json({
      secure_upload_enabled: enabled,
      user: u,
      token,
    });
  } catch (err) {
    console.error('secure-upload patch error:', err);
    res.status(500).json({ error: 'Failed to update preference' });
  }
});

// ——— Link Telegram (for Secure Upload) ———

router.post('/link-telegram/sendCode', async (req, res) => {
  try {
    const auth = extractAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const client = createTelegramClient();
    await client.connect();

    const result = (await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: TG_API_ID,
        apiHash: TG_API_HASH,
        settings: new Api.CodeSettings({
          allowFlashcall: true,
          currentNumber: true,
          allowAppHash: true,
        }),
      })
    )) as any;

    const sessionStr = (client.session as StringSession).save();
    const tempToken = jwt.sign(
      { session: sessionStr, linkUserId: auth.id },
      TEMP_TOKEN_SECRET,
      { expiresIn: '10m' }
    );

    await client.disconnect();

    res.json({
      phoneCodeHash: result.phoneCodeHash,
      timeout: result.timeout || 60,
      tempToken,
    });
  } catch (err: any) {
    console.error('link sendCode error:', err);
    if (err.errorMessage === 'PHONE_NUMBER_INVALID') {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    res.status(500).json({ error: err.errorMessage || 'Failed to send code' });
  }
});

router.post('/link-telegram/verify', async (req, res) => {
  try {
    const auth = extractAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { phoneNumber, phoneCode, phoneCodeHash, password, tempToken } = req.body;
    if (!tempToken) {
      return res.status(400).json({ error: 'Missing tempToken' });
    }

    let decoded: { session: string; linkUserId: string };
    try {
      decoded = jwt.verify(tempToken, TEMP_TOKEN_SECRET) as { session: string; linkUserId: string };
    } catch {
      return res.status(401).json({ error: 'Expired or invalid temp token' });
    }

    if (decoded.linkUserId !== auth.id) {
      return res.status(403).json({ error: 'Token does not match current user' });
    }

    const client = createTelegramClient(decoded.session);
    await client.connect();

    let userAuth: any;

    if (password) {
      const passwordData = await client.invoke(new Api.account.GetPassword());
      const srp = await computeCheck(passwordData, password);
      const signIn = await client.invoke(new Api.auth.CheckPassword({ password: srp }));
      userAuth = (signIn as any).user;
    } else {
      if (!phoneNumber || !phoneCode || !phoneCodeHash) {
        return res.status(400).json({ error: 'phoneNumber, phoneCode, and phoneCodeHash are required' });
      }
      try {
        const signIn = await client.invoke(
          new Api.auth.SignIn({ phoneNumber, phoneCode, phoneCodeHash })
        );
        userAuth = (signIn as any).user;
      } catch (err: any) {
        if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          const sessionStr = (client.session as StringSession).save();
          const twoFAToken = jwt.sign(
            { session: sessionStr, linkUserId: auth.id },
            TEMP_TOKEN_SECRET,
            { expiresIn: '10m' }
          );
          await client.disconnect();
          return res.json({ requiresPassword: true, tempToken: twoFAToken });
        }
        if (err.errorMessage === 'PHONE_CODE_INVALID') {
          await client.disconnect();
          return res.status(400).json({ error: 'Invalid verification code' });
        }
        throw err;
      }
    }

    if (!userAuth) {
      await client.disconnect();
      return res.status(400).json({ error: 'Telegram verification failed' });
    }

    const telegramId =
      typeof userAuth.id === 'bigint' ? Number(userAuth.id) : Number(userAuth.id);

    const other = await User.findOne({ telegram_id: telegramId, _id: { $ne: auth.id } });
    if (other) {
      await client.disconnect();
      return res.status(409).json({ error: 'This Telegram account is already linked elsewhere' });
    }

    let channelId: number | undefined;
    const existing = await User.findById(auth.id);
    channelId = existing?.channel_id;

    if (!channelId) {
      try {
        channelId = await createDriveChannel(client);
      } catch (channelErr) {
        console.error('Failed to create VoidBox Drive channel:', channelErr);
      }
    }

    const sessionStr = (client.session as StringSession).save();

    // Download profile photo via gramjs (most reliable — works for all accounts)
    let photoDataUrl: string | undefined;
    try {
      const photoBuffer = await client.downloadProfilePhoto(userAuth) as Buffer | null | undefined;
      if (photoBuffer && photoBuffer.length > 0) {
        photoDataUrl = `data:image/jpeg;base64,${photoBuffer.toString('base64')}`;
      }
    } catch (photoErr) {
      console.warn('[telegram-link] profile photo download failed:', photoErr);
    }

    await client.disconnect();

    const userUpdateFields: Record<string, any> = {
      telegram_id: telegramId,
      channel_id: channelId,
      telegram_session: sessionStr,  // Persist session so re-login still enables secure upload
    };
    if (userAuth.username) userUpdateFields.username = userAuth.username;
    if (photoDataUrl) userUpdateFields.photo_url = photoDataUrl;

    await User.updateOne({ _id: auth.id }, userUpdateFields);

    const user = await User.findById(auth.id);
    const { token, user: u } = await issueTokenForUser(user!, sessionStr);
    res.json({ token, user: u });
  } catch (err: any) {
    console.error('link verify error:', err);
    res.status(500).json({ error: err.errorMessage || 'Failed to link Telegram' });
  }
});

router.post('/sendCode', (_req, res) => {
  res.status(400).json({
    error: 'Sign in with email first, then enable Secure Upload to link Telegram',
  });
});

// GET /auth/me
router.get('/me', async (req, res) => {
  try {
    const auth = extractAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'No token provided' });
    }

    let user = await User.findById(auth.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Case B: JWT has no session but DB has one (user logged out and back in before migration).
    //         Issue a refreshed token with the session embedded.
    if (!auth.session && user.telegram_session) {
      const { token, user: u } = await issueTokenForUser(user, user.telegram_session);
      console.log(`[me] issued refreshed token with session for ${auth.id}`);
      return res.json({ user: u, token });
    }

    // ── Lazy profile photo refresh ─────────────────────────────────────────
    const needsPhotoRefresh =
      auth.session &&
      user.telegram_id &&
      (!user.photo_url || user.photo_url.startsWith('https://t.me'));

    if (needsPhotoRefresh) {
      try {
        const client = createTelegramClient(auth.session!);
        await client.connect();
        const photoBuffer = await client.downloadProfilePhoto('me') as Buffer | null | undefined;
        await client.disconnect();
        if (photoBuffer && photoBuffer.length > 0) {
          const photoDataUrl = `data:image/jpeg;base64,${photoBuffer.toString('base64')}`;
          await User.updateOne({ _id: auth.id }, { photo_url: photoDataUrl });
          user = (await User.findById(auth.id))!;
          console.log(`[me] profile photo refreshed for ${auth.id}`);
        }
      } catch (photoErr) {
        console.warn('[me] lazy photo refresh failed:', photoErr);
      }
    }

    res.json({
      user: userResponse(user, { channel_id: auth.channel_id }),
    });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// DELETE /auth/link-telegram — unlink Telegram account
router.delete('/link-telegram', async (req, res) => {
  try {
    const auth = extractAuth(req);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });

    await User.updateOne(
      { _id: auth.id },
      {
        $unset: { telegram_id: 1, telegram_session: 1, channel_id: 1, username: 1, photo_url: 1 },
        $set: { secure_upload_enabled: false },
      }
    );

    const updated = await User.findById(auth.id);
    if (!updated) return res.status(404).json({ error: 'User not found' });

    const { token, user: u } = await issueTokenForUser(updated);
    res.json({ token, user: u });
  } catch (err) {
    console.error('unlink-telegram error:', err);
    res.status(500).json({ error: 'Failed to unlink Telegram' });
  }
});

// GET /auth/queue-status — standard upload queue depth
router.get('/queue-status', (_req, res) => {
  import('./uploadQueue.js').then(({ standardUploadQueue }) => {
    res.json(standardUploadQueue.getStats());
  });
});

export default router;

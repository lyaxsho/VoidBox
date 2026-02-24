import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { computeCheck } from 'telegram/Password.js';
import { User } from './models.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'voidbox-secret-key-change-in-production';

const TG_API_ID = parseInt(process.env.TG_API_ID || '0', 10);
const TG_API_HASH = process.env.TG_API_HASH || '';

if (!TG_API_ID || !TG_API_HASH) {
    console.warn('WARNING: TG_API_ID or TG_API_HASH not set — user session auth will not work');
}

// Helper: create a TelegramClient from a session string
function createClient(sessionStr: string = ''): TelegramClient {
    const session = new StringSession(sessionStr);
    return new TelegramClient(session, TG_API_ID, TG_API_HASH, {
        connectionRetries: 3,
    });
}

// POST /auth/sendCode — Step 1: Send OTP to phone number
router.post('/sendCode', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const client = createClient();
        await client.connect();

        const result = await client.invoke(
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
        ) as any;

        // Save session state in a temporary JWT
        const sessionStr = (client.session as StringSession).save();
        const tempToken = jwt.sign({ session: sessionStr }, JWT_SECRET, { expiresIn: '10m' });

        await client.disconnect();

        res.json({
            phoneCodeHash: result.phoneCodeHash,
            timeout: result.timeout || 60,
            tempToken,
        });
    } catch (err: any) {
        console.error('sendCode error:', err);

        // Handle specific Telegram errors
        if (err.errorMessage === 'PHONE_NUMBER_INVALID') {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }
        if (err.errorMessage === 'PHONE_NUMBER_FLOOD') {
            return res.status(429).json({ error: 'Too many attempts, try again later' });
        }

        res.status(500).json({ error: err.errorMessage || 'Failed to send code' });
    }
});

// POST /auth/login — Step 2: Verify OTP code (and optional 2FA password)
router.post('/login', async (req, res) => {
    try {
        const { phoneNumber, phoneCode, phoneCodeHash, password, tempToken } = req.body;

        if (!tempToken) {
            return res.status(400).json({ error: 'Missing tempToken from sendCode step' });
        }

        // Decode the temp token to get the session
        let decoded: { session: string };
        try {
            decoded = jwt.verify(tempToken, JWT_SECRET) as { session: string };
        } catch {
            return res.status(401).json({ error: 'Expired or invalid temp token, please resend code' });
        }

        const client = createClient(decoded.session);
        await client.connect();

        let userAuth: any;

        if (password) {
            // 2FA: verify password
            const passwordData = await client.invoke(new Api.account.GetPassword());
            const srp = await computeCheck(passwordData, password);
            const signIn = await client.invoke(new Api.auth.CheckPassword({ password: srp }));
            userAuth = (signIn as any).user;
        } else {
            // Standard OTP verification
            if (!phoneNumber || !phoneCode || !phoneCodeHash) {
                return res.status(400).json({
                    error: 'phoneNumber, phoneCode, and phoneCodeHash are required',
                });
            }

            try {
                const signIn = await client.invoke(
                    new Api.auth.SignIn({
                        phoneNumber,
                        phoneCode,
                        phoneCodeHash,
                    })
                );
                userAuth = (signIn as any).user;
            } catch (err: any) {
                if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
                    // User has 2FA enabled — tell frontend to ask for password
                    const sessionStr = (client.session as StringSession).save();
                    const twoFAToken = jwt.sign({ session: sessionStr }, JWT_SECRET, { expiresIn: '10m' });
                    await client.disconnect();
                    return res.json({
                        requiresPassword: true,
                        tempToken: twoFAToken,
                    });
                }
                if (err.errorMessage === 'PHONE_CODE_INVALID') {
                    await client.disconnect();
                    return res.status(400).json({ error: 'Invalid verification code' });
                }
                if (err.errorMessage === 'PHONE_CODE_EXPIRED') {
                    await client.disconnect();
                    return res.status(400).json({ error: 'Code expired, please resend' });
                }
                throw err;
            }
        }

        if (!userAuth) {
            await client.disconnect();
            return res.status(400).json({ error: 'Authentication failed' });
        }

        // Extract user info from Telegram
        const telegramId = typeof userAuth.id === 'bigint'
            ? Number(userAuth.id)
            : Number(userAuth.id);
        const userId = `tg_${telegramId}`;

        // Upsert user in MongoDB
        const user = await User.findOneAndUpdate(
            { telegram_id: telegramId },
            {
                _id: userId,
                telegram_id: telegramId,
                first_name: userAuth.firstName || 'User',
                last_name: userAuth.lastName || undefined,
                username: userAuth.username || undefined,
                photo_url: userAuth.photo?.photoId
                    ? `https://t.me/i/userpic/320/${userAuth.username || telegramId}.jpg`
                    : undefined,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Create VoidBox Drive channel if user doesn't have one
        let channelId = user.channel_id;
        if (!channelId) {
            try {
                const { createDriveChannel } = await import('./telegram.js');
                channelId = await createDriveChannel(client);
                await User.updateOne(
                    { _id: userId },
                    { channel_id: channelId }
                );
                console.log(`Created VoidBox Drive channel ${channelId} for user ${userId}`);
            } catch (channelErr) {
                console.error('Failed to create VoidBox Drive channel:', channelErr);
                // Continue without channel — can be created later
            }
        }

        // Save the completed session in the JWT
        const sessionStr = (client.session as StringSession).save();
        const token = jwt.sign(
            {
                id: user._id,
                telegram_id: user.telegram_id,
                session: sessionStr,
                channel_id: channelId || undefined,
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        await client.disconnect();

        res.json({
            token,
            user: {
                id: user._id,
                telegram_id: user.telegram_id,
                first_name: user.first_name,
                last_name: user.last_name,
                username: user.username,
                photo_url: user.photo_url,
                channel_id: channelId,
                created_at: user.created_at,
            },
        });
    } catch (err: any) {
        console.error('login error:', err);
        res.status(500).json({ error: err.errorMessage || 'Authentication failed' });
    }
});

// GET /auth/me — Verify token & return user
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as {
            id: string;
            telegram_id: number;
            session: string;
        };

        const user = await User.findOne({ _id: decoded.id });
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user._id,
                telegram_id: user.telegram_id,
                first_name: user.first_name,
                last_name: user.last_name,
                username: user.username,
                photo_url: user.photo_url,
                created_at: user.created_at,
            },
        });
    } catch (err) {
        console.error('Auth me error:', err);
        res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;

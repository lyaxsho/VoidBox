import './env.js'; // Must be first — loads .env before other modules
import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pkg from 'body-parser';
const { json } = pkg;
import router from './routes.js';
import authRouter from './auth.js';
import adminRouter from './admin.js';
import { connectDB } from './db.js';
import { cleanupExpiredFiles } from './cron.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy for Railway/Cloudflare
app.set('trust proxy', 1);

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(json());
app.use(fileUpload({
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  abortOnLimit: true,
}));

// Timeout for all requests: 10 min for uploads (large files), 30s for everything else
app.use((req, res, next) => {
  const timeoutMs = req.path.includes('/upload') ? 10 * 60 * 1000 : 30 * 1000;
  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) res.status(408).json({ error: 'Request timed out.' });
  });
  next();
});

// Rate limiting middleware — relaxed in development
const isDev = process.env.NODE_ENV !== 'production';
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10_000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Tighter rate limit on auth endpoints that trigger Telegram API calls
const authSensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});
app.use('/api/auth/link-telegram/sendCode', authSensitiveLimiter);
app.use('/api/auth/link-telegram/verify', authSensitiveLimiter);
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
}));

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api', router);

app.get('/', (req, res) => {
  res.send('VoidBox backend is running.');
});

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`VoidBox backend listening on port ${PORT}`);
    });
    // Run expired-file cleanup hourly
    cleanupExpiredFiles().catch(err => console.error('[cron] initial cleanup error:', err));
    setInterval(() => {
      cleanupExpiredFiles().catch(err => console.error('[cron] cleanup error:', err));
    }, 60 * 60 * 1000);
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

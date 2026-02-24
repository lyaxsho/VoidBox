import './env.js'; // Must be first — loads .env before other modules
import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pkg from 'body-parser';
const { json } = pkg;
import router from './routes.js';
import authRouter from './auth.js';
import { connectDB } from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy for Railway/Cloudflare
app.set('trust proxy', 1);

app.use(cors());
app.use(json());
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } })); // 50MB max (Telegram limit)

// Rate limiting middleware
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
}));

app.use('/api/auth', authRouter);
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
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
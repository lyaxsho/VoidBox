// This file MUST be imported first to load environment variables
// before any other modules access process.env
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env first (MONGODB_URL, BOT_TOKEN, etc.)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Load root .env second — won't overwrite existing vars (TG_API_ID, TG_API_HASH, etc.)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

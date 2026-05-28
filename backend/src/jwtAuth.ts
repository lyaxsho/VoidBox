import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import type { IUser } from './models.js';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable must be set in production');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'voidbox-dev-secret-not-for-production';
// Separate secret for short-lived temp tokens (Telegram link flow).
// Forging one requires knowing this secret AND being authenticated as the target user.
export const TEMP_TOKEN_SECRET = process.env.TEMP_TOKEN_SECRET || (JWT_SECRET + ':temp-link-flow-v1');

export interface JwtPayload {
  id: string;
  email?: string;
  secure_upload_enabled: boolean;
  is_admin?: boolean;
  telegram_linked: boolean;
  telegram_id?: number;
  session?: string;
  channel_id?: number;
}

export function buildJwtPayload(
  user: IUser,
  session?: string
): JwtPayload {
  const telegramLinked = Boolean(user.telegram_id && user.channel_id && session);
  return {
    id: user._id,
    email: user.email,
    secure_upload_enabled: Boolean(user.secure_upload_enabled),
    is_admin: user.is_admin || undefined,
    telegram_linked: telegramLinked,
    telegram_id: user.telegram_id,
    session: session || undefined,
    channel_id: user.channel_id,
  };
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function extractAuth(req: Request): JwtPayload | null {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token && typeof req.query.token === 'string') {
    token = req.query.token;
  }
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function userResponse(user: IUser, extra?: { channel_id?: number }) {
  return {
    id: user._id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    photo_url: user.photo_url,
    email_verified: user.email_verified,
    secure_upload_enabled: Boolean(user.secure_upload_enabled),
    is_admin: user.is_admin || false,
    telegram_linked: Boolean(user.telegram_id && user.channel_id),
    telegram_id: user.telegram_id,
    channel_id: extra?.channel_id ?? user.channel_id,
    created_at: user.created_at,
  };
}

export function usesSecureStorage(auth: JwtPayload, user?: IUser | null): boolean {
  const enabled = user?.secure_upload_enabled ?? auth.secure_upload_enabled;
  if (!enabled) return false;
  if (!auth.session || !auth.channel_id) return false;
  if (user && !user.telegram_id) return false;
  return true;
}

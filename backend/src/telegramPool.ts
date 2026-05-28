import crypto from 'crypto';
import type { TelegramClient } from 'telegram';
import { createClient } from './telegram.js';

const IDLE_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface PoolEntry {
  client: TelegramClient;
  lastUsed: number;
  connectPromise: Promise<unknown> | null;
}

const pool = new Map<string, PoolEntry>();

function poolKey(sessionStr: string): string {
  return crypto.createHash('sha256').update(sessionStr).digest('hex').slice(0, 32);
}

async function ensureConnected(entry: PoolEntry): Promise<void> {
  if ((entry.client as any)._sender) {
    return;
  }
  if (!entry.connectPromise) {
    entry.connectPromise = entry.client.connect().then(() => undefined).finally(() => {
      entry.connectPromise = null;
    });
  }
  await entry.connectPromise;
}

/** Reuse a connected GramJS client for the given session string. */
export async function acquireClient(sessionStr: string): Promise<TelegramClient> {
  const key = poolKey(sessionStr);
  let entry = pool.get(key);
  if (!entry) {
    entry = {
      client: createClient(sessionStr),
      lastUsed: Date.now(),
      connectPromise: null,
    };
    pool.set(key, entry);
  }
  entry.lastUsed = Date.now();
  await ensureConnected(entry);
  return entry.client;
}

/** Mark session as recently used (connection stays open). */
export function releaseClient(sessionStr: string): void {
  const key = poolKey(sessionStr);
  const entry = pool.get(key);
  if (entry) {
    entry.lastUsed = Date.now();
  }
}

/** Drop pooled connection after auth failures. */
export async function invalidateClient(sessionStr: string): Promise<void> {
  const key = poolKey(sessionStr);
  const entry = pool.get(key);
  if (!entry) return;
  pool.delete(key);
  try {
    await entry.client.disconnect();
  } catch {
    // ignore
  }
}

function cleanupIdleClients(): void {
  const now = Date.now();
  for (const [key, entry] of pool.entries()) {
    if (now - entry.lastUsed > IDLE_MS) {
      pool.delete(key);
      entry.client.disconnect().catch(() => {});
    }
  }
}

setInterval(cleanupIdleClients, CLEANUP_INTERVAL_MS).unref();

import { BASE_URL, getFileInfo } from './api';

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> { value: T; expiresAt: number }

const fileInfoCache = new Map<string, CacheEntry<any>>();
const noteContentCache = new Map<string, CacheEntry<string>>();
const zipListCache = new Map<string, CacheEntry<string[]>>();

function getEntry<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

function setEntry<T>(map: Map<string, CacheEntry<T>>, key: string, value: T): void {
  map.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function peekFileInfo(slug: string): any | null {
  return getEntry(fileInfoCache, slug);
}

export function peekNoteContent(slug: string): string | null {
  return getEntry(noteContentCache, slug);
}

export function peekZipList(slug: string): string[] | null {
  return getEntry(zipListCache, slug);
}

export async function getCachedFileInfo(slug: string): Promise<any> {
  const hit = getEntry(fileInfoCache, slug);
  if (hit) return hit;
  const info = await getFileInfo(slug);
  setEntry(fileInfoCache, slug, info);
  return info;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('voidbox_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getCachedNoteContent(slug: string): Promise<string> {
  const hit = getEntry(noteContentCache, slug);
  if (hit !== null) return hit;
  const res = await fetch(`${BASE_URL}/note-content/${slug}`, { headers: authHeaders() });
  const text = await res.text();
  setEntry(noteContentCache, slug, text);
  return text;
}

export async function getCachedZipList(slug: string): Promise<string[]> {
  const hit = getEntry(zipListCache, slug);
  if (hit) return hit;
  const res = await fetch(`${BASE_URL}/zip-list/${slug}`, { headers: authHeaders() });
  const data = await res.json();
  const files: string[] = data.files || [];
  setEntry(zipListCache, slug, files);
  return files;
}

export function invalidatePreviewCache(slug: string): void {
  fileInfoCache.delete(slug);
  noteContentCache.delete(slug);
  zipListCache.delete(slug);
}

export function clearAllPreviewCache(): void {
  fileInfoCache.clear();
  noteContentCache.clear();
  zipListCache.clear();
}

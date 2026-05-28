export const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api';

/**
 * Share or copy a link. On devices with the Web Share API (mostly mobile), opens the native share sheet.
 * Otherwise falls back to clipboard copy. Returns 'shared' | 'copied' | 'cancelled' | 'failed'.
 */
export async function shareOrCopy(opts: { title?: string; text?: string; url: string }): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const canShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
  // Heuristic: only use native share on touch/mobile devices; desktops with share API still prefer clipboard.
  const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches && 'ontouchstart' in window)
  );
  if (canShare && isMobile) {
    try {
      await (navigator as any).share(opts);
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled';
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(opts.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export async function generateThumbnail(file: File): Promise<string | undefined> {
  const MAX = 480;
  try {
    if (file.type.startsWith('image/')) {
      return await new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
        img.src = url;
      });
    }
    if (file.type.startsWith('video/')) {
      return await new Promise((resolve) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        const url = URL.createObjectURL(file);
        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1, video.duration * 0.1);
        };
        video.onseeked = () => {
          const ratio = Math.min(MAX / video.videoWidth, MAX / video.videoHeight, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(video.videoWidth * ratio);
          canvas.height = Math.round(video.videoHeight * ratio);
          canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        video.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
        video.src = url;
      });
    }
  } catch {
    // thumbnail generation is best-effort
  }
  return undefined;
}

export interface UploadResponse {
  slug: string;
  file: {
    name: string;
    size: number;
    mimetype: string;
    created_at: string;
    download_count: number;
    expiry_at: string | null;
  };
}

export async function uploadFile(
  file: File,
  options?: {
    expiry_at?: string;
    expiry_days?: number;
    user_id?: string;
    upload_id?: string;
    thumbnail?: string;
    onProgress?: (progress: number, loaded: number, total: number) => void;
    signal?: AbortSignal;
  }
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.expiry_at) formData.append('expiry_at', options.expiry_at);
    if (options?.expiry_days) formData.append('expiry_days', String(options.expiry_days));
    if (options?.user_id) formData.append('user_id', options.user_id);
    if (options?.upload_id) formData.append('upload_id', options.upload_id);
    if (options?.thumbnail) formData.append('thumbnail', options.thumbnail);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && options?.onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        options.onProgress(progress, e.loaded, e.total);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch {
          reject(new Error('Invalid response'));
        }
      } else {
        try {
          const errBody = JSON.parse(xhr.responseText);
          const err = new Error(errBody.error || `Upload failed: ${xhr.status}`);
          (err as any).code = errBody.code;
          (err as any).status = xhr.status;
          reject(err);
        } catch {
          const err = new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`);
          (err as any).status = xhr.status;
          reject(err);
        }
      }
    });

    xhr.addEventListener('error', () => {
      const err = new Error('Upload failed: Network error');
      (err as any).isNetworkError = true;
      reject(err);
    });

    xhr.open('POST', `${BASE_URL}/upload`);
    const token = localStorage.getItem('voidbox_token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    if (options?.signal) {
      if (options.signal.aborted) {
        const err: any = new Error('Upload cancelled');
        err.isAbort = true;
        return reject(err);
      }
      options.signal.addEventListener('abort', () => {
        try { xhr.abort(); } catch {}
        const err: any = new Error('Upload cancelled');
        err.isAbort = true;
        reject(err);
      });
    }
    xhr.send(formData);
  });
}

function isTransientUploadError(err: any): boolean {
  if (err?.isAbort) return false;
  if (err?.isNetworkError) return true;
  const status = err?.status;
  if (typeof status === 'number' && status >= 500 && status < 600) return true;
  if (status === 408 || status === 429) return true;
  return false;
}

export async function uploadFileWithRetry(
  file: File,
  options: Parameters<typeof uploadFile>[1] & { maxRetries?: number; onRetry?: (attempt: number, err: any) => void } = {}
): Promise<UploadResponse> {
  const { maxRetries = 2, onRetry, ...rest } = options;
  let attempt = 0;
  let lastErr: any;
  while (attempt <= maxRetries) {
    try {
      return await uploadFile(file, rest);
    } catch (err: any) {
      lastErr = err;
      if (attempt >= maxRetries || !isTransientUploadError(err)) throw err;
      const delay = 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      onRetry?.(attempt + 1, err);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
  throw lastErr;
}

export async function getFileInfo(slug: string) {
  const res = await fetch(`${BASE_URL}/file/${slug}`);
  if (!res.ok) throw new Error('File not found');
  return res.json();
}

export function getDownloadUrl(slug: string) {
  const token = localStorage.getItem('voidbox_token');
  const url = `${BASE_URL}/download/${slug}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

function downloadAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('voidbox_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Instant native save dialog via hidden iframe (Chrome download manager). */
export function triggerNativeDownload(slug: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = getDownloadUrl(slug);
  document.body.appendChild(iframe);
  setTimeout(() => {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }, 10000);
}

/**
 * Track download progress for UI only (discards body; runs parallel to native iframe download).
 * Resolves when the server has finished streaming the file.
 */
export async function trackDownloadProgress(
  slug: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const url = getDownloadUrl(slug);
  const res = await fetch(url, { headers: downloadAuthHeaders() });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  if (!res.body) throw new Error('No response body');

  const total = Number(res.headers.get('Content-Length')) || 0;
  const reader = res.body.getReader();
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.length;
    if (onProgress) {
      onProgress(
        total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
      );
    }
  }
  if (onProgress) onProgress(100);
}

export async function flagFile({ slug, file_id, reason }: { slug?: string; file_id?: string; reason: string }) {
  const res = await fetch(`${BASE_URL}/flag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, file_id, reason }),
  });
  if (!res.ok) throw new Error('Flag failed');
  return res.json();
}

export async function uploadNote(title: string, content: string, options?: { expiry_at?: string; expiry_days?: number; user_id?: string }) {
  const formData = new FormData();
  // Format note: bold title if present, then content
  let noteText = '';
  let filename = 'note.txt';
  if (title) {
    noteText = `${title.toUpperCase()}\n${'='.repeat(Math.max(4, title.length))}\n\n${content}`;
    filename = `${title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32)}.txt`;
  } else {
    noteText = content;
  }
  const blob = new Blob([noteText], { type: 'text/plain' });
  formData.append('file', blob, filename);
  if (options?.expiry_at) formData.append('expiry_at', options.expiry_at);
  if (options?.expiry_days) formData.append('expiry_days', String(options.expiry_days));
  if (options?.user_id) formData.append('user_id', options.user_id);
  formData.append('is_note', 'true');
  const token = localStorage.getItem('voidbox_token');
  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error('Note upload failed');
  return res.json() as Promise<UploadResponse>;
} 
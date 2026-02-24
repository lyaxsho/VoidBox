export const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000/api';

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
    onProgress?: (progress: number) => void;
  }
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.expiry_at) formData.append('expiry_at', options.expiry_at);
    if (options?.expiry_days) formData.append('expiry_days', String(options.expiry_days));
    if (options?.user_id) formData.append('user_id', options.user_id);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && options?.onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        options.onProgress(progress);
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
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed: Network error'));
    });

    xhr.open('POST', `${BASE_URL}/upload`);
    const token = localStorage.getItem('voidbox_token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
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
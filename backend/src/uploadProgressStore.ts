export interface UploadProgressEntry {
  totalBytes: number;
  processedBytes: number;
  totalChunks: number;
  processedChunks: number;
  done: boolean;
}

const store = new Map<string, UploadProgressEntry>();

export function initUploadProgress(
  uploadId: string,
  totalBytes: number,
  totalChunks: number
): void {
  store.set(uploadId, {
    totalBytes,
    processedBytes: 0,
    totalChunks,
    processedChunks: 0,
    done: false,
  });
  // Auto-clean after 3 hours in case client never polls (2GB uploads can take a while)
  setTimeout(() => store.delete(uploadId), 3 * 60 * 60 * 1000);
}

export function updateUploadProgress(uploadId: string, chunkBytes: number): void {
  const entry = store.get(uploadId);
  if (!entry) return;
  entry.processedBytes += chunkBytes;
  entry.processedChunks += 1;
}

export function markUploadDone(uploadId: string): void {
  const entry = store.get(uploadId);
  if (entry) entry.done = true;
}

export function getUploadProgress(uploadId: string): UploadProgressEntry | null {
  return store.get(uploadId) ?? null;
}

import { sendFileToSharedChannel, isStandardStorageConfigured } from './telegramBot.js';
import { standardUploadQueue } from './uploadQueue.js';
import type { TelegramFileInfo } from './types.js';

/**
 * Telegram Bot API getFile() endpoint only supports files ≤ 20 MB for download.
 * Keep chunks under 19 MB so every chunk can be retrieved via getFile.
 */
export const STANDARD_CHUNK_SIZE = 19 * 1024 * 1024;

/** Total file size limit for standard uploads. */
export const STANDARD_MAX_BYTES = 2 * 1024 * 1024 * 1024;

export function assertStandardAvailable() {
  if (!isStandardStorageConfigured()) {
    throw new Error(
      'Standard uploads are unavailable. Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID.'
    );
  }
}

/** Upload a single file (must be < STANDARD_CHUNK_SIZE) via the shared bot queue. */
export async function uploadViaStandardQueue(
  data: Buffer,
  filename: string,
  mimetype: string
): Promise<TelegramFileInfo> {
  assertStandardAvailable();
  return standardUploadQueue.enqueue(() =>
    sendFileToSharedChannel(data, filename, mimetype)
  );
}

/**
 * Upload a large file in STANDARD_CHUNK_SIZE pieces via the bot queue.
 * Calls onChunk after each chunk is successfully stored in Telegram.
 */
export async function uploadChunkedViaQueue(
  data: Buffer,
  filename: string,
  onChunk: (chunkIndex: number, totalChunks: number, tgInfo: TelegramFileInfo) => Promise<void>
): Promise<void> {
  assertStandardAvailable();
  const totalChunks = Math.ceil(data.length / STANDARD_CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * STANDARD_CHUNK_SIZE;
    const chunk = data.slice(start, start + STANDARD_CHUNK_SIZE);
    const chunkFilename = `chunk_${i}_${filename}`;
    const tgInfo = await standardUploadQueue.enqueue(() =>
      sendFileToSharedChannel(chunk, chunkFilename, 'application/octet-stream')
    );
    await onChunk(i, totalChunks, tgInfo);
  }
}

export { standardUploadQueue };

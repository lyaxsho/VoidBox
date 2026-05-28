import axios from 'axios';
import FormData from 'form-data';
import type { Response } from 'express';
import { TelegramFileInfo } from './types.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

const API_URL = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';

export function isStandardStorageConfigured(): boolean {
  return Boolean(BOT_TOKEN && CHANNEL_ID);
}

function assertBotConfigured() {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    throw new Error('Standard storage is not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID)');
  }
}

export async function sendFileToSharedChannel(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<TelegramFileInfo> {
  assertBotConfigured();

  const formData = new FormData();
  formData.append('chat_id', CHANNEL_ID!);

  const normalized = (mimetype || '').toLowerCase().trim();
  let endpoint = 'sendDocument';
  let fileField = 'document';

  if (normalized.startsWith('video/')) {
    endpoint = 'sendVideo';
    fileField = 'video';
  } else if (normalized.startsWith('audio/')) {
    endpoint = 'sendAudio';
    fileField = 'audio';
  } else if (normalized.startsWith('image/')) {
    endpoint = 'sendPhoto';
    fileField = 'photo';
    if (normalized === 'image/heic' || normalized === 'image/heif') {
      endpoint = 'sendDocument';
      fileField = 'document';
    }
  }

  formData.append(fileField, fileBuffer, { filename, contentType: mimetype });

  let res;
  try {
    res = await axios.post(`${API_URL}/${endpoint}`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    if (!res.data.ok) {
      throw new Error(res.data.description || 'Telegram API error');
    }
  } catch (error: unknown) {
    if (endpoint === 'sendPhoto' && normalized.startsWith('image/')) {
      const fallback = new FormData();
      fallback.append('chat_id', CHANNEL_ID!);
      fallback.append('document', fileBuffer, { filename, contentType: mimetype });
      res = await axios.post(`${API_URL}/sendDocument`, fallback, {
        headers: fallback.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      if (!res.data.ok) {
        throw new Error(res.data.description || 'Telegram API error');
      }
    } else {
      throw error;
    }
  }

  const msg = res.data.result;
  let fileObj = msg.document || msg.video || msg.audio;
  if (!fileObj && msg.photo) {
    fileObj = Array.isArray(msg.photo) ? msg.photo[msg.photo.length - 1] : msg.photo;
  }
  if (!fileObj) {
    throw new Error('Telegram API: No file object in response');
  }

  return {
    file_id: fileObj.file_id,
    message_id: String(msg.message_id),
    file_unique_id: fileObj.file_unique_id,
  };
}

export async function getBotFilePath(fileId: string): Promise<string> {
  assertBotConfigured();
  const res = await axios.get(`${API_URL}/getFile`, {
    params: { file_id: fileId },
  });
  if (!res.data.ok) {
    throw new Error(res.data.description || 'getFile failed');
  }
  return res.data.result.file_path as string;
}

export async function streamBotFileToResponse(
  fileId: string,
  res: Response,
  options: {
    mimetype: string;
    filename: string;
    inline?: boolean;
  }
): Promise<void> {
  assertBotConfigured();
  const filePath = await getBotFilePath(fileId);
  const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const tgRes = await axios.get(downloadUrl, { responseType: 'stream' });

  res.setHeader('Content-Type', options.mimetype || 'application/octet-stream');
  const disposition = options.inline ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disposition}; filename="${options.filename}"`);
  res.setHeader('Accept-Ranges', 'bytes');

  tgRes.data.pipe(res);
}

export async function downloadBotFileBuffer(fileId: string): Promise<Buffer> {
  assertBotConfigured();
  const filePath = await getBotFilePath(fileId);
  const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const tgRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
  return Buffer.from(tgRes.data);
}

export async function deleteBotMessage(messageId: string): Promise<void> {
  assertBotConfigured();
  await axios.post(`${API_URL}/deleteMessage`, {
    chat_id: CHANNEL_ID,
    message_id: messageId,
  });
}

/** Stream all chunks of a chunked file sequentially to the response. */
export async function streamChunkedBotFileToResponse(
  chunks: Array<{ telegram_file_id: string }>,
  res: Response,
  totalSize: number,
  options: { mimetype: string; filename: string; inline?: boolean }
): Promise<void> {
  assertBotConfigured();

  res.setHeader('Content-Type', options.mimetype || 'application/octet-stream');
  const disposition = options.inline ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disposition}; filename="${options.filename}"`);
  res.setHeader('Content-Length', String(totalSize));
  res.setHeader('Accept-Ranges', 'none');

  for (const chunk of chunks) {
    const filePath = await getBotFilePath(chunk.telegram_file_id);
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    const tgRes = await axios.get(downloadUrl, { responseType: 'stream' });
    await new Promise<void>((resolve, reject) => {
      tgRes.data.on('end', resolve);
      tgRes.data.on('error', reject);
      tgRes.data.pipe(res, { end: false });
    });
  }

  res.end();
}

/** Download all chunks and concatenate into a single Buffer (for notes / ZIP listing). */
export async function downloadChunkedBotFileBuffer(
  chunks: Array<{ telegram_file_id: string }>
): Promise<Buffer> {
  assertBotConfigured();
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const filePath = await getBotFilePath(chunk.telegram_file_id);
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    const tgRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    buffers.push(Buffer.from(tgRes.data));
  }
  return Buffer.concat(buffers);
}

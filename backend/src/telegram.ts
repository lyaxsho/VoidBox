import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import type { Response } from 'express';
import { TelegramFileInfo } from './types.js';
import bigInt from 'big-integer';

const TG_API_ID = parseInt(process.env.TG_API_ID || '0', 10);
const TG_API_HASH = process.env.TG_API_HASH || '';

const STREAM_CHUNK_SIZE = 512 * 1024;

export interface ByteRange {
  start: number;
  end: number;
}

export interface StreamFileOptions {
  fileSize: number;
  mimetype: string;
  filename: string;
  inline?: boolean;
  range?: ByteRange | null;
}

// Create a GramJS client from a session string
export function createClient(sessionStr: string): TelegramClient {
  const session = new StringSession(sessionStr);
  const client = new TelegramClient(session, TG_API_ID, TG_API_HASH, {
    connectionRetries: 3,
  });
  (client as any)._errorHandler = async (err: any) => {
    const msg: string = err?.message || String(err);
    if (msg.includes('TIMEOUT')) return;
    console.error('[Telegram]', msg);
  };
  return client;
}

export function parseRangeHeader(
  header: string | undefined,
  fileSize: number
): ByteRange | null {
  if (!header?.startsWith('bytes=')) return null;
  const rangeSpec = header.replace(/^bytes=/, '').split(',')[0].trim();
  const [startStr, endStr] = rangeSpec.split('-');

  let start: number;
  let end: number;

  if (startStr === '') {
    const suffixLen = parseInt(endStr, 10);
    if (isNaN(suffixLen) || suffixLen <= 0) return null;
    start = Math.max(0, fileSize - suffixLen);
    end = fileSize - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr ? parseInt(endStr, 10) : fileSize - 1;
  }

  if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= fileSize) {
    return null;
  }
  end = Math.min(end, fileSize - 1);
  return { start, end };
}

export async function getChannelMessage(
  client: TelegramClient,
  channelId: number,
  messageId: number
): Promise<Api.Message> {
  const peer = new Api.PeerChannel({ channelId: bigInt(channelId) });
  const inputPeer = await client.getInputEntity(peer);

  const result = await client.invoke(
    new Api.channels.GetMessages({
      channel: inputPeer as any,
      id: [new Api.InputMessageID({ id: messageId })],
    })
  );

  const messages = (result as any).messages;
  if (!messages?.length) {
    throw new Error('Message not found');
  }

  const message = messages[0];
  if (!message.media) {
    throw new Error('Message has no media');
  }

  return message;
}

// Create VoidBox Drive channel for a user — returns the channel ID
export async function createDriveChannel(client: TelegramClient): Promise<number> {
  const result = await client.invoke(
    new Api.channels.CreateChannel({
      title: 'VoidBox Drive',
      about: 'Personal cloud storage powered by VoidBox',
      megagroup: false,
    })
  );

  const updates = result as any;
  const channel = updates.chats?.[0];
  if (!channel?.id) {
    throw new Error('Failed to create channel');
  }

  return typeof channel.id === 'bigint' ? Number(channel.id) : Number(channel.id);
}

// Upload a file to the user's channel
export async function sendFileToChannel(
  client: TelegramClient,
  channelId: number,
  fileBuffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<TelegramFileInfo> {
  const peer = new Api.PeerChannel({ channelId: bigInt(channelId) });
  const inputPeer = await client.getInputEntity(peer);

  const { CustomFile } = await import('telegram/client/uploads.js');
  const os = await import('os');
  const fs = await import('fs');
  const pathMod = await import('path');
  const tmpPath = pathMod.default.join(
    os.default.tmpdir(),
    `voidbox_upload_${Date.now()}_${filename}`
  );

  let customFile: InstanceType<typeof CustomFile>;
  try {
    fs.writeFileSync(tmpPath, fileBuffer);
    customFile = new CustomFile(filename, fileBuffer.length, tmpPath);
  } catch {
    customFile = new CustomFile(filename, fileBuffer.length, '', fileBuffer);
  }

  let result: any;
  try {
    result = await client.sendFile(inputPeer, {
      file: customFile,
      forceDocument: true,
    });
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }

  const messageId = result?.id || result?.message?.id;
  const media = result?.media;
  let fileId = '';
  let fileUniqueId = '';

  if (media?.photo) {
    fileId = String(media.photo.id);
    fileUniqueId = String(media.photo.id);
  } else if (media?.document) {
    fileId = String(media.document.id);
    fileUniqueId = String(media.document.id);
  }

  return {
    file_id: fileId,
    message_id: String(messageId),
    file_unique_id: fileUniqueId,
  };
}

/** Stream file bytes to an HTTP response (supports Range for video seek). */
export async function streamFileToResponse(
  client: TelegramClient,
  channelId: number,
  messageId: number,
  res: Response,
  options: StreamFileOptions
): Promise<void> {
  const message = await getChannelMessage(client, channelId, messageId);
  const { fileSize, mimetype, filename, inline, range } = options;

  const start = range?.start ?? 0;
  const end = range?.end ?? fileSize - 1;
  const contentLength = end - start + 1;

  const disposition = inline ? 'inline' : 'attachment';
  const safeName = filename.replace(/[^\x20-\x7E]/g, '_');

  res.setHeader('Content-Type', mimetype || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);

  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', String(contentLength));
  } else {
    res.setHeader('Content-Length', String(fileSize));
  }

  let aborted = false;
  const onClose = () => {
    aborted = true;
  };
  res.on('close', onClose);

  try {
    let bytesSent = 0;
    const iter = client.iterDownload({
      file: message.media!,
      offset: bigInt(start),
      requestSize: STREAM_CHUNK_SIZE,
      fileSize: bigInt(fileSize),
    });

    for await (const chunk of iter) {
      if (aborted) break;

      let slice: Buffer = chunk;
      const remaining = contentLength - bytesSent;
      if (slice.length > remaining) {
        slice = slice.subarray(0, remaining);
      }

      if (slice.length === 0) break;

      if (!res.write(slice)) {
        await new Promise<void>((resolve) => res.once('drain', resolve));
      }
      bytesSent += slice.length;

      if (bytesSent >= contentLength) break;
    }

    if (!aborted) {
      res.end();
    }
  } finally {
    res.off('close', onClose);
  }
}

/** Download full file into memory (ZIP listing, small notes). */
export async function downloadFile(
  client: TelegramClient,
  channelId: number,
  messageId: number,
): Promise<Buffer> {
  const message = await getChannelMessage(client, channelId, messageId);
  const buffer = (await client.downloadMedia(message, {})) as Buffer;
  if (!buffer) {
    throw new Error('Failed to download file');
  }
  return buffer;
}

// Delete a message from the user's channel
export async function deleteMessage(
  client: TelegramClient,
  channelId: number,
  messageId: number,
): Promise<boolean> {
  const peer = new Api.PeerChannel({ channelId: bigInt(channelId) });
  const inputPeer = await client.getInputEntity(peer);

  await client.invoke(
    new Api.channels.DeleteMessages({
      channel: inputPeer as any,
      id: [messageId],
    })
  );

  return true;
}

export function isSessionAuthError(message: string): boolean {
  return (
    message.includes('AUTH_KEY') ||
    message.includes('SESSION') ||
    message.includes('Unauthorized')
  );
}

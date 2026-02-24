import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { TelegramFileInfo } from './types.js';
import bigInt from 'big-integer';

const TG_API_ID = parseInt(process.env.TG_API_ID || '0', 10);
const TG_API_HASH = process.env.TG_API_HASH || '';

// Create a GramJS client from a session string
export function createClient(sessionStr: string): TelegramClient {
  const session = new StringSession(sessionStr);
  const client = new TelegramClient(session, TG_API_ID, TG_API_HASH, {
    connectionRetries: 3,
  });
  // Suppress noisy TIMEOUT errors from the update loop.
  // _updateLoop is a standalone function — we can't override it on the instance.
  // Instead, intercept errors via _errorHandler so they never reach console.error.
  (client as any)._errorHandler = async (err: any) => {
    const msg: string = err?.message || String(err);
    if (msg.includes('TIMEOUT')) return; // silently swallow ping timeouts
    console.error('[Telegram]', msg);
  };
  return client;
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
  if (!channel || !channel.id) {
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

  // Use client.sendFile with CustomFile wrapper
  const { CustomFile } = await import('telegram/client/uploads.js');

  // For large files (>20MB), gramJS tries to use filePath instead of buffer.
  // Write to a temp file to avoid "buffer or filePath should be specified" error.
  const os = await import('os');
  const fs = await import('fs');
  const pathMod = await import('path');
  const tmpPath = pathMod.default.join(os.default.tmpdir(), `voidbox_upload_${Date.now()}_${filename}`);

  let customFile: InstanceType<typeof CustomFile>;
  try {
    fs.writeFileSync(tmpPath, fileBuffer);
    customFile = new CustomFile(filename, fileBuffer.length, tmpPath);
  } catch {
    // Fallback: try with buffer directly
    customFile = new CustomFile(filename, fileBuffer.length, '', fileBuffer);
  }

  let result: any;
  try {
    result = await client.sendFile(inputPeer, {
      file: customFile,
      forceDocument: true,
    });
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpPath); } catch { }
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

// Download a file from the user's channel
export async function downloadFile(
  client: TelegramClient,
  channelId: number,
  messageId: number,
): Promise<Buffer> {
  const peer = new Api.PeerChannel({ channelId: bigInt(channelId) });
  const inputPeer = await client.getInputEntity(peer);

  // Get the message containing the file
  const result = await client.invoke(
    new Api.channels.GetMessages({
      channel: inputPeer as any,
      id: [new Api.InputMessageID({ id: messageId })],
    })
  );

  const messages = (result as any).messages;
  if (!messages || messages.length === 0) {
    throw new Error('Message not found');
  }

  const message = messages[0];
  if (!message.media) {
    throw new Error('Message has no media');
  }

  const buffer = await client.downloadMedia(message, {}) as Buffer;
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
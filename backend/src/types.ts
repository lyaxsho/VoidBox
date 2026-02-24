export interface FileMeta {
  id: string;
  name: string;
  size: number;
  mimetype: string;
  slug: string;
  uploader_ip: string;
  created_at: string;
  telegram_file_id: string;
  telegram_message_id: string;
  download_count: number;
  expiry_at?: string | null;
}

export interface User {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  created_at: string;
}

export interface AbuseFlag {
  file_id: string;
  reason: string;
  flagged_at: string;
  ip: string;
}

export interface TelegramFileInfo {
  file_id: string;
  message_id: string;
  file_unique_id?: string;
  file_path?: string;
} 
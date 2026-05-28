export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'note';
  fileType?: string;
  content?: string;
  notes?: string;
  uploadedAt: Date;
  created_at?: string;
  size?: number;
  slug?: string; // backend slug
  storage_mode?: 'standard' | 'secure';
  mimetype?: string;
  thumbnail?: string;
  expiry_at?: string | null;
}

export interface AppState {
  currentPage: string;
  files: FileItem[];
  selectedFile?: FileItem;
}

export type PageType = 'home' | 'upload' | 'text' | 'library' | 'preview' | 'policies';
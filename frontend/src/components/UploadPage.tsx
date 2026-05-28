import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, File, Film, FileText, Archive, X, Shield } from 'lucide-react';
import { PageType } from '../types';
import { uploadFileWithRetry, generateThumbnail, BASE_URL } from '../lib/api';
import type { User } from '../hooks/useAuth';
import SecureUploadGuide from './SecureUploadGuide';
import { useToast } from './Toast';

interface UploadPageProps {
  onPageChange: (page: PageType) => void;
  onFileAdd: (file: { name: string; type: 'file'; fileType: string; notes?: string; slug?: string }) => void;
  theme: 'dark' | 'light';
  user?: User | null;
  triggerLoginModal?: () => void;
  onSetSecureUpload?: (enabled: boolean) => Promise<{ error?: { message: string; code?: string } | null }>;
  onRequestLinkTelegram?: () => void;
  pendingDropFile?: File | null;
  onConsumePendingDrop?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const UploadPage: React.FC<UploadPageProps> = ({
  onPageChange,
  onFileAdd,
  theme,
  user,
  triggerLoginModal,
  onSetSecureUpload,
  onRequestLinkTelegram,
  pendingDropFile,
  onConsumePendingDrop,
}) => {
  const toast = useToast();
  const secureEnabled = Boolean(user?.secure_upload_enabled);

  type QueueStatus = 'pending' | 'uploading' | 'processing' | 'done' | 'error' | 'cancelled';
  interface QueueItem {
    id: string;
    file: File;
    status: QueueStatus;
    progress: number;
    uploadedBytes: number;
    totalBytes: number;
    uploadId: string;
    slug?: string;
    error?: string;
  }
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadId, setCurrentUploadId] = useState('');
  const [processingStats, setProcessingStats] = useState<{
    processedBytes: number; totalBytes: number;
    processedChunks: number; totalChunks: number; done: boolean;
  } | null>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expiryType, setExpiryType] = useState<'none' | 'date' | 'days'>('none');
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryDays, setExpiryDays] = useState('');

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const enqueueFiles = (files: File[]) => {
    const MAX_SIZE = 2 * 1024 * 1024 * 1024;
    const items: QueueItem[] = [];
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: exceeds 2GB limit`);
        continue;
      }
      items.push({
        id: crypto.randomUUID(),
        file,
        status: 'pending',
        progress: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        uploadId: crypto.randomUUID(),
      });
    }
    if (items.length > 0) setQueue((q) => [...q, ...items]);
  };

  const removeItem = (id: string) => {
    const item = queue.find((it) => it.id === id);
    const ac = abortControllersRef.current.get(id);
    if (ac) {
      ac.abort();
      abortControllersRef.current.delete(id);
    }
    // Mid-upload cancel: keep item in queue (marked cancelled) so the counter denominator stays stable
    if (item && (item.status === 'uploading' || item.status === 'processing')) {
      updateItem(id, { status: 'cancelled', error: 'Cancelled' });
    } else {
      setQueue((q) => q.filter((it) => it.id !== id));
    }
  };

  const clearFinished = () => {
    setQueue((q) => q.filter((it) => it.status !== 'done' && it.status !== 'cancelled'));
  };

  // Warn before leaving / closing tab during active upload
  useEffect(() => {
    if (!isUploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // legacy support — modern browsers show their own generic prompt and ignore the returnValue text
      e.returnValue = 'Upload in progress. Leave anyway?';
      return 'Upload in progress. Leave anyway?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isUploading]);

  // Consume file dropped from global overlay (ref guard prevents StrictMode double-fire)
  const consumedDropRef = useRef<File | null>(null);
  useEffect(() => {
    if (!pendingDropFile) {
      consumedDropRef.current = null;
      return;
    }
    if (pendingDropFile === consumedDropRef.current || isUploading) return;
    consumedDropRef.current = pendingDropFile;
    enqueueFiles([pendingDropFile]);
    toast.success(`Added: ${pendingDropFile.name}`);
    onConsumePendingDrop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDropFile]);

  // Paste-from-clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isUploading) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            const fileWithName = file.name && file.name !== 'image.png'
              ? file
              : new File([file], `pasted-${Date.now()}.${file.type.split('/')[1] || 'bin'}`, { type: file.type });
            pastedFiles.push(fileWithName);
          }
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        enqueueFiles(pastedFiles);
        toast.success(`Pasted ${pastedFiles.length} file${pastedFiles.length === 1 ? '' : 's'}`);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploading]);

  // Poll server-side processing for current uploading item
  useEffect(() => {
    if (!currentUploadId) return;
    const item = queue.find((it) => it.uploadId === currentUploadId);
    if (!item || item.status !== 'processing') return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`${BASE_URL}/upload-progress/${currentUploadId}`);
        if (res.ok && active) {
          const data = await res.json();
          setProcessingStats(data);
          if (data.done) active = false;
        }
      } catch {}
    };
    poll();
    const interval = setInterval(() => { if (active) poll(); }, 600);
    return () => { active = false; clearInterval(interval); };
  }, [currentUploadId, queue]);

  const fileTypeIcons = [
    { type: 'pdf', icon: File, label: 'PDF', color: 'text-red-500' },
    { type: 'video', icon: Film, label: 'Video', color: 'text-blue-500' },
    { type: 'text', icon: FileText, label: 'Text', color: 'text-green-500' },
    { type: 'archive', icon: Archive, label: 'Archive', color: 'text-purple-500' },
  ];

  const getFileType = (file: File) => {
    if (file.type.includes('pdf')) return 'pdf';
    if (file.type.includes('video')) return 'video';
    if (file.type.includes('text')) return 'text';
    if (file.type.includes('zip') || file.type.includes('rar')) return 'archive';
    return 'file';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) enqueueFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadOne = async (item: QueueItem): Promise<boolean> => {
    setCurrentUploadId(item.uploadId);
    setProcessingStats(null);
    const ac = new AbortController();
    abortControllersRef.current.set(item.id, ac);
    updateItem(item.id, { status: 'uploading', progress: 0, uploadedBytes: 0, error: undefined });
    try {
      const options: any = {
        upload_id: item.uploadId,
        signal: ac.signal,
        onProgress: (progress: number, loaded: number, total: number) => {
          updateItem(item.id, {
            progress,
            uploadedBytes: loaded,
            totalBytes: total,
            status: progress >= 100 ? 'processing' : 'uploading',
          });
        },
      };
      if (expiryType === 'date' && expiryDate) options.expiry_at = expiryDate;
      if (expiryType === 'days' && expiryDays) options.expiry_days = Number(expiryDays);
      if (user?.id) options.user_id = user.id;
      options.thumbnail = await generateThumbnail(item.file);
      const response = await uploadFileWithRetry(item.file, {
        ...options,
        maxRetries: 2,
        onRetry: (attempt, err) => {
          toast.info(`${item.file.name}: retry ${attempt}/2`);
          console.warn('Upload retry', attempt, err?.message);
        },
      });
      onFileAdd({
        name: response.file.name,
        type: 'file',
        fileType: getFileType(item.file),
        notes: notes || undefined,
        slug: response.slug,
      });
      updateItem(item.id, { status: 'done', progress: 100, slug: response.slug });
      return true;
    } catch (err: any) {
      if (err?.isAbort) {
        updateItem(item.id, { status: 'cancelled', error: 'Cancelled' });
        return false;
      }
      if (err?.code === 'telegram_link_required') {
        onRequestLinkTelegram?.();
        updateItem(item.id, { status: 'error', error: 'Telegram link required' });
        return false;
      }
      updateItem(item.id, { status: 'error', error: err?.message || 'Upload failed' });
      toast.error(`${item.file.name}: ${err?.message || 'Upload failed'}`);
      return false;
    } finally {
      abortControllersRef.current.delete(item.id);
    }
  };

  const handleUpload = async () => {
    if (!user && triggerLoginModal) {
      triggerLoginModal();
      return;
    }
    const pending = queue.filter((it) => it.status === 'pending' || it.status === 'error');
    if (pending.length === 0) return;
    setIsUploading(true);
    let successCount = 0;
    for (const item of pending) {
      // skip if removed mid-loop
      const fresh = queue.find((it) => it.id === item.id);
      if (!fresh) continue;
      const ok = await uploadOne(item);
      if (ok) successCount++;
    }
    setIsUploading(false);
    setCurrentUploadId('');
    setProcessingStats(null);
    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} file${successCount === 1 ? '' : 's'}`);
      setNotes('');
      // navigate to library after a brief delay so user sees the success state
      setTimeout(() => onPageChange('library'), 600);
    }
  };

  const handleSecureToggle = async () => {
    if (!user || !onSetSecureUpload) return;
    const next = !secureEnabled;
    if (next && !user.telegram_linked) {
      onRequestLinkTelegram?.();
      return;
    }
    const { error } = await onSetSecureUpload(next);
    if (error?.code === 'telegram_link_required') {
      onRequestLinkTelegram?.();
    } else if (error) {
      alert(error.message);
    }
  };

  const pendingCount = queue.filter((it) => it.status === 'pending' || it.status === 'error').length;
  const doneCount = queue.filter((it) => it.status === 'done').length;
  const queueEmpty = queue.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6 md:p-12 bg-white dark:bg-black"
    >
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-4xl font-light text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Upload Files
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-12">
            Drag and drop files or browse to upload.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          {queueEmpty ? (
            <div className="border-2 border-dashed rounded-2xl p-12 text-center transition-all border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Upload className="mx-auto text-gray-400 dark:text-gray-500" size={48} />
              </motion.div>
              <p className="text-gray-900 dark:text-white text-lg mb-2 mt-4">Drop files here</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">or</p>
              <motion.button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-semibold transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Browse Files
              </motion.button>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
                Tip: paste with <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-[10px]">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-[10px]">V</kbd>
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-white dark:bg-black p-4 space-y-2 transition-colors border-gray-200 dark:border-white/10" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">
                <span>
                  {queue.length} file{queue.length === 1 ? '' : 's'} in queue
                  {doneCount > 0 && ` · ${doneCount} done`}
                </span>
                <div className="flex items-center gap-2">
                  {doneCount > 0 && !isUploading && (
                    <button
                      onClick={clearFinished}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline-offset-2 hover:underline"
                    >
                      Clear finished
                    </button>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-white/10 bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {queue.map((item) => {
                  const isThis = currentUploadId === item.uploadId;
                  const statusBadge =
                    item.status === 'done' ? { text: 'Done', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' }
                    : item.status === 'error' ? { text: 'Failed', cls: 'bg-red-500/15 text-red-300 border-red-400/30' }
                    : item.status === 'cancelled' ? { text: 'Cancelled', cls: 'bg-gray-500/15 text-gray-400 border-gray-400/30' }
                    : item.status === 'processing' ? { text: 'Processing', cls: 'bg-sky-500/15 text-sky-300 border-sky-400/30' }
                    : item.status === 'uploading' ? { text: 'Uploading', cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30' }
                    : { text: 'Pending', cls: 'bg-gray-500/10 text-gray-400 border-gray-400/20' };
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      layout
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10"
                    >
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                        <File size={16} className="text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm text-gray-900 dark:text-white truncate">{item.file.name}</span>
                          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${statusBadge.cls}`}>{statusBadge.text}</span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span>
                            {item.status === 'uploading' || item.status === 'processing'
                              ? `${formatBytes(item.uploadedBytes)} / ${formatBytes(item.totalBytes)}`
                              : formatBytes(item.totalBytes)}
                          </span>
                          {(item.status === 'uploading' || item.status === 'processing') && (
                            <span>{item.status === 'processing' ? '…' : `${item.progress}%`}</span>
                          )}
                        </div>
                        {(item.status === 'uploading' || item.status === 'processing') && (
                          <div className="mt-1.5 h-1 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                            <motion.div
                              className="h-full bg-gray-900 dark:bg-white rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: item.status === 'processing' ? '100%' : `${item.progress}%` }}
                              transition={{ duration: 0.15 }}
                            />
                          </div>
                        )}
                        {item.error && item.status !== 'cancelled' && (
                          <p className="text-[11px] text-red-400 mt-1 truncate">{item.error}</p>
                        )}
                        {isThis && item.status === 'processing' && processingStats && !processingStats.done && (
                          <p className="text-[11px] text-sky-300 mt-1">
                            Chunks {processingStats.processedChunks}/{processingStats.totalChunks}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={item.status === 'done'}
                        title={item.status === 'uploading' || item.status === 'processing' ? 'Cancel & remove' : 'Remove'}
                        className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                      >
                        <X size={15} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center space-x-8 mb-8"
        >
          {fileTypeIcons.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="text-center"
              >
                <motion.div
                  className="w-12 h-12 bg-gray-100 dark:bg-gray-900 rounded-xl flex items-center justify-center mb-2"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  <Icon className={item.color} size={20} />
                </motion.div>
                <p className="text-xs text-gray-600 dark:text-gray-400 uppercase font-medium">{item.label}</p>
              </motion.div>
            );
          })}
        </motion.div>

        <SecureUploadGuide secureEnabled={secureEnabled} />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
        >
          <div className="flex items-center gap-3">
            <Shield
              size={22}
              className={secureEnabled ? 'text-emerald-500' : 'text-gray-400'}
            />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Secure Upload</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {secureEnabled ? 'Your Telegram channel' : 'Standard storage'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={secureEnabled}
            onClick={handleSecureToggle}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              secureEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                secureEnabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6 mb-8"
        >
          <div>
            <label className="block text-gray-900 dark:text-white text-sm font-medium mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this file..."
              rows={4}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:border-gray-400 dark:focus:border-gray-600 focus:outline-none resize-none transition-colors"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1 font-bold text-lg text-gray-100">Expiry</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-1 text-gray-200 text-base font-medium">
                <input type="radio" name="expiryType" value="none" checked={expiryType === 'none'} onChange={() => setExpiryType('none')} className="w-4 h-4 accent-gray-400" /> No expiry
              </label>
              <label className="flex items-center gap-1 text-gray-200 text-base font-medium">
                <input type="radio" name="expiryType" value="date" checked={expiryType === 'date'} onChange={() => setExpiryType('date')} className="w-4 h-4 accent-gray-400" /> Expiry date
              </label>
              <label className="flex items-center gap-1 text-gray-200 text-base font-medium">
                <input type="radio" name="expiryType" value="days" checked={expiryType === 'days'} onChange={() => setExpiryType('days')} className="w-4 h-4 accent-gray-400" /> Expiry in days
              </label>
            </div>
            {expiryType === 'date' && (
              <input type="date" className="border rounded px-2 py-1 bg-black text-gray-100" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            )}
            {expiryType === 'days' && (
              <input type="number" min="1" className="border rounded px-2 py-1 bg-black text-gray-100" value={expiryDays} onChange={e => setExpiryDays(e.target.value)} placeholder="Days until expiry" />
            )}
          </div>
        </motion.div>

        <motion.button
          onClick={handleUpload}
          disabled={pendingCount === 0 || isUploading}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={pendingCount === 0 || isUploading ? {} : {
            scale: 1.02,
            boxShadow: theme === 'dark'
              ? '0 0 30px rgba(255, 255, 255, 0.3)'
              : '0 0 30px rgba(0, 0, 0, 0.3)'
          }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {isUploading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>
                Uploading {queue.filter((it) => it.status !== 'pending').length} / {queue.length}…
              </span>
            </div>
          ) : pendingCount > 1 ? (
            `Upload ${pendingCount} files`
          ) : (
            'Upload Now'
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default UploadPage;
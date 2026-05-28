import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, FolderOpen, Download, Search, X, ArrowUpDown, Check, Link as LinkIcon, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { FileItem, PageType } from '../types';
import { BASE_URL, shareOrCopy } from '../lib/api';
import { useToast } from './Toast';

function formatBytes(n: number): string {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v < 10 && i > 0 ? v.toFixed(2) : v < 100 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function getExpiryInfo(expiry_at?: string | null): { label: string; tone: 'safe' | 'warn' | 'danger' | 'expired' } | null {
  if (!expiry_at) return null;
  const ms = new Date(expiry_at).getTime() - Date.now();
  if (ms <= 0) return { label: 'expired', tone: 'expired' };
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  let label = '';
  if (days >= 1) label = `${days}d`;
  else if (hours >= 1) label = `${hours}h`;
  else label = `${Math.max(1, mins)}m`;
  let tone: 'safe' | 'warn' | 'danger' = 'safe';
  if (ms < 12 * 3600_000) tone = 'danger';
  else if (ms < 48 * 3600_000) tone = 'warn';
  return { label: `expires in ${label}`, tone };
}

function getFileGlass(file: FileItem): { baseBg: string; labelColor: string; glow: string; label: string } {
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const mime = file.mimetype || '';
  if (file.type === 'note')
    return { baseBg: '#120d1e', labelColor: '#c4b5fd', glow: 'rgba(139,92,246,0.18)', label: 'NOTE' };
  if (ext === 'pdf' || mime === 'application/pdf')
    return { baseBg: '#1a0808', labelColor: '#fca5a5', glow: 'rgba(239,68,68,0.18)', label: 'PDF' };
  if (mime.startsWith('audio/') || ['mp3','wav','flac','aac','ogg','m4a'].includes(ext))
    return { baseBg: '#1a0812', labelColor: '#f9a8d4', glow: 'rgba(236,72,153,0.18)', label: ext.toUpperCase() || 'AUDIO' };
  if (mime.startsWith('video/') || ['mp4','mov','avi','mkv','webm'].includes(ext))
    return { baseBg: '#060f1e', labelColor: '#93c5fd', glow: 'rgba(59,130,246,0.18)', label: ext.toUpperCase() || 'VIDEO' };
  if (['zip','rar','tar','gz','7z','bz2'].includes(ext))
    return { baseBg: '#171005', labelColor: '#fcd34d', glow: 'rgba(245,158,11,0.18)', label: ext.toUpperCase() };
  if (['doc','docx'].includes(ext) || mime.includes('word'))
    return { baseBg: '#050e1c', labelColor: '#7dd3fc', glow: 'rgba(14,165,233,0.18)', label: ext.toUpperCase() };
  if (['xls','xlsx','csv'].includes(ext) || mime.includes('sheet'))
    return { baseBg: '#05180d', labelColor: '#6ee7b7', glow: 'rgba(16,185,129,0.18)', label: ext.toUpperCase() };
  if (['ppt','pptx'].includes(ext) || mime.includes('presentation'))
    return { baseBg: '#190d05', labelColor: '#fdba74', glow: 'rgba(249,115,22,0.18)', label: ext.toUpperCase() };
  if (['js','ts','jsx','tsx','py','go','rs','java','cpp','c','cs','rb','php','swift'].includes(ext))
    return { baseBg: '#051717', labelColor: '#67e8f9', glow: 'rgba(6,182,212,0.18)', label: ext.toUpperCase() };
  if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext) || mime.startsWith('image/'))
    return { baseBg: '#05180f', labelColor: '#5eead4', glow: 'rgba(20,184,166,0.18)', label: ext.toUpperCase() || 'IMG' };
  if (['txt','md','rtf'].includes(ext))
    return { baseBg: '#0e0f11', labelColor: '#cbd5e1', glow: 'rgba(100,116,139,0.18)', label: ext.toUpperCase() };
  return { baseBg: '#0c0d0f', labelColor: '#94a3b8', glow: 'rgba(100,116,139,0.12)', label: ext.toUpperCase() || 'FILE' };
}

interface LibraryPageProps {
  files: FileItem[];
  onPageChange: (page: PageType) => void;
  onFileSelect: (file: FileItem) => void;
  onFileDelete: (id: string) => void;
  theme: 'dark' | 'light';
  user?: any;
  triggerLoginModal?: () => void;
  fetchUserFiles: (userId: string) => Promise<void>;
  filesLoading?: boolean;
  filesFetched?: boolean;
}

const SkeletonCard: React.FC = () => (
  <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-100 dark:bg-[#0c0d0f] border border-gray-200 dark:border-white/[0.06] animate-pulse">
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-white/[0.02]" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 w-20 h-7" />
    </div>
    <div className="absolute bottom-0 left-0 right-0 px-4 py-3 space-y-2">
      <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-white/10" />
      <div className="h-2 w-1/3 rounded bg-gray-200 dark:bg-white/10" />
    </div>
  </div>
);

const LibraryPage: React.FC<LibraryPageProps> = ({
  files,
  onPageChange,
  onFileSelect,
  onFileDelete,
  theme,
  user,
  triggerLoginModal,
  fetchUserFiles,
  filesLoading,
  filesFetched
}) => {
  const toast = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse)');
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Pull-to-refresh (touch devices only, when at top of page)
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef({ startY: 0, distance: 0, pulling: false });
  const PULL_THRESHOLD = 60;
  const PULL_MAX = 120;

  useEffect(() => {
    if (!isTouch) return;
    const p = pullRef.current;
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) { p.pulling = false; return; }
      p.startY = e.touches[0].clientY;
      p.pulling = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!p.pulling) return;
      const dy = e.touches[0].clientY - p.startY;
      if (dy > 0 && window.scrollY === 0) {
        const dampened = Math.min(dy * 0.5, PULL_MAX);
        p.distance = dampened;
        setPullDistance(dampened);
      } else if (dy < 0) {
        p.pulling = false;
        p.distance = 0;
        setPullDistance(0);
      }
    };
    const onTouchEnd = async () => {
      if (!p.pulling) return;
      const dist = p.distance;
      p.pulling = false;
      p.distance = 0;
      setPullDistance(0);
      if (dist > PULL_THRESHOLD && user?.id) {
        setRefreshing(true);
        try { await fetchUserFiles(user.id); } catch {}
        setRefreshing(false);
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isTouch, user, fetchUserFiles]);

  const [filter, setFilter] = useState<'all' | 'files' | 'notes'>('all');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; file?: FileItem }>({ open: false });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelectMode = () => {
    setSelectMode((m) => {
      const next = !m;
      if (!next) setSelectedSlugs(new Set());
      return next;
    });
  };
  const toggleSelected = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };
  const selectAllVisible = (visible: FileItem[]) => {
    setSelectedSlugs(new Set(visible.map((f) => f.slug || f.id)));
  };
  const clearSelection = () => setSelectedSlugs(new Set());
  const handleBulkDelete = async () => {
    if (!user?.id || selectedSlugs.size === 0) return;
    setBulkDeleting(true);
    try {
      const token = localStorage.getItem('voidbox_token');
      const res = await fetch(`${BASE_URL}/mydrops/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ slugs: Array.from(selectedSlugs) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk delete failed');
      toast.success(`Deleted ${data.deleted} file${data.deleted === 1 ? '' : 's'}`);
      if (data.failed?.length) toast.error(`${data.failed.length} failed to delete`);
      await fetchUserFiles(user.id);
      setSelectedSlugs(new Set());
      setSelectMode(false);
      setConfirmBulkDelete(false);
    } catch (err: any) {
      toast.error(err.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  type SortKey = 'date' | 'name' | 'size' | 'type';
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 180);
    return () => clearTimeout(id);
  }, [searchInput]);

  // `/` focuses the search input (unless user is already typing somewhere)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [, setTick] = useState(0);
  useEffect(() => {
    const hasExpiring = files.some((f) => f.expiry_at);
    if (!hasExpiring) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [files]);

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sort-menu]')) setSortOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [sortOpen]);

  const getSortValue = (f: FileItem, key: SortKey): string | number => {
    if (key === 'name') return (f.name || '').toLowerCase();
    if (key === 'size') return f.size || 0;
    if (key === 'type') {
      if (f.type === 'note') return 'note';
      const ext = (f.name || '').split('.').pop()?.toLowerCase() || '';
      return ext;
    }
    return new Date(f.created_at || f.uploadedAt || 0).getTime();
  };

  const filteredFiles = files
    .filter(file => {
      if (filter === 'files' && file.type !== 'file') return false;
      if (filter === 'notes' && file.type !== 'note') return false;
      if (search && !(file.name || '').toLowerCase().includes(search)) return false;
      return true;
    })
    .sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const sortLabels: Record<SortKey, string> = { date: 'Date', name: 'Name', size: 'Size', type: 'Type' };

  const handleFileView = (file: FileItem) => {
    onFileSelect(file);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleDelete = async (file: FileItem) => {
    setConfirmDelete({ open: true, file });
  };
  const confirmDeleteFile = async () => {
    if (!user?.id || !confirmDelete.file) return;
    const token = localStorage.getItem('voidbox_token');
    await fetch(`${BASE_URL}/mydrops/${confirmDelete.file.slug}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (typeof fetchUserFiles === 'function') await fetchUserFiles(user.id);
    if (typeof onPageChange === 'function') onPageChange('library');
    setConfirmDelete({ open: false });
  };
  const cancelDelete = () => setConfirmDelete({ open: false });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6 md:p-12 bg-white dark:bg-black"
    >
      {(pullDistance > 0 || refreshing) && (
        <div
          className="lg:hidden fixed left-0 right-0 flex items-center justify-center pointer-events-none z-20"
          style={{
            top: '4rem',
            transform: `translateY(${refreshing ? 16 : Math.min(pullDistance * 0.6, 64)}px)`,
            opacity: refreshing ? 1 : Math.min(1, pullDistance / PULL_THRESHOLD),
            transition: refreshing ? 'opacity 0.2s' : 'none',
          }}
        >
          <div className="w-10 h-10 rounded-full bg-white dark:bg-[#0c0d0f] border border-gray-200 dark:border-white/10 flex items-center justify-center shadow-lg">
            <RefreshCw
              size={16}
              className={`text-gray-700 dark:text-gray-300 ${refreshing ? 'animate-spin' : ''}`}
              style={refreshing ? undefined : { transform: `rotate(${pullDistance * 3}deg)` }}
            />
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <div className="mb-6">
            <h1 className="text-4xl font-light text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              My Drops
            </h1>
            <p className="text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
              <span>{filteredFiles.length} items{filteredFiles.length !== files.length ? ` of ${files.length}` : ''}</span>
              <span className="text-gray-400 dark:text-gray-600">·</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {formatBytes(files.reduce((sum, f) => sum + (f.size || 0), 0))} of <span className="text-base leading-none">∞</span> used
              </span>
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search files... (press /)"
                className="w-full pl-11 pr-10 h-11 rounded-xl bg-gray-50 dark:bg-[#0c0d0f] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-200 dark:border-white/10 focus:border-gray-400 dark:focus:border-white/20 focus:outline-none text-sm transition-colors"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                  title="Clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectMode}
                  className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm whitespace-nowrap border transition-colors ${
                    selectMode
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white'
                      : 'bg-transparent text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                  title={selectMode ? 'Exit select mode' : 'Select multiple'}
                >
                  {selectMode ? <X size={14} /> : <CheckSquare size={14} />}
                  <span>{selectMode ? 'Cancel' : 'Select'}</span>
                </button>

                <div data-sort-menu className="relative">
                  <button
                    onClick={() => setSortOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-transparent border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
                    title="Sort"
                  >
                    <ArrowUpDown size={14} />
                    <span>{sortLabels[sortKey]}</span>
                    <span className="text-gray-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  </button>
                  <AnimatePresence>
                    {sortOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-2 w-44 rounded-xl bg-white dark:bg-[#0c0d0f] border border-gray-200 dark:border-white/10 shadow-xl z-30 py-1"
                      >
                        {(['date','name','size','type'] as SortKey[]).map((k) => (
                          <button
                            key={k}
                            onClick={() => {
                              if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                              else { setSortKey(k); setSortDir(k === 'name' || k === 'type' ? 'asc' : 'desc'); }
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              {sortKey === k ? <Check size={14} className="text-gray-900 dark:text-white" /> : <span className="w-[14px]" />}
                              {sortLabels[k]}
                            </span>
                            {sortKey === k && (
                              <span className="text-xs text-gray-500">{sortDir === 'asc' ? 'Asc' : 'Desc'}</span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'files', label: 'Files' },
                  { id: 'notes', label: 'Notes' },
                ].map((tab) => (
                  <motion.button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={`px-3.5 h-9 rounded-lg text-sm whitespace-nowrap border transition-colors ${
                      filter === tab.id
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white'
                        : 'bg-transparent text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {tab.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {selectMode && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="sticky top-2 z-30 mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-[#0c0d0f]/90 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-lg"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              <div className="flex items-center gap-3 text-sm text-gray-900 dark:text-white">
                <span className="font-medium">{selectedSlugs.size} selected</span>
                <button
                  onClick={() => selectAllVisible(filteredFiles)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs underline-offset-2 hover:underline"
                >
                  Select all
                </button>
                {selectedSlugs.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <button
                onClick={() => setConfirmBulkDelete(true)}
                disabled={selectedSlugs.size === 0 || bulkDeleting}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
              >
                <Trash2 size={14} />
                Delete {selectedSlugs.size > 0 ? `(${selectedSlugs.size})` : ''}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {filesLoading && !filesFetched ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </motion.div>
          ) : filteredFiles.length === 0 && (search || (files.length > 0 && filter !== 'all')) ? (
            <motion.div
              key="no-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Search className="text-gray-400 dark:text-gray-600" size={32} />
              </div>
              <h3 className="text-xl text-gray-900 dark:text-white mb-2">No matches.</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8" style={{ fontFamily: 'system-ui, sans-serif' }}>
                {search ? `No files match "${search}".` : 'Try a different filter.'}
              </p>
              {search && (
                <motion.button
                  onClick={() => setSearchInput('')}
                  className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 font-medium transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Clear search
                </motion.button>
              )}
            </motion.div>
          ) : filteredFiles.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-20"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-20 h-20 bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <FolderOpen className="text-gray-400 dark:text-gray-600" size={32} />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xl text-gray-900 dark:text-white mb-2"
              >
                Nothing here yet.
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-600 dark:text-gray-400 mb-8"
              >
                {filter === 'notes'
                  ? 'Create notes to get started.'
                  : filter === 'files'
                    ? 'Upload files to get started.'
                    : 'Upload files or create notes to get started.'}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                {(filter === 'all' || filter === 'files') && (
                  <motion.button
                    onClick={() => onPageChange('upload')}
                    className="bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-semibold transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Upload Files
                  </motion.button>
                )}
                {(filter === 'all' || filter === 'notes') && (
                  <motion.button
                    onClick={() => onPageChange('text')}
                    className={
                      filter === 'notes'
                        ? 'bg-white text-black px-6 py-3 rounded-xl font-semibold transition-colors dark:bg-white dark:text-black'
                        : 'border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-6 py-3 rounded-xl font-semibold hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors'
                    }
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Create Note
                  </motion.button>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="files"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
              }}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {filteredFiles.map((file, index) => {
                const glass = !file.thumbnail ? getFileGlass(file) : null;
                const expiry = getExpiryInfo(file.expiry_at);
                const expiryClass =
                  expiry?.tone === 'expired' ? 'bg-red-500/20 text-red-200 border-red-400/30'
                  : expiry?.tone === 'danger' ? 'bg-red-500/15 text-red-200 border-red-400/25'
                  : expiry?.tone === 'warn' ? 'bg-amber-500/15 text-amber-200 border-amber-400/25'
                  : 'bg-emerald-500/15 text-emerald-200 border-emerald-400/25';
                const slug = file.slug || file.id;
                const isSelected = selectedSlugs.has(slug);
                const swipeEnabled = isTouch && !selectMode;
                return (
                <motion.div
                  key={file.slug || file.id || index}
                  variants={{
                    hidden: { opacity: 0, y: 26, scale: 0.96 },
                    visible: {
                      opacity: 1, y: 0, scale: 1,
                      transition: { type: 'spring', stiffness: 300, damping: 24 },
                    },
                  }}
                  className={`relative rounded-2xl aspect-[4/3] ${
                    isSelected ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-black' : ''
                  }`}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '300px 225px' } as React.CSSProperties}
                  whileHover={
                    !selectMode && file.storage_mode === 'standard'
                      ? { scale: 1.02, boxShadow: '0 0 0 2px #ef4444, 0 0 16px 5px rgba(239,68,68,0.4)' }
                      : { scale: 1.02 }
                  }
                  transition={{
                    scale: { type: 'spring', stiffness: 380, damping: 26 },
                    boxShadow: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
                  }}
                >
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  {swipeEnabled && (
                    <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 text-white">
                      <Trash2 size={22} />
                    </div>
                  )}
                <motion.div
                  className={`relative group cursor-pointer rounded-2xl overflow-hidden w-full h-full`}
                  drag={swipeEnabled ? 'x' : false}
                  dragConstraints={{ left: -120, right: 0 }}
                  dragElastic={0.15}
                  dragSnapToOrigin
                  onDragEnd={(_e, info) => {
                    if (info.offset.x < -80) handleDelete(file);
                  }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ scale: { type: 'spring', stiffness: 380, damping: 26 } }}
                  onClick={(e) => {
                    if (selectMode) { toggleSelected(slug); return; }
                    if (e.shiftKey) { setSelectMode(true); toggleSelected(slug); return; }
                    handleFileView(file);
                  }}
                >
                  {file.thumbnail ? (
                    <img src={file.thumbnail} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.2]" />
                  ) : (
                    <>
                      <div className="absolute inset-0" style={{ background: glass!.baseBg }} />
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-white/[0.02]" />
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-white/15 via-white/5 to-transparent" />
                      <div className="absolute inset-0 border border-white/[0.07] rounded-2xl pointer-events-none" />
                      <div
                        className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse at 50% 110%, ${glass!.glow}, transparent 65%)` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="px-5 py-2 rounded-xl border border-white/10 transition-transform duration-300 group-hover:scale-[1.4]"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                          }}
                        >
                          <span
                            className="font-semibold tracking-[0.22em] text-sm select-none"
                            style={{ fontFamily: 'system-ui, sans-serif', color: glass!.labelColor }}
                          >
                            {glass!.label}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {selectMode && (
                    <div className={`absolute top-2 left-2 z-20 w-6 h-6 rounded-md flex items-center justify-center backdrop-blur-md border ${
                      isSelected ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-black/40 border-white/30 text-white/70'
                    }`}>
                      {isSelected ? <Check size={14} /> : <Square size={14} />}
                    </div>
                  )}

                  {expiry && !selectMode && (
                    <div className={`absolute top-2 left-2 px-2 py-1 rounded-md backdrop-blur-md border text-[10px] font-medium tracking-wide ${expiryClass} z-10`} style={{ fontFamily: 'system-ui, sans-serif' }}>
                      {expiry.label}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 group-hover:opacity-0 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 px-4 py-3 transition-opacity duration-300 group-hover:opacity-0 pointer-events-none" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    <h3 className="text-white font-semibold text-sm line-clamp-1 drop-shadow-sm">{file.name}</h3>
                    <span className="text-white/50 text-xs">
                      {sortKey === 'size'
                        ? formatBytes(file.size || 0)
                        : formatDate(new Date(file.created_at || file.uploadedAt))}
                    </span>
                  </div>

                  <div
                    className={`absolute top-2 right-2 flex gap-1 ${selectMode ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{ transition: 'opacity 0.2s ease' }}
                  >
                    <motion.button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const slug = (file as any).slug || file.id;
                        const link = `${window.location.origin}/file/${slug}`;
                        const result = await shareOrCopy({
                          title: file.name || 'VoidBox file',
                          text: 'Shared via VoidBox',
                          url: link,
                        });
                        if (result === 'shared') toast.success('Shared');
                        else if (result === 'copied') toast.success('Link copied to clipboard');
                        else if (result === 'failed') toast.error('Failed to copy link');
                      }}
                      className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-black/60"
                      style={{ transition: 'background 0.15s ease' }}
                      whileHover={{ scale: 1.18 }}
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                      title="Copy link"
                    >
                      <LinkIcon size={13} />
                    </motion.button>
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        const slug = (file as any).slug || file.id;
                        const token = localStorage.getItem('voidbox_token');
                        const url = `${BASE_URL}/download/${slug}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
                        const iframe = document.createElement('iframe');
                        iframe.style.display = 'none';
                        iframe.src = url;
                        document.body.appendChild(iframe);
                        setTimeout(() => document.body.removeChild(iframe), 10000);
                      }}
                      className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white hover:bg-black/60"
                      style={{ transition: 'background 0.15s ease' }}
                      whileHover={{ scale: 1.18 }}
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                      title="Download"
                    >
                      <Download size={13} />
                    </motion.button>
                    <motion.button
                      onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
                      className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-red-400 hover:bg-black/60"
                      style={{ transition: 'background 0.15s ease' }}
                      whileHover={{ scale: 1.18 }}
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 20 }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </motion.button>
                  </div>
                </motion.div>
                </div>
                </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={() => !bulkDeleting && setConfirmBulkDelete(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-white dark:bg-[#0c0d0f] rounded-2xl p-10 max-w-md w-full shadow-2xl text-center border border-gray-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-3xl font-normal mb-4 text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
              Delete {selectedSlugs.size} files?
            </h2>
            <p className="mb-8 text-gray-700 dark:text-gray-300 text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
              You're about to permanently delete <span className="font-semibold">{selectedSlugs.size}</span> file{selectedSlugs.size === 1 ? '' : 's'}.<br />
              <span className="font-bold text-red-500">This cannot be undone.</span>
            </p>
            <div className="flex justify-center gap-4">
              <motion.button
                onClick={() => setConfirmBulkDelete(false)}
                disabled={bulkDeleting}
                className="px-6 py-3 rounded-xl bg-transparent text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 font-semibold text-base transition-colors disabled:opacity-50"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-6 py-3 rounded-xl bg-red-600 text-white font-semibold text-base shadow-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedSlugs.size}`}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {confirmDelete.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={cancelDelete}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-white dark:bg-[#0c0d0f] rounded-2xl p-10 max-w-md w-full shadow-2xl text-center border border-gray-200 dark:border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-3xl font-normal mb-4 text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
              Delete File?
            </h2>
            <p className="mb-8 text-gray-700 dark:text-gray-300 text-sm font-normal" style={{ fontFamily: 'system-ui, sans-serif' }}>
              Are you sure you want to delete <span className="font-semibold">{confirmDelete.file?.name}</span>?<br />
              <span className="font-bold text-red-500">You won&apos;t be able to recover this file again.</span>
            </p>
            <div className="flex justify-center gap-4">
              <motion.button
                onClick={cancelDelete}
                className="px-6 py-3 rounded-xl bg-transparent text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 font-semibold text-base transition-colors focus:outline-none"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={confirmDeleteFile}
                className="px-6 py-3 rounded-xl bg-red-600 text-white font-semibold text-base transition-colors focus:outline-none shadow-md hover:bg-red-700"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                Delete
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default LibraryPage;
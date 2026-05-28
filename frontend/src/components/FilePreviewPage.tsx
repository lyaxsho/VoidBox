import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Download, Clock, Trash2, Code, Eye, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileItem, PageType } from '../types';
import { getDownloadUrl, triggerNativeDownload, trackDownloadProgress, shareOrCopy, BASE_URL } from '../lib/api';
import { getCachedFileInfo, getCachedNoteContent, getCachedZipList, peekFileInfo, peekNoteContent, peekZipList, invalidatePreviewCache } from '../lib/previewCache';
import { useToast } from './Toast';

function DeleteButton({ slug, fileName, onDeleted }: { slug: string; fileName?: string; onDeleted: () => void; theme: 'dark' | 'light' }) {
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const doDelete = async () => {
    setDeleting(true);
    const token = localStorage.getItem('voidbox_token');
    await fetch(`${BASE_URL}/mydrops/${slug}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    invalidatePreviewCache(slug);
    setDeleting(false);
    setOpen(false);
    onDeleted();
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        disabled={deleting}
        className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-sm font-medium disabled:opacity-50"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        <Trash2 size={14} />
        {deleting ? 'Deleting…' : 'Delete Now'}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
            onClick={() => !deleting && setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white dark:bg-[#0c0d0f] rounded-2xl p-10 max-w-md w-full shadow-2xl text-center border border-gray-200 dark:border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-3xl font-normal mb-4 text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                Delete File?
              </h2>
              <p className="mb-8 text-gray-700 dark:text-gray-300 text-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                Are you sure you want to delete {fileName ? <span className="font-semibold">{fileName}</span> : 'this file'}?<br />
                <span className="font-bold text-red-500">You won&apos;t be able to recover it.</span>
              </p>
              <div className="flex justify-center gap-4">
                <motion.button
                  onClick={() => setOpen(false)}
                  disabled={deleting}
                  className="px-6 py-3 rounded-xl bg-transparent text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 font-semibold text-base transition-colors focus:outline-none disabled:opacity-50"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={doDelete}
                  disabled={deleting}
                  className="px-6 py-3 rounded-xl bg-red-600 text-white font-semibold text-base transition-colors focus:outline-none shadow-md hover:bg-red-700 disabled:opacity-50"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const CODE_EXTS = new Set([
  'md','markdown','html','htm','css','scss','less','sass',
  'js','jsx','ts','tsx','mjs','cjs',
  'py','rb','go','rs','java','kt','swift',
  'c','h','cpp','cc','cxx','hpp','cs','m','mm',
  'php','sh','bash','zsh','fish','sql',
  'json','xml','yaml','yml','toml','ini','env','conf','log',
  'r','lua','pl','vim','dockerfile','makefile',
]);

function getFileExt(name: string | undefined): string {
  if (!name) return '';
  return name.split('.').pop()?.toLowerCase() || '';
}

function isCodeMimetype(mime: string | undefined): boolean {
  if (!mime) return false;
  const m = mime.toLowerCase();
  if (m === 'text/plain') return false; // notes handled separately
  if (m.startsWith('text/')) return true;
  if (m === 'application/json' || m === 'application/xml' || m === 'application/javascript') return true;
  return false;
}

function isCodeFile(fileInfo: any): boolean {
  if (!fileInfo) return false;
  if (CODE_EXTS.has(getFileExt(fileInfo.name))) return true;
  return isCodeMimetype(fileInfo.mimetype);
}

const EXT_TO_PRISM_LANG: Record<string, string> = {
  md: 'markdown', markdown: 'markdown',
  html: 'markup', htm: 'markup', xml: 'markup',
  css: 'css', scss: 'scss', less: 'less', sass: 'sass',
  js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'tsx',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
  cs: 'csharp', m: 'objectivec', mm: 'objectivec',
  php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  sql: 'sql', json: 'json',
  yaml: 'yaml', yml: 'yaml', toml: 'toml',
  ini: 'ini', env: 'ini', conf: 'ini',
  log: 'text', r: 'r', lua: 'lua', pl: 'perl', vim: 'text',
  dockerfile: 'docker', makefile: 'makefile',
};

function getPrismLang(ext: string): string {
  const lang = EXT_TO_PRISM_LANG[ext.toLowerCase()] || 'text';
  // Prism's markdown grammar breaks table rendering (pipes display block). Use plain text in source view —
  // the Preview toggle still renders markdown properly.
  if (lang === 'markdown') return 'text';
  return lang;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Minimal markdown → HTML (headings, bold, italic, code, lists, links, code blocks).
function renderMarkdown(md: string): string {
  let html = escapeHtml(md);
  // Fenced code blocks
  html = html.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="md-code"><code>${code}</code></pre>`);
  // Headings
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Inline code
  html = html.replace(/`([^`\n]+?)`/g, '<code>$1</code>');
  // Bold + italic
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|\W)\*([^*\n]+?)\*(?=\W|$)/g, '$1<em>$2</em>');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Lists
  html = html.replace(/^[\-\*] (.+)$/gm, '§li§$1§/li§');
  html = html.replace(/(?:§li§[^§]+§\/li§\n?)+/g, (m) =>
    '<ul>' + m.replace(/§li§/g, '<li>').replace(/§\/li§/g, '</li>') + '</ul>');
  // Paragraphs
  return html.split(/\n{2,}/).map((block) => {
    const t = block.trim();
    if (!t) return '';
    if (/^<(h\d|ul|ol|pre|blockquote|p|table)/.test(t)) return t;
    return '<p>' + t.replace(/\n/g, '<br/>') + '</p>';
  }).join('\n');
}

interface FilePreviewPageProps {
  file: FileItem;
  onPageChange: (page: PageType) => void;
  theme: 'dark' | 'light';
}

const FilePreviewPage: React.FC<FilePreviewPageProps> = ({ file, onPageChange, theme }) => {
  const toast = useToast();
  const initialSlug = (file as any).slug || file.id;
  const cachedInfo = peekFileInfo(initialSlug);
  const cachedNote = peekNoteContent(initialSlug);
  const cachedZip = peekZipList(initialSlug);

  const [fileInfo, setFileInfo] = useState<any>(cachedInfo);
  const [loading, setLoading] = useState(!cachedInfo);
  const [error, setError] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<string | null>(cachedNote);
  const [noteLoading, setNoteLoading] = useState(false);
  const [zipList, setZipList] = useState<string[] | null>(cachedZip);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showLinkToast, setShowLinkToast] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [codeContent, setCodeContent] = useState<string | null>(cachedNote);
  const [codeLoading, setCodeLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'source' | 'rendered'>('source');

  useEffect(() => {
    const slug = (file as any).slug || file.id;
    let cancelled = false;
    const cached = peekFileInfo(slug);
    if (cached) {
      setFileInfo(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    getCachedFileInfo(slug)
      .then((info) => { if (!cancelled) setFileInfo(info); })
      .catch(() => { if (!cancelled) setError('File not found'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    if (fileInfo?.mimetype === 'text/plain' && fileInfo.download_url) {
      const slug = (file as any).slug || file.id;
      const cached = peekNoteContent(slug);
      if (cached !== null) {
        setNoteContent(cached);
        return;
      }
      let cancelled = false;
      setNoteLoading(true);
      getCachedNoteContent(slug)
        .then((text) => { if (!cancelled) setNoteContent(text); })
        .finally(() => { if (!cancelled) setNoteLoading(false); });
      return () => { cancelled = true; };
    } else {
      setNoteContent(null);
    }
  }, [fileInfo, file]);

  // Fetch source for code files (reuses /note-content/ which serves any file as text)
  useEffect(() => {
    if (!fileInfo || !isCodeFile(fileInfo)) {
      setCodeContent(null);
      return;
    }
    const slug = (file as any).slug || file.id;
    const cached = peekNoteContent(slug);
    if (cached !== null) {
      setCodeContent(cached);
      return;
    }
    let cancelled = false;
    setCodeLoading(true);
    getCachedNoteContent(slug)
      .then((text) => { if (!cancelled) setCodeContent(text); })
      .finally(() => { if (!cancelled) setCodeLoading(false); });
    return () => { cancelled = true; };
  }, [fileInfo, file]);

  function isZipMimetype(mimetype: string | undefined) {
    return mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed';
  }

  useEffect(() => {
    if (isZipMimetype(fileInfo?.mimetype) && fileInfo?.download_url) {
      const slug = (file as any).slug || file.id;
      const cached = peekZipList(slug);
      if (cached) {
        setZipList(cached);
        setZipError(null);
        return;
      }
      let cancelled = false;
      setZipLoading(true);
      setZipError(null);
      getCachedZipList(slug)
        .then((files) => { if (!cancelled) setZipList(files); })
        .catch((err) => {
          if (cancelled) return;
          console.error('ZIP list fetch error:', err);
          setZipList(null);
          setZipError('Failed to load ZIP file list.');
        })
        .finally(() => { if (!cancelled) setZipLoading(false); });
      return () => { cancelled = true; };
    } else {
      setZipList(null);
      setZipError(null);
      setZipLoading(false);
    }
  }, [fileInfo, file]);

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const copyLink = async () => {
    const slug = (file as any).slug || file.id;
    const link = `${window.location.origin}/file/${slug}`;
    const result = await shareOrCopy({
      title: fileInfo?.name || file.name || 'VoidBox file',
      text: 'Shared via VoidBox',
      url: link,
    });
    if (result === 'shared') toast.success('Shared');
    else if (result === 'copied') toast.success('Link copied to clipboard');
    else if (result === 'failed') toast.error('Failed to copy link');
    if (result !== 'failed' && fileInfo?.link_expires_at) {
      setShowLinkToast(true);
      setTimeout(() => setShowLinkToast(false), 5000);
    }
  };

  const handleDownload = async () => {
    if (!fileInfo || downloading) return;
    const slug = (file as any).slug || file.id;

    setDownloading(true);
    setDownloadProgress(0);

    // Instant Chrome save dialog / download manager entry
    triggerNativeDownload(slug);

    try {
      await trackDownloadProgress(slug, (pct) => setDownloadProgress(pct));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      alert(msg);
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Preview rendering
  const MAX_PREVIEW_SIZE = 20 * 1024 * 1024; // 20MB
  const tooLargeToPreview = fileInfo?.size > MAX_PREVIEW_SIZE;
  let preview: React.ReactNode = null;
  const slug = (file as any).slug || file.id;
  if (tooLargeToPreview) {
    preview = <div className="mx-auto max-w-lg text-center text-gray-400 italic mb-6">File is too large to preview (over 20MB). Use the Download button.</div>;
  } else if (fileInfo?.mimetype?.startsWith('image/')) {
    preview = <img src={getDownloadUrl(slug)} alt={fileInfo.name} className={`mx-auto max-h-96 rounded-xl mb-6${theme === 'dark' ? ' bg-white' : ''}`} style={theme === 'dark' ? { backgroundColor: 'white' } : {}} />;
  } else if (fileInfo?.mimetype?.startsWith('video/')) {
    preview = <video src={getDownloadUrl(slug)} controls className={`mx-auto max-h-96 rounded-xl mb-6${theme === 'dark' ? ' bg-white' : ''}`} style={theme === 'dark' ? { backgroundColor: 'white' } : {}} />;
  } else if (fileInfo?.mimetype?.startsWith('audio/')) {
    preview = (
      <audio controls className={`mx-auto w-full max-w-2xl mb-6${theme === 'dark' ? ' bg-white text-black' : ''}`} style={theme === 'dark' ? { backgroundColor: 'white', color: 'black' } : {}}>
        <source src={getDownloadUrl(slug)} type={fileInfo.mimetype} />
        Your browser does not support the audio element.
      </audio>
    );
  } else if (fileInfo?.mimetype === 'application/pdf') {
    preview = (
      <iframe
        src={getDownloadUrl(slug)}
        className={`mx-auto w-full h-96 rounded-xl mb-6${theme === 'dark' ? ' bg-white text-black' : ' bg-white'}`}
        title="PDF Preview"
        style={theme === 'dark' ? { border: 'none', backgroundColor: 'white', color: 'black' } : { border: 'none' }}
        allow="autoplay"
      >
        <p>Your browser does not support PDF preview. <a href={getDownloadUrl(slug)} target="_blank" rel="noopener noreferrer">Download PDF</a></p>
      </iframe>
    );
  } else if (isZipMimetype(fileInfo?.mimetype)) {
    if (zipLoading) {
      preview = <div className="mx-auto text-center text-gray-400 mb-6">Loading ZIP contents...</div>;
    } else if (zipError) {
      preview = <div className="mx-auto text-center text-red-400 mb-6">{zipError}</div>;
    } else if (zipList) {
      preview = (
        <div className={`mx-auto w-full max-w-2xl rounded-xl mb-6 p-6${theme === 'dark' ? ' bg-white text-black' : ' bg-gray-900 text-white'}`}
        >
          <h3 className="font-bold mb-2">ZIP Contents:</h3>
          <ul className="list-disc pl-6">
            {zipList.length > 0 ? zipList.map((f, i) => <li key={i}>{f}</li>) : <li>No files found in ZIP.</li>}
          </ul>
        </div>
      );
    } else {
      preview = <div className="mx-auto text-center text-gray-400 mb-6">No preview available for this ZIP file.</div>;
    }
  } else if (fileInfo?.mimetype === 'text/plain') {
    preview = noteLoading ? (
      <div className="mx-auto text-center text-gray-400 mb-6">Loading note...</div>
    ) : (
      (() => {
        if (!noteContent) return null;
        const lines = noteContent.split('\n');
        const title = lines[0];
        const underline = lines[1] && /^[=\-]+$/.test(lines[1]) ? lines[1] : null;
        const rest = underline ? lines.slice(2).join('\n') : lines.slice(1).join('\n');
        return (
          <pre
            className={`mx-auto w-full max-w-2xl rounded-xl mb-6 p-6 overflow-x-auto whitespace-pre-wrap text-left text-base${theme === 'dark' ? ' bg-white text-black' : ' bg-black text-white border border-gray-200'}`}
            style={theme === 'dark' ? { fontFamily: 'Inter, sans-serif', backgroundColor: 'white', color: 'black', border: 'none' } : { fontFamily: 'Inter, sans-serif' }}
          >
            <div className="text-center">
              <div className="font-semibold text-lg mb-1">{title}</div>
              {underline && <div className="text-center mb-3">{underline}</div>}
            </div>
            {rest}
          </pre>
        );
      })()
    );
  } else if (isCodeFile(fileInfo)) {
    const ext = getFileExt(fileInfo?.name);
    const lang = ext.toUpperCase();
    const canRender = ext === 'md' || ext === 'markdown' || ext === 'html' || ext === 'htm';
    if (codeLoading && !codeContent) {
      preview = <div className="mx-auto text-center text-gray-400 mb-6">Loading source…</div>;
    } else if (codeContent !== null) {
      const lines = codeContent.split('\n');
      const showRendered = canRender && viewMode === 'rendered';
      preview = (
        <div className="mx-auto w-full max-w-3xl mb-6 rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden bg-white dark:bg-[#0c0d0f]" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-white/10 text-xs">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Code size={13} />
              <span className="uppercase tracking-wider font-semibold">{lang || 'TEXT'}</span>
              <span className="text-gray-400 dark:text-gray-600">·</span>
              <span>{lines.length} lines</span>
            </div>
            {canRender && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewMode('source')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                    viewMode === 'source'
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-black'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Code size={12} /> Source
                </button>
                <button
                  onClick={() => setViewMode('rendered')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                    viewMode === 'rendered'
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-black'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Eye size={12} /> Preview
                </button>
              </div>
            )}
          </div>
          {showRendered ? (
            ext === 'html' || ext === 'htm' ? (
              <iframe
                srcDoc={codeContent}
                sandbox=""
                className="w-full h-[60vh] bg-white"
                title="HTML preview"
              />
            ) : (
              <div
                className="p-6 prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 markdown-body"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(codeContent) }}
              />
            )
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <SyntaxHighlighter
                language={getPrismLang(ext)}
                style={theme === 'dark' ? oneDark : oneLight}
                showLineNumbers
                wrapLongLines={false}
                customStyle={{
                  margin: 0,
                  padding: '12px 0',
                  background: 'transparent',
                  fontSize: '13px',
                  lineHeight: '1.55',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  whiteSpace: 'pre',
                }}
                codeTagProps={{
                  style: {
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    whiteSpace: 'pre',
                  },
                }}
                lineNumberStyle={{
                  minWidth: '3em',
                  paddingRight: '1em',
                  textAlign: 'right',
                  color: theme === 'dark' ? '#4b5563' : '#9ca3af',
                  userSelect: 'none',
                  borderRight: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
                  marginRight: '0.75em',
                }}
              >
                {codeContent}
              </SyntaxHighlighter>
            </div>
          )}
        </div>
      );
    } else {
      preview = <div className="mx-auto text-center text-gray-400 mb-6">Failed to load source.</div>;
    }
  } else {
    preview = <div className="mx-auto max-w-lg text-center text-gray-400 italic mb-6">No preview available for this file type.</div>;
  }

  const formatLinkExpiry = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(dateStr));
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <>
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="min-h-screen p-6 md:p-12 bg-white dark:bg-black"
    >
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2 mb-8"
        >
          <motion.button
            onClick={() => onPageChange('library')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors shrink-0"
            whileHover={{ scale: 1.05, x: -5 }}
            whileTap={{ scale: 0.95 }}
            title="Back to Library"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline whitespace-nowrap">Back to Library</span>
          </motion.button>

          <div className="flex items-center gap-2 sm:gap-3">
            <motion.button
              onClick={copyLink}
              className="flex items-center gap-2 bg-transparent text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 w-10 sm:w-auto h-10 sm:px-4 sm:py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Copy Link"
            >
              <Copy size={18} />
              <span className="hidden sm:inline whitespace-nowrap">Copy Link</span>
            </motion.button>
            <motion.button
              onClick={() => setShowQR(true)}
              className="group relative flex items-center justify-center bg-transparent text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <QrCode size={20} />
              <span
                className="absolute top-full mt-2 right-0 bg-gray-900 dark:bg-white text-white dark:text-black px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                Show QR code
              </span>
            </motion.button>
            <motion.button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-black w-10 sm:w-auto h-10 sm:px-4 sm:py-2 sm:min-w-[140px] rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed justify-center"
              whileHover={downloading ? {} : { scale: 1.05 }}
              whileTap={downloading ? {} : { scale: 0.95 }}
              title={downloading ? 'Downloading' : 'Download'}
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline whitespace-nowrap">
                    {downloadProgress > 0 ? `Downloading… ${downloadProgress}%` : 'Downloading…'}
                  </span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span className="hidden sm:inline whitespace-nowrap">Download</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-light text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            {fileInfo?.name || file.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Uploaded on {fileInfo?.created_at ? formatDate(fileInfo.created_at) : formatDate(file.uploadedAt)}
          </p>
          {file.notes && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-700 dark:text-gray-300 mt-2"
            >
              {file.notes}
            </motion.p>
          )}
        </motion.div>

        {preview}

        <div className={`rounded-2xl p-8 text-center ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
          <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} mb-2`}>
            Size: {fileInfo?.size != null
              ? fileInfo.size >= 1024 * 1024
                ? (fileInfo.size / (1024 * 1024)).toFixed(2) + ' MB'
                : (fileInfo.size / 1024).toFixed(1) + ' KB'
              : '—'}
          </div>
          <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} mb-2`}>MIME: {fileInfo?.mimetype}</div>
          <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} mb-2`}>
            Expiry: {fileInfo?.expiry_at ? formatDate(fileInfo.expiry_at) : <span title="Never expires">&#8734;</span>}
          </div>
          <DeleteButton slug={(file as any).slug || file.id} fileName={fileInfo?.name || file.name} onDeleted={() => onPageChange('library')} theme={theme} />
        </div>
      </div>

    </motion.div>

    {createPortal(
      <AnimatePresence>
        {showQR && (
          <motion.div
            key="qr-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className="relative bg-white dark:bg-[#0c0d0f] border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center"
              style={{ fontFamily: 'system-ui, sans-serif' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowQR(false)}
                className="absolute right-3 top-3 p-1.5 rounded-md text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                title="Close"
              >
                <X size={16} />
              </button>
              <h3 className="text-xl text-gray-900 dark:text-white mb-1 font-light" style={{ fontFamily: 'Playfair Display, serif' }}>
                Scan to open
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                Point your phone camera at the QR code
              </p>
              <div className="inline-block p-4 rounded-xl bg-white">
                <QRCodeSVG
                  value={`${window.location.origin}/file/${(file as any).slug || file.id}`}
                  size={208}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <p className="mt-5 text-[11px] font-mono text-gray-500 dark:text-gray-500 break-all px-2">
                {`${window.location.origin}/file/${(file as any).slug || file.id}`}
              </p>
            </motion.div>
          </motion.div>
        )}
        {showLinkToast && fileInfo?.link_expires_at && (
          <div className="fixed inset-x-0 top-6 z-[9999] flex justify-center pointer-events-none px-6">
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="pointer-events-auto relative w-auto rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-white px-8 py-2.5 text-center"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <Clock size={14} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
              <button
                onClick={() => setShowLinkToast(false)}
                className="absolute right-3 top-2.5 text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-lg leading-none"
              >
                ×
              </button>
              <div className="mb-0.5">
                <span className="text-sm font-semibold">Link expires in 24 hours</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                at {formatLinkExpiry(fileInfo.link_expires_at)}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
};

export default FilePreviewPage;

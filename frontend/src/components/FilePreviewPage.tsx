import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Download } from 'lucide-react';
import { FileItem, PageType } from '../types';
import { getFileInfo, getDownloadUrl, BASE_URL } from '../lib/api';

interface FilePreviewPageProps {
  file: FileItem;
  onPageChange: (page: PageType) => void;
  theme: 'dark' | 'light';
}

const FilePreviewPage: React.FC<FilePreviewPageProps> = ({ file, onPageChange, theme }) => {

  const [fileInfo, setFileInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [noteContent, setNoteContent] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [zipList, setZipList] = useState<string[] | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  useEffect(() => {
    // Assume file.slug or file.id is the backend slug
    const slug = (file as any).slug || file.id;
    setLoading(true);
    getFileInfo(slug)
      .then(setFileInfo)
      .catch((err) => setError('File not found'))
      .finally(() => setLoading(false));
  }, [file]);

  useEffect(() => {
    if (fileInfo?.mimetype === 'text/plain' && fileInfo.download_url) {
      setNoteLoading(true);
      // Use backend proxy for note content
      const slug = (file as any).slug || file.id;
      const token = localStorage.getItem('voidbox_token');
      fetch(`${BASE_URL}/note-content/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(res => res.text())
        .then(text => setNoteContent(text))
        .finally(() => setNoteLoading(false));
    } else {
      setNoteContent(null);
    }
  }, [fileInfo]);

  function isZipMimetype(mimetype: string | undefined) {
    return mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed';
  }

  useEffect(() => {
    if (isZipMimetype(fileInfo?.mimetype) && fileInfo?.download_url) {
      setZipLoading(true);
      setZipError(null);
      const slug = (file as any).slug || file.id;
      const token = localStorage.getItem('voidbox_token');
      fetch(`${BASE_URL}/zip-list/${slug}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(res => res.json())
        .then(data => {

          setZipList(data.files || []);
          setZipLoading(false);
        })
        .catch((err) => {
          console.error('ZIP list fetch error:', err);
          setZipList(null);
          setZipError('Failed to load ZIP file list.');
          setZipLoading(false);
        });
    } else {
      setZipList(null);
      setZipError(null);
      setZipLoading(false);
    }
  }, [fileInfo]);

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const copyLink = () => {
    const slug = (file as any).slug || file.id;
    const link = `${window.location.origin}/file/${slug}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDownload = () => {
    if (!fileInfo) return;
    // Hidden iframe triggers native Chrome download via Content-Disposition: attachment
    // Works cross-origin unlike <a download>, doesn't navigate away unlike location.assign
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = getDownloadUrl((file as any).slug || file.id);
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 10000);
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
  } else {
    preview = <div className="mx-auto max-w-lg text-center text-gray-400 italic mb-6">No preview available for this file type.</div>;
  }

  // Debug log for note preview


  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="min-h-screen p-6 md:p-12 bg-white dark:bg-black"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <motion.button
            onClick={() => onPageChange('library')}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            whileHover={{ scale: 1.05, x: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={20} />
            <span>Back to Library</span>
          </motion.button>

          <div className="flex space-x-3">
            <motion.button
              onClick={copyLink}
              className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Copy size={16} />
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </motion.button>
            <motion.button
              onClick={handleDownload}
              className="flex items-center space-x-2 bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Download size={16} />
              <span>Download</span>
            </motion.button>
          </div>
        </motion.div>

        {/* File Info */}
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

        {/* Preview */}
        {preview}

        {/* Content */}
        <div className={`rounded-2xl p-8 text-center ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
          <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} mb-2`}>Size: {fileInfo?.size} bytes</div>
          <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} mb-2`}>MIME: {fileInfo?.mimetype}</div>
          <div className={`${theme === 'dark' ? 'text-white' : 'text-black'} mb-2`}>
            Expiry: {fileInfo?.expiry_at ? formatDate(fileInfo.expiry_at) : <span title="Never expires">&#8734;</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default FilePreviewPage;

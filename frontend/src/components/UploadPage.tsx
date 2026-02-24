import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, File, Film, FileText, Archive, X } from 'lucide-react';
import { PageType } from '../types';
import { uploadFile } from '../lib/api';

interface UploadPageProps {
  onPageChange: (page: PageType) => void;
  onFileAdd: (file: { name: string; type: 'file'; fileType: string; notes?: string; slug?: string }) => void;
  theme: 'dark' | 'light';
  user?: any;
  triggerLoginModal?: () => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onPageChange, onFileAdd, theme, user, triggerLoginModal }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expiryType, setExpiryType] = useState<'none' | 'date' | 'days'>('none');
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryDays, setExpiryDays] = useState('');

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setFileName(files[0].name);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setFileName(files[0].name);
    }
  };

  const handleUpload = async () => {
    if (!user && triggerLoginModal) {
      triggerLoginModal();
      return;
    }
    if (selectedFile) {
      // Check file size (2GB limit with Local Bot API)
      const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
      if (selectedFile.size > MAX_SIZE) {
        alert(`File too large! Maximum size is 2GB. Your file is ${(selectedFile.size / 1024 / 1024 / 1024).toFixed(2)}GB.`);
        return;
      }
      setUploading(true);
      try {

        const options: any = {};
        if (expiryType === 'date' && expiryDate) options.expiry_at = expiryDate;
        if (expiryType === 'days' && expiryDays) options.expiry_days = Number(expiryDays);
        if (user?.id) options.user_id = user.id;
        options.onProgress = (progress: number) => setUploadProgress(progress);
        const response = await uploadFile(selectedFile, options);
        // Optionally, show the slug or file info to the user here
        onFileAdd({
          name: response.file.name,
          type: 'file',
          fileType: getFileType(selectedFile),
          notes: notes || undefined,
          slug: response.slug,
        });
        // Reset form
        setSelectedFile(null);
        setFileName('');
        setNotes('');
        setUploading(false);
        setUploadProgress(0);
        // Navigate to library
        onPageChange('library');
      } catch (err) {
        alert('Upload failed.');
        setUploading(false);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

        {/* Upload Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all mb-8 ${isDragging
            ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-900'
            : selectedFile
              ? 'border-green-500 bg-green-50 dark:bg-green-500/5'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <AnimatePresence mode="wait">
            {selectedFile ? (
              <motion.div
                key="selected"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center space-x-3">
                  <File className="text-green-500" size={24} />
                  <span className="text-gray-900 dark:text-white font-medium">{selectedFile.name}</span>
                  <motion.button
                    onClick={removeFile}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Upload className="mx-auto text-gray-400 dark:text-gray-500" size={48} />
                </motion.div>
                <div>
                  <p className="text-gray-900 dark:text-white text-lg mb-2">Drop files here</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">or</p>
                  <motion.button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-semibold transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Browse Files
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          multiple={false}
        />

        {/* File Type Icons */}
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

        {/* Form Fields */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6 mb-8"
        >
          <div>
            <label className="block text-gray-900 dark:text-white text-sm font-medium mb-2">
              Filename (optional)
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Custom filename..."
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:border-gray-400 dark:focus:border-gray-600 focus:outline-none transition-colors"
            />
          </div>

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

        {/* Upload Button */}
        <motion.button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={!selectedFile || uploading ? {} : {
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
          {uploading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Uploading... {uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gray-900 dark:bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
          ) : (
            'Upload Now'
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default UploadPage;
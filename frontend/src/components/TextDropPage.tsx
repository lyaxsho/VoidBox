import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PageType } from '../types';
import { uploadNote } from '../lib/api';

interface TextDropPageProps {
  onPageChange: (page: PageType) => void;
  onFileAdd: (file: { name: string; type: 'note'; content: string; slug?: string }) => void;
  theme: 'dark' | 'light';
  user?: any;
  triggerLoginModal?: () => void;
}

const TextDropPage: React.FC<TextDropPageProps> = ({ onPageChange, onFileAdd, theme, user, triggerLoginModal }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user && triggerLoginModal) {
      triggerLoginModal();
      return;
    }
    if (content.trim()) {
      setSaving(true);
      try {

        const options: any = {};
        if (user?.id) options.user_id = user.id;
        const response = await uploadNote(title, content, options);
        onFileAdd({
          name: response.file.name,
          type: 'note',
          content: content,
          slug: response.slug,
        });
        setTitle('');
        setContent('');
        setSaving(false);
        onPageChange('library');
      } catch (err) {
        alert('Note upload failed.');
        setSaving(false);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6 md:p-12 bg-white dark:bg-black"
    >
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-4xl font-light text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Create Note
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-12">
            Write your thoughts, ideas, or any text you want to save.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6 mb-8"
        >
          <div>
            <label className="block text-gray-900 dark:text-white text-sm font-medium mb-2">
              Title (optional)
            </label>
            <motion.input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your note a title..."
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:border-gray-400 dark:focus:border-gray-600 focus:outline-none transition-colors"
              style={{ fontFamily: 'Inter, sans-serif' }}
              whileFocus={{ scale: 1.01 }}
            />
          </div>

          <div>
            <label className="block text-gray-900 dark:text-white text-sm font-medium mb-2">
              Content
            </label>
            <motion.textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing..."
              rows={20}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-6 py-4 text-gray-900 dark:text-white placeholder-gray-500 focus:border-gray-400 dark:focus:border-gray-600 focus:outline-none resize-none transition-colors"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', lineHeight: '1.6' }}
              whileFocus={{ scale: 1.005 }}
            />
          </div>
        </motion.div>

        <motion.button
          onClick={handleSave}
          disabled={!content.trim() || saving}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={!content.trim() || saving ? {} : {
            scale: 1.02,
            boxShadow: theme === 'dark'
              ? '0 0 30px rgba(255, 255, 255, 0.3)'
              : '0 0 30px rgba(0, 0, 0, 0.3)'
          }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {saving ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </div>
          ) : (
            'Save Note'
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default TextDropPage;
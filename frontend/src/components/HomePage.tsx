import React from 'react';
import { motion } from 'framer-motion';
import { PageType } from '../types';

interface HomePageProps {
  onPageChange: (page: PageType) => void;
  theme: 'dark' | 'light';
  isMenuOpen?: boolean;
}

const HomePage: React.FC<HomePageProps> = ({ onPageChange, theme, isMenuOpen = false }) => {
  // Add a scale variable for collective resizing
  const scale = 0.9; // Change this value (e.g., 0.8) to reduce the group size

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen flex items-center justify-center px-6 bg-white dark:bg-black"
    >
      <motion.div
        animate={{ opacity: isMenuOpen ? 0.3 : 1, filter: isMenuOpen ? 'blur(3px)' : 'none' }}
        className={`relative z-0 transition-all duration-300 ${isMenuOpen ? 'pointer-events-none select-none' : ''}`}
      >
        <div className="text-center max-w-2xl">
          {/* Main Logo for Home Page */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 50 }}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="flex justify-center mb-10"
          // style={{ transform: 'translateY(140px) translateX(110px)' }} // adjust Y and X as needed
          >
            {theme === 'dark' ? (
              <img
                src="/Dark_Mode_MAIN.png"
                alt="VoidBox Logo Dark"
                className="mx-auto max-w-xs sm:max-w-sm md:max-w-md w-full h-auto object-contain"
                style={{ width: '12rem', height: '12rem' }}
                draggable="false"
              />
            ) : (
              <img
                src="/Light_Mode_MAIN.png"
                alt="VoidBox Logo Light"
                className="mx-auto max-w-xs sm:max-w-sm md:max-w-md w-full h-auto object-contain"
                style={{ width: '12rem', height: '12rem' }}
                draggable="false"
              />
            )}
          </motion.div>

          <div className="h-5" />
          {/* </motion.div> */}
          {/* Grouped and scalable: tagline, subtitle, buttons, and small text */ }
  <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.8 }}
    >
      <h1 className="text-5xl md:text-6xl font-light text-gray-900 dark:text-white mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
        A private vault for your files & thoughts.
      </h1>
    </motion.div>
    <motion.p
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.8 }}
      className="text-xl text-gray-600 dark:text-gray-400 mb-12"
      style={{ fontFamily: 'Playfair Display, serif' }}
    >
      Store, organize, and access your digital life with complete privacy.
    </motion.p>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.8 }}
      className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
    >
      <motion.button
        onClick={() => onPageChange('upload')}
        className="bg-gray-900 dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl font-semibold text-lg transition-all"
        whileHover={{
          scale: 1.05,
          boxShadow: theme === 'dark'
            ? '0 0 30px rgba(255, 255, 255, 0.3)'
            : '0 0 30px rgba(0, 0, 0, 0.3)'
        }}
        whileTap={{ scale: 0.95 }}
      >
        Upload Something
      </motion.button>
      <motion.button
        onClick={() => onPageChange('text')}
        className="border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:border-gray-500 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
        whileHover={{
          scale: 1.05,
          boxShadow: theme === 'dark'
            ? '0 0 20px rgba(255, 255, 255, 0.1)'
            : '0 0 20px rgba(0, 0, 0, 0.1)'
        }}
        whileTap={{ scale: 0.95 }}
      >
        Paste Text
      </motion.button>
    </motion.div>
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8, duration: 0.8 }}
      className="text-sm text-gray-500 dark:text-gray-600 italic"
      style={{ fontFamily: 'Playfair Display, serif' }}
    >
      Private. Permanent. Yours.
    </motion.p>
  </div>
        </div >
      </motion.div >
    </motion.div >
  );
};

export default HomePage;
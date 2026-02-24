import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Home, Upload, FileText, FolderOpen, Settings, LogOut } from 'lucide-react';
import { User } from '../hooks/useAuth';
import { PageType } from '../types';
import Lottie from 'lottie-react';
import guestAnimation from '../../wired-outline-21-avatar-hover-looking-around.json';
import ThemeToggle from './ThemeToggle';
import ProfileMenu from './ProfileMenu';
import { useState } from 'react';

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onSignOut?: () => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  theme: 'dark' | 'light';
  user?: User | null;
  triggerLoginModal?: () => void;
  toggleTheme?: () => void;
  toggleRef?: React.RefObject<HTMLButtonElement>;
  setProfileOpen?: (open: boolean) => void;
  profileOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onPageChange,
  onSignOut,
  isMobile = false,
  isOpen = true,
  onClose,
  theme,
  user,
  triggerLoginModal,
  toggleTheme,
  toggleRef,
  setProfileOpen,
  profileOpen: propProfileOpen
}) => {
  const navItems = [
    { id: 'home' as PageType, icon: Home, label: 'Home' },
    { id: 'upload' as PageType, icon: Upload, label: 'Upload' },
    { id: 'text' as PageType, icon: FileText, label: 'Text' },
    { id: 'library' as PageType, icon: FolderOpen, label: 'My Drops' },
    { id: 'policies' as PageType, icon: Settings, label: 'Policies' },
  ];

  const handleNavClick = (page: PageType) => {
    onPageChange(page);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const [internalProfileOpen, setInternalProfileOpen] = useState(false);
  const profileOpen = typeof propProfileOpen === 'boolean' ? propProfileOpen : internalProfileOpen;
  const setProfileOpenProp = setProfileOpen || setInternalProfileOpen;
  const lottieRef = useRef<any>(null); // Always call useRef at the top

  if (isMobile) {
    return (
      <>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
        <motion.div
          initial={{ x: -256 }}
          animate={{ x: isOpen ? 0 : -256 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 z-50 lg:hidden"
        >
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-8">
              {theme === 'dark' ? (
                <img src="/dark.png" alt="VoidBox" className="w-8 h-8" />
              ) : (
                <img src="/light.png" alt="VoidBox" className="w-8 h-8" />
              )}
              <h1 className="text-gray-900 dark:text-white font-bold text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>VoidBox</h1>
            </div>
            <nav className="space-y-2">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${currentPage === item.id
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-black'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900'
                      }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </motion.button>
                );
              })}
            </nav>
          </div>
          <div className="absolute bottom-6 left-6 right-6">
            {user && onSignOut && (
              <motion.button
                onClick={onSignOut}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <LogOut size={20} />
                <span className="font-medium">Sign Out</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <div className="fixed left-0 top-0 h-full w-20 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-900 flex flex-col items-center py-6">
      <motion.div
        className="mb-8"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center">
          {theme === 'dark' ? (
            <img src="/dark.png" alt="VoidBox" className="w-8 h-8" />
          ) : (
            <img src="/light.png" alt="VoidBox" className="w-8 h-8" />
          )}
        </div>
      </motion.div>

      <nav className="flex flex-col space-y-4 flex-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.2 }}
              onClick={() => onPageChange(item.id)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors group relative ${currentPage === item.id
                ? 'bg-gray-900 dark:bg-white text-white dark:text-black'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900'
                }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon size={20} />

              {/* Tooltip */}
              <div className="absolute left-16 bg-gray-900 dark:bg-white text-white dark:text-black px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {item.label}
              </div>
            </motion.button>
          );
        })}
        {/* Theme Toggle Button */}
        <motion.div
          className="flex justify-center mt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: navItems.length * 0.1 + 0.2 }}
        >
          {toggleTheme && (
            <ThemeToggle
              theme={theme}
              onToggle={toggleTheme}
              ref={toggleRef}
            />
          )}
        </motion.div>
      </nav>

      <div className="mt-auto space-y-4">
        {user && onSignOut ? (
          <>
            <motion.button
              onClick={() => setProfileOpenProp(true)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors group relative ${profileOpen
                ? 'bg-gray-900 dark:bg-white text-white dark:text-black'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900'
                }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title="Profile"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-user-round-icon lucide-user-round"
              >
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 0 0-16 0" />
              </svg>
              {/* Tooltip */}
              <div className="absolute left-16 bg-gray-900 dark:bg-white text-white dark:text-black px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Profile
              </div>
            </motion.button>
            {/* Only render the high z-index ProfileMenu wrapper when profileOpen is true */}
            {profileOpen && (
              <div className="absolute left-0 top-0 w-full h-full z-50 flex items-center justify-center">
                <ProfileMenu
                  open={profileOpen}
                  onClose={() => setProfileOpenProp(false)}
                  user={{
                    firstName: user.first_name || '',
                    lastName: user.last_name || '',
                    username: user.username || '',
                    photoUrl: user.photo_url || '',
                    createdAt: user.created_at || '',
                  }}
                  onSignOut={onSignOut}
                />
              </div>
            )}
          </>
        ) : (
          <motion.button
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors group relative p-0 text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 focus:outline-none`}
            onClick={triggerLoginModal}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            style={{ border: 'none', background: 'none' }}
            onMouseEnter={() => lottieRef.current?.play?.()}
            onMouseLeave={() => lottieRef.current?.stop?.()}
          >
            <Lottie
              lottieRef={lottieRef}
              animationData={guestAnimation}
              loop={false}
              autoplay={false}
              style={{ width: 31, height: 31 }}
            />
            {/* Tooltip */}
            <div className="absolute left-16 bg-gray-900 dark:bg-white text-white dark:text-black px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Guest Mode
            </div>
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
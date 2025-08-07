import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Home, Upload, FileText, FolderOpen, Settings, LogOut, User, MessageSquare } from 'lucide-react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { PageType } from '../types';
import Lottie from 'lottie-react';
import guestAnimation from '../../wired-outline-21-avatar-hover-looking-around.json';
import ThemeToggle from './ThemeToggle';
import ProfileMenu from './ProfileMenu';
import ContactSupport from './ContactSupport';
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';

interface SidebarProps {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onSignOut?: () => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  theme: 'dark' | 'light';
  user?: SupabaseUser | null;
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
  const [contactSupportOpen, setContactSupportOpen] = useState(false);
  const lottieRef = useRef<any>(null); // Always call useRef at the top

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop with animated blur */}
            <motion.div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={onClose}
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 0.5, backdropFilter: 'blur(8px)' }}
              exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              style={{ WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)' }}
            />
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[rgba(10,12,20,0.75)] dark:bg-[rgba(10,12,20,0.85)] backdrop-blur-lg rounded-t-2xl shadow-lg p-0 flex flex-col items-stretch sheet px-4 pt-4 pb-1"
              style={{ height: '60vh', maxHeight: 480, boxShadow: '0 -8px 16px rgba(0,0,0,0.4)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-full flex justify-center">
                <div className="w-12 h-1 rounded-full bg-white/30 mx-auto mb-4" />
              </div>
              {/* Sheet header: logo left, close right */}
              <div className="flex items-center justify-between px-0 pb-2">
                <div className="flex items-center space-x-2">
                  {theme === 'dark' ? (
                    <img src="/dark.png" alt="VoidBox" className="w-5 h-5 text-white/80" />
                  ) : (
                    <img src="/light.png" alt="VoidBox" className="w-5 h-5 text-white/80" />
                  )}
                  <span className="text-lg font-semibold text-white">VoidBox</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Theme toggle next to close button */}
                  {toggleTheme && (
                    <ThemeToggle
                      theme={theme}
                      onToggle={toggleTheme}
                      ref={toggleRef}
                    />
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-white/10 focus:outline-none"
                    aria-label="Close Menu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <nav className="flex flex-col gap-1 flex-1 overflow-y-auto px-0">
                {navItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      onClick={() => handleNavClick(item.id)}
                      className={`flex items-center w-full transition-colors px-4 py-3 text-left text-base font-medium relative min-h-[48px] ${isActive
                          ? 'border-l-4 border-blue-400 rounded-l-full bg-white/10 text-white dark:text-blue-200'
                          : 'rounded-lg text-gray-200 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/10'
                        }`}
                      whileTap={{ scale: 0.96 }}
                    >
                      <Icon className="w-6 h-6 mr-3 text-white" />
                      <span className="flex-1 text-base font-medium" style={{ fontSize: 17 }}>{item.label}</span>
                    </motion.button>
                  );
                })}
                {/* Profile menu item after My Drops */}
                {user ? (
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: navItems.length * 0.08 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setProfileOpenProp(true)}
                    className="flex items-center py-3 px-4 w-full rounded-l-full hover:bg-white/10 mt-1 min-h-[48px]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>
                    <span className="text-base text-white font-medium">Profile</span>
                  </motion.button>
                ) : (
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: navItems.length * 0.08 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      if (triggerLoginModal) {
                        triggerLoginModal();
                      }
                      if (onClose) onClose();
                    }}
                    className="flex items-center py-3 px-4 w-full rounded-l-full hover:bg-white/10 mt-1 min-h-[48px]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10,17 15,12 10,7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                    <span className="text-base text-white font-medium">Login/Signup</span>
                  </motion.button>
                )}
                {/* Contact Support button */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (navItems.length + 1) * 0.08 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setContactSupportOpen(true);
                    if (onClose) onClose();
                  }}
                  className="flex items-center py-3 px-4 w-full rounded-l-full hover:bg-white/10 mt-1 min-h-[48px]"
                >
                  <MessageSquare className="w-6 h-6 mr-3 text-white" />
                  <span className="text-base text-white font-medium">Contact Support</span>
                </motion.button>
              </nav>
            </motion.div>
            {/* ProfileMenu modal for mobile */}
            {user && onSignOut && (
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    className="fixed inset-0 flex items-start justify-center pt-20 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ProfileMenu
                      open={profileOpen}
                      onClose={() => setProfileOpenProp(false)}
                      user={{
                        firstName: user.user_metadata?.first_name || '',
                        lastName: user.user_metadata?.last_name || '',
                        email: user.email || '',
                        createdAt: user.created_at || '',
                      }}
                      onSignOut={onSignOut}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </>
        )}

        {/* Contact Support Modal for Mobile */}
        <ContactSupport
          open={contactSupportOpen}
          onClose={() => setContactSupportOpen(false)}
          theme={theme}
        />
      </AnimatePresence>
    );
  }

  return (
    <>
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

          {/* Contact Support Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: navItems.length * 0.1 + 0.2 }}
            onClick={() => setContactSupportOpen(true)}
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors group relative text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="Contact Support"
          >
            <MessageSquare size={20} />
            {/* Tooltip */}
            <div className="absolute left-16 bg-gray-900 dark:bg-white text-white dark:text-black px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Contact Support
            </div>
          </motion.button>
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
                      firstName: user.user_metadata?.first_name || '',
                      lastName: user.user_metadata?.last_name || '',
                      email: user.email || '',
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

      {/* Contact Support Modal */}
      <ContactSupport
        open={contactSupportOpen}
        onClose={() => setContactSupportOpen(false)}
        theme={theme}
      />
    </>
  );
};

export default Sidebar;
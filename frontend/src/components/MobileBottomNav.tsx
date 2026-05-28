import React from 'react';
import { motion } from 'framer-motion';
import { Home, Upload, FileText, FolderOpen, LogIn, Settings } from 'lucide-react';
import { PageType } from '../types';

interface Props {
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  isSignedIn: boolean;
  onSignIn?: () => void;
}

const TABS: Array<{ id: PageType; icon: React.ComponentType<any>; label: string }> = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'library', icon: FolderOpen, label: 'Drops' },
  { id: 'upload', icon: Upload, label: 'Upload' },
  { id: 'text', icon: FileText, label: 'Notes' },
  { id: 'policies', icon: LogIn, label: 'Sign in' },
];

const MobileBottomNav: React.FC<Props> = ({ currentPage, onPageChange, isSignedIn, onSignIn }) => {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-gray-200 dark:border-white/10"
      style={{ fontFamily: 'system-ui, sans-serif', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          const isAuthSlot = tab.id === 'policies';
          const Icon = isAuthSlot ? (isSignedIn ? Settings : LogIn) : tab.icon;
          const label = isAuthSlot ? (isSignedIn ? 'Info' : 'Sign in') : tab.label;
          const active = isSignedIn ? currentPage === tab.id : !isAuthSlot && currentPage === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => {
                if (!isSignedIn && tab.id === 'policies') {
                  onSignIn?.();
                  return;
                }
                onPageChange(tab.id);
              }}
              whileTap={{ scale: 0.92 }}
              className="relative flex flex-col items-center justify-center flex-1 py-2 transition-colors"
            >
              <div
                className={`relative flex items-center justify-center w-11 h-7 rounded-2xl transition-colors ${
                  active
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-black'
                    : 'text-gray-500 dark:text-gray-500'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 2} />
              </div>
              <span
                className={`text-[10px] mt-1 font-medium transition-colors ${
                  active ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-500'
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;

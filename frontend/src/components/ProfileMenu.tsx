import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Calendar, AtSign } from 'lucide-react';

interface ProfileMenuProps {
  open: boolean;
  onClose: () => void;
  user: {
    firstName: string;
    lastName: string;
    username: string;
    photoUrl: string;
    createdAt: string;
  };
  onSignOut: () => void;
}

// Add a helper function for date formatting
function formatDateWithOrdinal(dateString: string) {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  const getOrdinal = (n: number) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  return `${day}${getOrdinal(day)} ${month} ${year}`;
}

const ProfileMenu: React.FC<ProfileMenuProps> = ({ open, onClose, user, onSignOut }) => {
  React.useEffect(() => {
    if (open) {
      document.body.classList.add('modal-open', 'overflow-hidden');
    } else {
      document.body.classList.remove('modal-open', 'overflow-hidden');
    }
    return () => {
      document.body.classList.remove('modal-open', 'overflow-hidden');
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Block background interaction/selection */}
          <div className="fixed inset-0 z-[99998] pointer-events-none select-none">
            <div className="absolute inset-0 bg-black/40" />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center"
            onClick={onClose}
            style={{ pointerEvents: 'auto' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed z-[99999] bg-white/70 dark:bg-black/70 super-blur border border-white/20 rounded-3xl shadow-2xl p-8 w-full max-w-md flex flex-col items-center"
              style={{ fontFamily: 'Inter, sans-serif', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', pointerEvents: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <button
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
              <div className="flex flex-col items-center mb-8">
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.firstName}
                    className="w-16 h-16 rounded-full object-cover mb-4 ring-2 ring-blue-400/50"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-3xl font-bold text-white mb-4 select-none">
                    {user.firstName[0]}{user.lastName?.[0] || ''}
                  </div>
                )}
                <div className="text-4xl font-normal text-gray-900 dark:text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {user.firstName} {user.lastName}
                </div>
              </div>
              <div className="space-y-5 mb-8 w-full">
                {user.username && (
                  <div className="flex items-center gap-4 bg-white/20 dark:bg-white/5 border border-white/20 rounded-xl px-6 py-5 w-full">
                    <AtSign size={28} className="text-gray-500 flex-shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-gray-900 dark:text-white mb-1">Telegram</span>
                      <span className="text-lg text-gray-800 dark:text-gray-200">@{user.username}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4 bg-white/20 dark:bg-white/5 border border-white/20 rounded-xl px-6 py-5 w-full">
                  <Calendar size={28} className="text-gray-500 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-gray-900 dark:text-white mb-1">Joined</span>
                    <span className="text-lg text-gray-800 dark:text-gray-200">{formatDateWithOrdinal(user.createdAt)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-white bg-red-600 hover:bg-red-700 font-semibold text-lg transition-colors mt-6 shadow-lg"
              >
                <LogOut size={20} />
                <span>Sign Out</span>
              </button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileMenu;
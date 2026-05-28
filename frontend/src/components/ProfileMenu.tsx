import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Calendar, AtSign, Mail, LinkIcon } from 'lucide-react';

interface ProfileMenuProps {
  open: boolean;
  onClose: () => void;
  user: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    photoUrl: string;
    createdAt: string;
    telegramLinked?: boolean;
  };
  onSignOut: () => void;
  onUnlinkTelegram?: () => Promise<void>;
  onLinkTelegram?: () => void;
}

function formatDateWithOrdinal(dateString: string) {
  if (!dateString) return '';
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

const ProfileMenu: React.FC<ProfileMenuProps> = ({ open, onClose, user, onSignOut, onUnlinkTelegram, onLinkTelegram }) => {
  const [photoError, setPhotoError] = React.useState(false);
  const [unlinking, setUnlinking] = React.useState(false);

  React.useEffect(() => {
    setPhotoError(false); // Reset on open
  }, [open]);

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

  const initials =
    (user.firstName?.[0] ?? '').toUpperCase() +
    (user.lastName?.[0] ?? '').toUpperCase();

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[99998] pointer-events-none select-none">
            <div className="absolute inset-0 bg-black/50 dark:bg-black/70" />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center px-4"
            onClick={onClose}
            style={{ pointerEvents: 'auto' }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              style={{ fontFamily: 'Inter, sans-serif' }}
              onClick={e => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-xl leading-none"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>

              <div className="flex flex-col items-center px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-900">
                {user.photoUrl && !photoError ? (
                  <img
                    src={user.photoUrl}
                    alt={user.firstName}
                    className="w-16 h-16 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-800 mb-4"
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-center text-xl font-medium text-gray-600 dark:text-gray-400 mb-4 select-none">
                    {initials || '?'}
                  </div>
                )}
                <h2
                  className="text-2xl font-normal text-gray-900 dark:text-white text-center"
                  style={{ fontFamily: 'Playfair Display, serif' }}
                >
                  {user.firstName} {user.lastName}
                </h2>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-900">
                {user.email && (
                  <div className="flex items-center gap-3 px-8 py-4">
                    <Mail size={15} className="text-gray-400 dark:text-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{user.email}</span>
                  </div>
                )}
                {user.username && (
                  <div className="flex items-center gap-3 px-8 py-4">
                    <AtSign size={15} className="text-gray-400 dark:text-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">@{user.username}</span>
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">Telegram</span>
                  </div>
                )}
                {user.createdAt && (
                  <div className="flex items-center gap-3 px-8 py-4">
                    <Calendar size={15} className="text-gray-400 dark:text-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{formatDateWithOrdinal(user.createdAt)}</span>
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">Joined</span>
                  </div>
                )}
              </div>

              <div className="px-8 pb-6 pt-4 space-y-2">
                {!user.telegramLinked && onLinkTelegram && (
                  <button
                    onClick={() => { onClose(); setTimeout(onLinkTelegram, 150); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-700 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-sm font-medium"
                  >
                    <LinkIcon size={14} />
                    Link Telegram
                  </button>
                )}
                {user.telegramLinked && onUnlinkTelegram && (
                  <button
                    onClick={async () => {
                      if (!confirm('Unlink Telegram? Secure Upload will be disabled and existing secure files will be inaccessible until you re-link.')) return;
                      setUnlinking(true);
                      await onUnlinkTelegram();
                      setUnlinking(false);
                      onClose();
                    }}
                    disabled={unlinking}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-orange-400 dark:hover:border-orange-700 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-all text-sm font-medium disabled:opacity-50"
                  >
                    <LinkIcon size={14} />
                    {unlinking ? 'Unlinking…' : 'Unlink Telegram'}
                  </button>
                )}
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-red-400 dark:hover:border-red-800 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all text-sm font-medium"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileMenu;

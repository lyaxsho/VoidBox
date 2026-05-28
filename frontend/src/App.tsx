import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import HomePage from './components/HomePage';
import UploadPage from './components/UploadPage';
import TextDropPage from './components/TextDropPage';
import LibraryPage from './components/LibraryPage';
import FilePreviewPage from './components/FilePreviewPage';
import PoliciesPage from './components/PoliciesPage';
import LoginPage from './components/LoginPage';
import LinkTelegramModal from './components/LinkTelegramModal';
import ThemeToggle from './components/ThemeToggle';
import { useUserFiles } from './hooks/useLocalStorage';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { PageType, FileItem } from './types';
import ProfileMenu from './components/ProfileMenu';
import VerifyEmailPage from './components/VerifyEmailPage';
import MagicLinkPage from './components/MagicLinkPage';
import AdminPage from './components/AdminPage';
import GlobalDropOverlay from './components/GlobalDropOverlay';
import MobileBottomNav from './components/MobileBottomNav';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';

function PublicFilePreview({ theme, user }: { theme: 'dark' | 'light'; user: any }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  return (
    <FilePreviewPage
      file={{ id: slug!, name: '', type: 'file', uploadedAt: new Date(), slug }}
      onPageChange={() => navigate(user ? '/library' : '/')}
      theme={theme}
    />
  );
}

const PAGE_PATHS: Record<PageType, string> = {
  home: '/',
  upload: '/upload',
  text: '/text',
  library: '/library',
  preview: '/preview',
  policies: '/policies',
};

function pathToPage(pathname: string): PageType {
  if (pathname.startsWith('/upload')) return 'upload';
  if (pathname.startsWith('/text')) return 'text';
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/file/')) return 'library';
  if (pathname.startsWith('/preview')) return 'preview';
  if (pathname.startsWith('/policies')) return 'policies';
  return 'home';
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage: PageType = pathToPage(location.pathname);
  const [selectedFile, setSelectedFile] = useState<FileItem | undefined>();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { files, setUserFiles, fetchUserFiles, loading: filesLoading, hasFetched: filesFetched } = useUserFiles();
  const {
    user,
    loading,
    signUp,
    signIn,
    checkEmail,
    resendVerification,
    requestMagicLink,
    setSecureUpload,
    unlinkTelegram,
    sendLinkCode,
    verifyLinkCode,
    verifyLink2FA,
    signOut,
  } = useAuth();
  const [showLinkTelegram, setShowLinkTelegram] = useState(false);
  const { theme, toggleTheme: baseToggleTheme } = useTheme();
  // Add profileOpen state to App
  const [profileOpen, setProfileOpen] = useState(false);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
  const welcomeShownRef = useRef(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [pendingDropFile, setPendingDropFile] = useState<File | null>(null);

  const handleGlobalDrop = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setPendingDropFile(files[0]);
    if (location.pathname !== '/upload') navigate('/upload');
  }, [location.pathname, navigate]);

  // Add a function to allow children to trigger the login modal (must be before any return)
  const triggerLoginModal = useCallback(() => setShowLoginModal(true), []);

  // Modified toggleTheme to show overlay from button position
  const toggleTheme = useCallback(() => {
    baseToggleTheme();
  }, [baseToggleTheme]);

  const handlePageChange = (page: PageType) => {
    if (page !== 'preview') setSelectedFile(undefined);
    navigate(PAGE_PATHS[page]);
  };

  const handleFileSelect = (file: FileItem) => {
    if (!user) {
      triggerLoginModal();
      return;
    }
    const slug = (file as any).slug || file.id;
    navigate(`/file/${slug}`);
  };

  const handleFileAdd = async (file: any) => {

    if (!user) {
      if (triggerLoginModal) triggerLoginModal();
      return;
    }
    // Upload file with user_id
    await fetchUserFiles(user.id); // Refetch after upload
  };

  const handleSignOut = async () => {

    const { error } = await signOut();
    if (error) {
      console.error('Sign out failed:', error.message);
    } else {
      setUserFiles([]); // Clear mydrops on logout
      setProfileOpen(false); // Close profile modal on sign out
      navigate('/');
      welcomeShownRef.current = false; // Reset welcome overlay for next login
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    setJustLoggedIn(true); // Set flag on successful login
    // If user was trying to access a protected page, navigate there
    if (["upload", "text", "library"].includes(currentPage)) {
      // Page will be accessible now that user is logged in
    }
  };
  useEffect(() => {
    if (
      justLoggedIn &&
      user?.first_name &&
      showLoginModal === false
    ) {
      setShowWelcomeOverlay(true);
      welcomeShownRef.current = true;
      const timeout = setTimeout(() => {
        setShowWelcomeOverlay(false);
        setJustLoggedIn(false); // Reset flag after overlay
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [justLoggedIn, user, showLoginModal]);
  useEffect(() => {
    if (user && user.id) {
      fetchUserFiles(user.id);
    } else {
      setUserFiles([]);
    }
  }, [user]);

  // Global keyboard shortcuts: Esc to close modals, g+<key> to navigate
  useEffect(() => {
    let lastG = 0;
    const isTyping = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };
    const handler = (e: KeyboardEvent) => {
      // Esc: close any open modal
      if (e.key === 'Escape') {
        if (showLoginModal) { setShowLoginModal(false); return; }
        if (showLinkTelegram) { setShowLinkTelegram(false); return; }
        if (profileOpen) { setProfileOpen(false); return; }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      // g + <letter> sequence
      if (e.key === 'g') {
        lastG = Date.now();
        return;
      }
      if (Date.now() - lastG < 1000) {
        const map: Record<string, string> = { l: '/library', u: '/upload', t: '/text', h: '/', p: '/policies' };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          lastG = 0;
          navigate(dest);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showLoginModal, showLinkTelegram, profileOpen, navigate]);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-gray-300 dark:border-gray-700 border-t-gray-900 dark:border-t-white rounded-full"
        />
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onPageChange={handlePageChange} theme={theme} isMenuOpen={profileOpen} />;
      case 'upload':
        return (
          <UploadPage
            onPageChange={handlePageChange}
            onFileAdd={handleFileAdd}
            theme={theme}
            user={user}
            triggerLoginModal={triggerLoginModal}
            onSetSecureUpload={setSecureUpload}
            onRequestLinkTelegram={() => setShowLinkTelegram(true)}
            pendingDropFile={pendingDropFile}
            onConsumePendingDrop={() => setPendingDropFile(null)}
          />
        );
      case 'text':
        return (
          <TextDropPage onPageChange={handlePageChange} onFileAdd={handleFileAdd} theme={theme} user={user} triggerLoginModal={triggerLoginModal} />
        );
      case 'library':
        return (
          <LibraryPage
            files={files}
            onPageChange={handlePageChange}
            onFileSelect={handleFileSelect}
            onFileDelete={() => { }} // No deleteFile from useUserFiles
            theme={theme}
            user={user}
            triggerLoginModal={triggerLoginModal}
            fetchUserFiles={fetchUserFiles}
            filesLoading={filesLoading}
            filesFetched={filesFetched}
          />
        );
      case 'preview':
        if (!selectedFile) {
          return <div className="p-8 text-center text-red-500">No file selected for preview.</div>;
        }
        if (!user) {
          return <div className="p-8 text-center text-red-500">You must be logged in to preview files.</div>;
        }
        return <FilePreviewPage file={selectedFile} onPageChange={handlePageChange} theme={theme} />;
      case 'policies':
        return <PoliciesPage />;
      default:
        return <HomePage onPageChange={handlePageChange} theme={theme} />;
    }
  };

  return (
    <div className="bg-white dark:bg-black min-h-screen transition-colors flex flex-col min-h-screen">
      <GlobalDropOverlay onFiles={handleGlobalDrop} />
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/magic-link" element={<MagicLinkPage />} />
        <Route path="/admin" element={<AdminPage currentUser={user} />} />
        <Route path="*" element={
          <>
            <AnimatePresence>
              {showWelcomeOverlay && user?.first_name && (
                <motion.div
                  key="welcome-overlay"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  transition={{ duration: 1.5, ease: [0.77, 0, 0.175, 1] }}
                  className="fixed inset-0 z-[99999] flex items-center justify-center bg-black pointer-events-auto select-none"
                >
                  <span
                    className="pointer-events-auto select-none text-4xl md:text-6xl font-normal text-white"
                    style={{ fontFamily: 'Playfair Display, serif' }}
                  >
                    Welcome, {user.first_name}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {showLoginModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-6"
                  style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                  onClick={() => setShowLoginModal(false)}
                >
                  <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
                    <LoginPage
                      onSignIn={signIn}
                      onSignUp={signUp}
                      onCheckEmail={checkEmail}
                      onResendVerification={resendVerification}
                      onRequestMagicLink={requestMagicLink}
                      onClose={handleLoginSuccess}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showLinkTelegram && user && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-6"
                  onClick={() => setShowLinkTelegram(false)}
                >
                  <motion.div onClick={(e) => e.stopPropagation()}>
                    <LinkTelegramModal
                      onSendCode={sendLinkCode}
                      onVerifyCode={verifyLinkCode}
                      onVerify2FA={verifyLink2FA}
                      onSuccess={async () => {
                        await setSecureUpload(true);
                      }}
                      onClose={() => setShowLinkTelegram(false)}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="lg:hidden fixed top-0 left-0 right-0 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 p-4 z-30">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {theme === 'dark' ? (
                    <img src="/dark.png" alt="VoidBox" className="w-8 h-8" />
                  ) : (
                    <img src="/light.png" alt="VoidBox" className="w-8 h-8" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <ThemeToggle theme={theme} onToggle={toggleTheme} />
                  {user ? (
                    <button
                      onClick={() => setProfileOpen(true)}
                      className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10"
                      title="Profile"
                    >
                      {user.photo_url ? (
                        <img src={user.photo_url} alt={user.first_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {(user.first_name?.[0] || '').toUpperCase()}
                        </span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={triggerLoginModal}
                      className="px-3 h-9 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-semibold"
                    >
                      Sign in
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <Sidebar
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onSignOut={user ? handleSignOut : undefined}
                theme={theme}
                user={user}
                triggerLoginModal={triggerLoginModal}
                toggleTheme={toggleTheme}
                toggleRef={toggleRef}
                setProfileOpen={setProfileOpen}
                profileOpen={profileOpen}
                onUnlinkTelegram={user ? async () => { await unlinkTelegram(); } : undefined}
                onLinkTelegram={user ? () => setShowLinkTelegram(true) : undefined}
              />
            </div>

            <MobileBottomNav
              currentPage={currentPage}
              onPageChange={handlePageChange}
              isSignedIn={!!user}
              onSignIn={triggerLoginModal}
            />

            <div className="lg:ml-20 pt-16 lg:pt-0 pb-20 lg:pb-0 flex-1">
              <Routes>
                <Route path="/file/:slug" element={<PublicFilePreview theme={theme} user={user} />} />
                <Route path="*" element={
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentPage}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {renderPage()}
                    </motion.div>
                  </AnimatePresence>
                } />
              </Routes>
            </div>

            {profileOpen && (
              <div className="fixed inset-0 z-[99999] flex items-center justify-center">
                <ProfileMenu
                  open={profileOpen}
                  onClose={() => setProfileOpen(false)}
                  user={user ? {
                    firstName: user.first_name || '',
                    lastName: user.last_name || '',
                    username: user.username || '',
                    email: user.email || '',
                    photoUrl: user.photo_url || '',
                    createdAt: user.created_at || '',
                    telegramLinked: user.telegram_linked,
                  } : { firstName: '', lastName: '', username: '', email: '', photoUrl: '', createdAt: '' }}
                  onSignOut={user ? handleSignOut : () => { }}
                  onUnlinkTelegram={user ? async () => { await unlinkTelegram(); } : undefined}
                  onLinkTelegram={user ? () => setShowLinkTelegram(true) : undefined}
                />
              </div>
            )}
          </>
        } />
      </Routes>
    </div>
  );
}

export default App;
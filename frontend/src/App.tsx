import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import HomePage from './components/HomePage';
import UploadPage from './components/UploadPage';
import TextDropPage from './components/TextDropPage';
import LibraryPage from './components/LibraryPage';
import FilePreviewPage from './components/FilePreviewPage';
import PoliciesPage from './components/PoliciesPage';
import LoginPage from './components/LoginPage';
import ThemeToggle from './components/ThemeToggle';
import { useUserFiles } from './hooks/useLocalStorage';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { PageType, FileItem } from './types';
import ProfileMenu from './components/ProfileMenu';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [selectedFile, setSelectedFile] = useState<FileItem | undefined>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { files, setUserFiles, fetchUserFiles } = useUserFiles();
  const { user, loading, sendCode, verifyCode, verify2FA, signOut } = useAuth();
  const { theme, toggleTheme: baseToggleTheme } = useTheme();
  // Add profileOpen state to App
  const [profileOpen, setProfileOpen] = useState(false);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);
  const welcomeShownRef = useRef(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // Add a function to allow children to trigger the login modal (must be before any return)
  const triggerLoginModal = useCallback(() => setShowLoginModal(true), []);

  // Modified toggleTheme to show overlay from button position
  const toggleTheme = useCallback(() => {
    baseToggleTheme();
  }, [baseToggleTheme]);

  const handlePageChange = (page: PageType) => {
    setCurrentPage(page);
    if (page !== 'preview') {
      setSelectedFile(undefined);
    }
    if (typeof window !== 'undefined') {
      window.location.hash = `#${page}`;
    }
  };

  const handleFileSelect = (file: FileItem) => {

    if (!user) {
      if (triggerLoginModal) triggerLoginModal();
      return;
    }
    setSelectedFile(file);
    setCurrentPage('preview');
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
      setCurrentPage('home');
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
          <UploadPage onPageChange={handlePageChange} onFileAdd={handleFileAdd} theme={theme} user={user} triggerLoginModal={triggerLoginModal} />
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

  // Utility to get the screen diagonal



  const PublicFilePreviewPageWithTheme = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    return <FilePreviewPage file={{ id: slug!, name: '', type: 'file', uploadedAt: new Date(), slug }} onPageChange={() => navigate('/')} theme={theme} />;
  };
  return (
    <div className="bg-white dark:bg-black min-h-screen transition-colors flex flex-col min-h-screen">
      <Routes>
        <Route path="/file/:slug" element={<PublicFilePreviewPageWithTheme />} />
        <Route path="*" element={
          <>
            {/* Welcome Overlay */}
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
            {/* Login Modal — Telegram Login Widget */}
            <AnimatePresence>
              {showLoginModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6"
                  onClick={() => setShowLoginModal(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md"
                  >
                    <LoginPage
                      onSendCode={sendCode}
                      onVerifyCode={verifyCode}
                      onVerify2FA={verify2FA}
                      theme={theme}
                      onClose={handleLoginSuccess}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-900 p-4 z-30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {theme === 'dark' ? (
                    <img src="/dark.png" alt="VoidBox" className="w-8 h-8" />
                  ) : (
                    <img src="/light.png" alt="VoidBox" className="w-8 h-8" />
                  )}
                  <h1 className="text-gray-900 dark:text-white font-bold text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>VoidBox</h1>
                </div>
                <div className="flex items-center space-x-3">
                  <ThemeToggle theme={theme} onToggle={toggleTheme} />
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Logo - Desktop */}
            {/* Desktop Sidebar */}
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
              />
            </div>

            {/* Mobile Sidebar */}
            <Sidebar
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onSignOut={user ? handleSignOut : undefined}
              isMobile={true}
              isOpen={isMobileMenuOpen}
              onClose={() => setIsMobileMenuOpen(false)}
              theme={theme}
              user={user}
              triggerLoginModal={triggerLoginModal}
              toggleTheme={toggleTheme}
              toggleRef={toggleRef}
            />

            {/* Main Content */}
            <div className="lg:ml-20 pt-16 lg:pt-0 flex-1">
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
            </div>

            {/* Mobile FAB for Upload */}
            <AnimatePresence>
              {currentPage !== 'upload' && currentPage !== 'text' && !profileOpen && (
                <motion.button
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  onClick={() => handlePageChange('upload')}
                  className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center shadow-lg z-10"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="text-2xl font-bold">+</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Render ProfileMenu overlay at the root, above all content, when open */}
            {profileOpen && (
              <div className="fixed inset-0 z-[99999] flex items-center justify-center">
                <ProfileMenu
                  open={profileOpen}
                  onClose={() => setProfileOpen(false)}
                  user={user ? {
                    firstName: user.first_name || '',
                    lastName: user.last_name || '',
                    username: user.username || '',
                    photoUrl: user.photo_url || '',
                    createdAt: user.created_at || '',
                  } : { firstName: '', lastName: '', username: '', photoUrl: '', createdAt: '' }}
                  onSignOut={user ? handleSignOut : () => { }}
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
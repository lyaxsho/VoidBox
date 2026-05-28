import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { BASE_URL } from '../lib/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(3);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    fetch(`${BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.token && data.user) {
            localStorage.setItem('voidbox_token', data.token);
            localStorage.setItem('voidbox_user', JSON.stringify(data.user));
          }
          setStatus('success');
          setMessage('Your email has been verified.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Invalid or expired verification link.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      });
  }, []);

  // Auto-redirect countdown after success
  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) { window.location.href = '/'; return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [status, countdown]);

  return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-10 text-center"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {status === 'loading' && (
          <>
            <Loader size={36} className="mx-auto mb-5 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-500">Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={36} className="mx-auto mb-5 text-emerald-500" />
            <h2
              className="text-2xl font-normal text-gray-900 dark:text-white mb-2"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Email verified
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-1">{message}</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mb-6">
              Redirecting in {countdown}s…
            </p>
            <motion.button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-bold"
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.01 }}
            >
              Go to VoidBox
            </motion.button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={36} className="mx-auto mb-5 text-red-500" />
            <h2
              className="text-2xl font-normal text-gray-900 dark:text-white mb-2"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Verification failed
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">{message}</p>
            <motion.button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium"
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.01 }}
            >
              Back to home
            </motion.button>
          </>
        )}
      </motion.div>
    </div>
  );
}

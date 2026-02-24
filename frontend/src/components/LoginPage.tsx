import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginPageProps {
  onSendCode: (phoneNumber: string) => Promise<{ error: { message: string } | null; data: { phoneCodeHash: string; timeout: number; tempToken: string } | null }>;
  onVerifyCode: (phoneNumber: string, phoneCode: string, phoneCodeHash: string, tempToken: string) => Promise<{ error: { message: string } | null; data: { requiresPassword?: boolean; tempToken?: string; user?: unknown } | null }>;
  onVerify2FA: (password: string, tempToken: string) => Promise<{ error: { message: string } | null }>;
  theme: 'dark' | 'light';
  onClose?: () => void;
}

type LoginStep = 'phone' | 'otp' | '2fa';

const LoginPage: React.FC<LoginPageProps> = ({
  onSendCode,
  onVerifyCode,
  onVerify2FA,
  onClose,
}) => {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const otpInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Focus OTP input when step changes
  useEffect(() => {
    if (step === 'otp' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
    if (step === '2fa' && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [step]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }
    setLoading(true);
    setError('');

    const { error: err, data } = await onSendCode(phoneNumber);
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setPhoneCodeHash(data!.phoneCodeHash);
    setTempToken(data!.tempToken);
    setCountdown(data!.timeout || 60);
    setStep('otp');
  };

  const handleVerifyCode = async () => {
    if (!phoneCode.trim()) {
      setError('Please enter the code');
      return;
    }
    setLoading(true);
    setError('');

    const { error: err, data } = await onVerifyCode(
      phoneNumber,
      phoneCode,
      phoneCodeHash,
      tempToken,
    );
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    if (data?.requiresPassword) {
      setTempToken(data!.tempToken || '');
      setStep('2fa');
      return;
    }

    // Login successful
    if (onClose) onClose();
  };

  const handleVerify2FA = async () => {
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }
    setLoading(true);
    setError('');

    const { error: err } = await onVerify2FA(password, tempToken);
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    // Login successful
    if (onClose) onClose();
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    setPhoneCode('');

    const { error: err, data } = await onSendCode(phoneNumber);
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setPhoneCodeHash(data!.phoneCodeHash);
    setTempToken(data!.tempToken);
    setCountdown(data!.timeout || 60);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') action();
  };

  return (
    <div className="flex items-center justify-center p-6 bg-white/60 dark:bg-black/60 backdrop-blur-sm rounded-3xl overflow-hidden py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative"
      >
        {onClose && (
          <motion.button
            onClick={onClose}
            className="absolute top-0 right-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors z-10"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            ✕
          </motion.button>
        )}

        <div className="text-center mb-4">
          <h1
            className="text-3xl font-light text-gray-900 dark:text-white mb-2"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Welcome to VoidBox
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {step === 'phone' && 'Sign in with your Telegram account'}
            {step === 'otp' && 'Enter the code sent to your Telegram'}
            {step === '2fa' && 'Enter your two-factor password'}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl p-8 bg-white/70 dark:bg-black/90 shadow-xl backdrop-blur-sm"
        >
          {/* Telegram icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Phone Number */}
            {step === 'phone' && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleSendCode)}
                    placeholder="+1 234 567 8900"
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-lg tracking-wider"
                    autoFocus
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Include country code (e.g. +1 for US, +91 for India)
                  </p>
                </div>

                <motion.button
                  onClick={handleSendCode}
                  disabled={loading || !phoneNumber.trim()}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending code...</span>
                    </div>
                  ) : (
                    'Send Code'
                  )}
                </motion.button>
              </motion.div>
            )}

            {/* Step 2: OTP Code */}
            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Verification Code
                  </label>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => handleKeyDown(e, handleVerifyCode)}
                    placeholder="12345"
                    maxLength={6}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-2xl text-center tracking-[0.5em] font-mono"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    Check your Telegram app for the code
                  </p>
                </div>

                <motion.button
                  onClick={handleVerifyCode}
                  disabled={loading || !phoneCode.trim()}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    'Verify'
                  )}
                </motion.button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    onClick={() => {
                      setStep('phone');
                      setPhoneCode('');
                      setError('');
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    ← Change number
                  </button>
                  <button
                    onClick={handleResend}
                    disabled={countdown > 0 || loading}
                    className="text-blue-500 hover:text-blue-600 disabled:text-gray-400 transition-colors"
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: 2FA Password */}
            {step === '2fa' && (
              <motion.div
                key="2fa"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Two-Factor Password
                  </label>
                  <input
                    ref={passwordInputRef}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleVerify2FA)}
                    placeholder="Enter your 2FA password"
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-colors text-lg"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Your account has two-factor authentication enabled
                  </p>
                </div>

                <motion.button
                  onClick={handleVerify2FA}
                  disabled={loading || !password.trim()}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    'Sign In'
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error message */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-sm text-center mt-4"
            >
              {error}
            </motion.p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
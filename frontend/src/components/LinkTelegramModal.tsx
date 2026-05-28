import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, KeyRound, Lock, Pencil } from 'lucide-react';

interface LinkTelegramModalProps {
  onSendCode: (phone: string) => Promise<{
    error: { message: string } | null;
    data: { phoneCodeHash: string; timeout: number; tempToken: string } | null;
  }>;
  onVerifyCode: (
    phone: string,
    code: string,
    hash: string,
    tempToken: string
  ) => Promise<{
    error: { message: string } | null;
    data: { requiresPassword?: boolean; tempToken?: string } | null;
  }>;
  onVerify2FA: (password: string, tempToken: string) => Promise<{ error: { message: string } | null }>;
  onSuccess: () => void;
  onClose: () => void;
}

type Step = 'phone' | 'otp' | '2fa';

const inputClass =
  'w-full py-3.5 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-white font-medium placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-gray-500 dark:focus:border-gray-500 transition-colors text-base';

export default function LinkTelegramModal({
  onSendCode,
  onVerifyCode,
  onVerify2FA,
  onSuccess,
  onClose,
}: LinkTelegramModalProps) {
  const [step, setStep] = useState<Step>('phone');
  const [show2FATab, setShow2FATab] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  useEffect(() => {
    if (step === 'otp') otpRef.current?.focus();
  }, [step]);

  const visibleSteps: Step[] = show2FATab ? ['phone', 'otp', '2fa'] : ['phone', 'otp'];
  const stepIndex = visibleSteps.indexOf(step);

  const STEP_LABELS: Record<Step, string> = { phone: 'Phone', otp: 'Code', '2fa': '2FA' };

  const handleSend = async () => {
    if (!phoneNumber.trim()) {
      setError('Enter your phone number with country code (e.g. +1...)');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err, data } = await onSendCode(phoneNumber);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setPhoneCodeHash(data!.phoneCodeHash);
    setTempToken(data!.tempToken);
    setCountdown(data!.timeout || 60);
    setStep('otp');
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    const { error: err, data } = await onVerifyCode(phoneNumber, phoneCode, phoneCodeHash, tempToken);
    setLoading(false);
    if (err) { setError(err.message); return; }
    if (data?.requiresPassword) {
      setTempToken(data.tempToken!);
      setShow2FATab(true);
      setStep('2fa');
      return;
    }
    onSuccess();
    onClose();
  };

  const handle2FA = async () => {
    setLoading(true);
    setError('');
    const { error: err } = await onVerify2FA(password, tempToken);
    setLoading(false);
    if (err) { setError(err.message); return; }
    onSuccess();
    onClose();
  };

  const handleChangeNumber = () => {
    setStep('phone');
    setPhoneCode('');
    setPhoneCodeHash('');
    setTempToken('');
    setCountdown(0);
    setError('');
    setShow2FATab(false);
  };

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.96, opacity: 0, y: 8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="relative bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-xl leading-none z-10"
      >
        ×
      </button>

      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-900">
        <h2
          className="text-3xl font-normal text-gray-900 dark:text-white mb-1"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Link Telegram
        </h2>
        <p className="text-sm font-medium text-gray-400 dark:text-gray-600">
          Enables Secure Upload — files stored in your private channel
        </p>
      </div>

      <div className="flex border-b border-gray-100 dark:border-gray-900">
        {visibleSteps.map((s, i) => {
          const isCompleted = i < stepIndex;
          const isClickable = s === 'phone' && step === 'otp';
          return (
            <div
              key={s}
              className={`flex-1 relative ${isClickable ? 'cursor-pointer group/phonetab' : ''}`}
              onClick={isClickable ? handleChangeNumber : undefined}
            >
              <div className={`py-3 text-center text-sm font-semibold transition-colors flex items-center justify-center gap-1 ${
                i === stepIndex
                  ? 'text-gray-900 dark:text-white'
                  : isCompleted
                    ? 'text-gray-400 dark:text-gray-600'
                    : 'text-gray-300 dark:text-gray-700'
              }`}>
                <span className={isClickable ? 'group-hover/phonetab:text-blue-500 dark:group-hover/phonetab:text-blue-400 transition-colors' : ''}>
                  {STEP_LABELS[s]}
                </span>
                {isClickable && (
                  <Pencil
                    size={11}
                    className="opacity-0 group-hover/phonetab:opacity-100 text-blue-500 dark:text-blue-400 transition-opacity"
                  />
                )}
              </div>
              {i === stepIndex && (
                <motion.div
                  layoutId="tg-step-underline"
                  className="absolute bottom-0 left-0 right-0 h-px bg-gray-900 dark:bg-white"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="px-8 py-6 space-y-4">
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm font-medium text-red-500 text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 'phone' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Enter your Telegram phone number with country code.
              </p>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700" size={16} />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="+1 234 567 8900"
                  className={`${inputClass} pl-9`}
                  autoFocus
                />
              </div>
              <motion.button
                onClick={handleSend}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 transition-opacity"
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
              >
                {loading ? 'Sending…' : 'Send code'}
              </motion.button>
            </motion.div>
          )}

          {step === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Enter the code Telegram sent to{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-300">{phoneNumber}</span>.
              </p>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700" size={16} />
                <input
                  ref={otpRef}
                  type="text"
                  inputMode="numeric"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  placeholder="12345"
                  className={`${inputClass} pl-9 tracking-[0.3em]`}
                />
              </div>
              <motion.button
                onClick={handleVerify}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 transition-opacity"
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
              >
                {loading ? 'Verifying…' : 'Verify & link'}
              </motion.button>
              <button
                type="button"
                disabled={countdown > 0 || loading}
                onClick={handleSend}
                className="w-full text-sm font-medium text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 disabled:opacity-40 transition-colors py-1"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
              </button>
            </motion.div>
          )}

          {step === '2fa' && (
            <motion.div
              key="2fa"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Your account has Two-Step Verification enabled. Enter your Telegram password.
              </p>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handle2FA()}
                  placeholder="Telegram 2FA password"
                  className={`${inputClass} pl-9`}
                  autoFocus
                />
              </div>
              <motion.button
                onClick={handle2FA}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 transition-opacity"
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
              >
                {loading ? 'Verifying…' : 'Confirm'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

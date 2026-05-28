import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User as UserIcon, ArrowLeft } from 'lucide-react';

interface LoginPageProps {
  onSignIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  onSignUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ) => Promise<{ error: { message: string } | null; data?: { message?: string } }>;
  onCheckEmail: (email: string) => Promise<{ exists: boolean } | { error: string }>;
  onResendVerification: (email: string) => Promise<{ message?: string; error?: string }>;
  onRequestMagicLink?: (email: string) => Promise<{ message?: string; error?: string }>;
  onClose?: () => void;
}

type Step = 'email' | 'signin' | 'signup' | 'verify';

const inputClass =
  'w-full py-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black text-gray-900 dark:text-white font-medium placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-gray-500 dark:focus:border-gray-500 transition-colors text-base';

function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string; hint: string } {
  if (!pw) return { score: 0, label: '', color: '', hint: '' };
  let score = 0;
  const length = pw.length;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (length >= 8) score++;
  if (length >= 12) score++;
  if (variety >= 2) score++;
  if (variety >= 3) score++;
  if (variety === 4 && length >= 12) score = 4;
  // Common patterns dragging score down
  if (/^[a-zA-Z]+$/.test(pw) && length < 12) score = Math.min(score, 1);
  if (/^(password|qwerty|12345|admin|letmein)/i.test(pw)) score = 0;
  const presets: Array<{ label: string; color: string; hint: string }> = [
    { label: 'Too weak', color: 'bg-red-500', hint: 'Add length and variety.' },
    { label: 'Weak', color: 'bg-orange-500', hint: 'Mix letters, numbers, symbols.' },
    { label: 'Fair', color: 'bg-amber-500', hint: 'Make it 12+ chars or add symbols.' },
    { label: 'Strong', color: 'bg-emerald-500', hint: 'Looks good.' },
    { label: 'Excellent', color: 'bg-emerald-500', hint: '' },
  ];
  const s = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  return { score: s, ...presets[s] };
}

const LoginPage: React.FC<LoginPageProps> = ({ onSignIn, onSignUp, onCheckEmail, onResendVerification, onRequestMagicLink, onClose }) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendInfo, setResendInfo] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicInfo, setMagicInfo] = useState('');
  const [magicCooldown, setMagicCooldown] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'signin') passwordRef.current?.focus();
    if (step === 'signup') firstNameRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  useEffect(() => {
    if (magicCooldown <= 0) return;
    const id = setTimeout(() => setMagicCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [magicCooldown]);

  const handleSendMagic = async () => {
    if (!onRequestMagicLink || !email || magicCooldown > 0) return;
    setMagicLoading(true);
    setMagicInfo('');
    const { message, error: err } = await onRequestMagicLink(email);
    setMagicLoading(false);
    if (err) {
      setMagicInfo(err);
    } else {
      setMagicInfo(message || 'Check your inbox for a sign-in link.');
      setMagicCooldown(30);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const result = await onCheckEmail(email.trim());
    setLoading(false);
    if ('error' in result) { setError(result.error); return; }
    setStep(result.exists ? 'signin' : 'signup');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResendInfo('');
    setResendError('');
    const { error: err } = await onSignIn(email, password);
    setLoading(false);
    if (err) setError(err.message);
    else onClose?.();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err, data } = await onSignUp(email, password, firstName, lastName);
    setLoading(false);
    if (err) { setError(err.message); return; }
    if (data?.message) {
      setStep('verify');
    } else {
      onClose?.();
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendInfo('');
    setResendError('');
    const result = await onResendVerification(email);
    setResendLoading(false);
    if (result.error) {
      setResendError(result.error);
    } else {
      setResendInfo(result.message || 'Verification email sent.');
      setResendCooldown(30);
    }
  };

  const goBack = () => {
    setStep('email');
    setPassword('');
    setError('');
    setResendInfo('');
    setResendError('');
    setResendCooldown(0);
  };

  const isUnverifiedError = error.toLowerCase().includes('verify your email');

  const heading =
    step === 'email' ? 'Welcome to VoidBox' :
    step === 'signin' ? 'Welcome back' :
    step === 'signup' ? 'Create account' :
    'Verify Your Email';

  const subheading =
    step === 'verify'
      ? 'Check your inbox and click the link to activate your account.'
      : 'No third-party account required';

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.96, opacity: 0, y: 8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="relative bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {onClose && step !== 'verify' && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-xl leading-none z-10"
        >
          ×
        </button>
      )}

      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-900 text-center">
        <AnimatePresence mode="wait">
          <motion.h1
            key={heading}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="text-3xl font-normal text-gray-900 dark:text-white mb-1"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            {heading}
          </motion.h1>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.p
            key={subheading}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-sm text-gray-400 dark:text-gray-600 font-medium"
          >
            {subheading}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="px-8 py-6">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 space-y-1.5 text-center"
            >
              <p className="text-sm font-medium text-red-500">{error}</p>
              {isUnverifiedError && (
                <>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || resendLoading}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2 transition-colors disabled:opacity-40"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : resendLoading ? 'Sending…' : 'Resend verification email'}
                  </button>
                  {resendInfo && <p className="text-xs text-emerald-500">{resendInfo}</p>}
                  {resendError && <p className="text-xs text-red-400">{resendError}</p>}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {step === 'email' && (
            <motion.form
              key="email-step"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleEmailSubmit}
              className="space-y-3"
            >
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700" size={15} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoFocus
                  className={`${inputClass} pl-9 pr-3`}
                />
              </div>
              <motion.button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 transition-opacity"
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
              >
                {loading ? 'Checking…' : 'Continue'}
              </motion.button>
            </motion.form>
          )}

          {step === 'signin' && (
            <motion.form
              key="signin-step"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSignIn}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                <Mail size={13} className="text-gray-400 dark:text-gray-600 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{email}</span>
                <button type="button" onClick={goBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0">
                  <ArrowLeft size={11} /> change
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700" size={15} />
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className={`${inputClass} pl-9 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 transition-opacity"
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </motion.button>

              {onRequestMagicLink && (
                <>
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
                    <span className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-600 font-medium">or</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendMagic}
                    disabled={magicLoading || magicCooldown > 0}
                    className="w-full py-3.5 rounded-xl bg-transparent border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm font-semibold hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
                  >
                    {magicLoading
                      ? 'Sending…'
                      : magicCooldown > 0
                        ? `Resend in ${magicCooldown}s`
                        : 'Email me a sign-in link'}
                  </button>
                  {magicInfo && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 text-center -mt-1" style={{ fontFamily: 'system-ui, sans-serif' }}>
                      {magicInfo}
                    </p>
                  )}
                </>
              )}
            </motion.form>
          )}

          {step === 'signup' && (
            <motion.form
              key="signup-step"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSignUp}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                <Mail size={13} className="text-gray-400 dark:text-gray-600 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{email}</span>
                <button type="button" onClick={goBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0">
                  <ArrowLeft size={11} /> change
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700" size={15} />
                  <input
                    ref={firstNameRef}
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    className={`${inputClass} pl-9 pr-3`}
                  />
                </div>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className={`${inputClass} px-3`}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700" size={15} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password (min 8 chars)"
                  required
                  minLength={8}
                  className={`${inputClass} pl-9 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {password && (() => {
                const s = scorePassword(password);
                return (
                  <div className="-mt-2 px-1 space-y-1.5" style={{ fontFamily: 'system-ui, sans-serif' }}>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`flex-1 h-1 rounded-full transition-colors ${
                            i < s.score ? s.color : 'bg-gray-200 dark:bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-semibold ${
                        s.score >= 3 ? 'text-emerald-600 dark:text-emerald-400'
                        : s.score === 2 ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                      }`}>{s.label}</span>
                      <span className="text-gray-500 dark:text-gray-500">{s.hint}</span>
                    </div>
                  </div>
                );
              })()}
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-base font-bold disabled:opacity-40 transition-opacity"
                whileTap={{ scale: 0.98 }}
                whileHover={{ scale: 1.01 }}
              >
                {loading ? 'Creating account…' : 'Create account'}
              </motion.button>
            </motion.form>
          )}

          {step === 'verify' && (
            <motion.div
              key="verify-step"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="text-center space-y-5"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                We've sent a verification link to{' '}
                <span className="font-semibold text-gray-800 dark:text-gray-200">{email}</span>.{' '}
                Please check your inbox and click the link to activate your account.
              </p>

              <div className="space-y-2">
                {resendInfo && (
                  <p className="text-xs text-emerald-500">{resendInfo}</p>
                )}
                {resendError && (
                  <p className="text-xs text-red-500">{resendError}</p>
                )}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resendLoading}
                  className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-40"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : resendLoading
                    ? 'Sending…'
                    : 'Resend verification email'}
                </button>
              </div>

              <button
                type="button"
                onClick={goBack}
                className="block mx-auto text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {step === 'verify' && (
        <div className="px-8 pb-6 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            By continuing, you agree to our{' '}
            <a href="/policies" className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/policies" className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default LoginPage;

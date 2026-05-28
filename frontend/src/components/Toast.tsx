import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info' | 'warn';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
}

interface ToastCtx {
  toast: (message: string, opts?: { kind?: ToastKind; duration?: number }) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside <ToastProvider>');
  return v;
}

const kindStyles: Record<ToastKind, { icon: React.ReactNode; ring: string; bg: string }> = {
  success: { icon: <Check size={16} />, ring: 'ring-emerald-400/30', bg: 'bg-emerald-500/15 text-emerald-200' },
  error: { icon: <X size={16} />, ring: 'ring-red-400/30', bg: 'bg-red-500/15 text-red-200' },
  warn: { icon: <AlertTriangle size={16} />, ring: 'ring-amber-400/30', bg: 'bg-amber-500/15 text-amber-200' },
  info: { icon: <Info size={16} />, ring: 'ring-sky-400/30', bg: 'bg-sky-500/15 text-sky-200' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, opts?: { kind?: ToastKind; duration?: number }) => {
    const id = ++idRef.current;
    const t: Toast = { id, kind: opts?.kind || 'info', message, duration: opts?.duration ?? 2800 };
    setToasts((prev) => [...prev, t]);
    if (t.duration > 0) {
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.duration);
    }
  }, []);

  const value: ToastCtx = {
    toast: push,
    success: (m, d) => push(m, { kind: 'success', duration: d }),
    error: (m, d) => push(m, { kind: 'error', duration: d ?? 4000 }),
    info: (m, d) => push(m, { kind: 'info', duration: d }),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-[100000] flex flex-col gap-2 pointer-events-none"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const s = kindStyles[t.kind];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={`pointer-events-auto flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-xl bg-[#0c0d0f]/95 backdrop-blur-md border border-white/10 shadow-xl text-sm text-white max-w-sm ring-1 ${s.ring}`}
              >
                <span className={`flex items-center justify-center w-6 h-6 rounded-md ${s.bg}`}>{s.icon}</span>
                <span className="flex-1 leading-snug">{t.message}</span>
                <button
                  onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                  className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  title="Dismiss"
                >
                  <X size={13} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload } from 'lucide-react';

interface Props {
  onFiles: (files: File[]) => void;
}

const GlobalDropOverlay: React.FC<Props> = ({ onFiles }) => {
  const [active, setActive] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const isFileDrag = (e: DragEvent): boolean => {
      const types = e.dataTransfer?.types;
      if (!types) return false;
      return Array.from(types).includes('Files');
    };

    const onEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragCounter.current++;
      setActive(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setActive(false);
      }
    };
    const onOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounter.current = 0;
      setActive(false);
      // Reject drops outside the centered 70% box — accidental drops are ignored
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const dx = Math.abs(e.clientX - vw / 2);
      const dy = Math.abs(e.clientY - vh / 2);
      if (dx > vw * 0.35 || dy > vh * 0.35) return;
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) onFiles(files);
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [onFiles]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[99998] flex items-center justify-center p-6 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="w-[70%] h-[70%] text-center rounded-3xl border-2 border-dashed border-white/40 bg-white/5 flex flex-col items-center justify-center"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-4"
            >
              <Upload size={56} className="mx-auto text-white" />
            </motion.div>
            <p className="text-3xl font-light text-white mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Drop to upload
            </p>
            <p className="text-sm text-white/60" style={{ fontFamily: 'system-ui, sans-serif' }}>
              Release anywhere on the page
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalDropOverlay;

import React, { forwardRef } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'dark' | 'light';
  onToggle: (e?: React.MouseEvent) => void;
}

const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(({ theme, onToggle }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onToggle}
      className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors group relative text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 focus:outline-none"
      aria-label="Change theme"
      type="button"
      onMouseDown={e => e.preventDefault()} // prevent focus ring on click
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      <div className="absolute left-16 bg-gray-900 dark:bg-white text-white dark:text-black px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 hidden sm:block">
        Change theme
      </div>
    </button>
  );
});

export default ThemeToggle;
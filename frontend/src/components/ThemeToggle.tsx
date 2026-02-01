'use client';

import { useStore } from '@/store/useStore';
import { Moon, Sun } from 'phosphor-react';

export default function ThemeToggle() {
  const { isDarkMode, toggleDarkMode } = useStore();

  return (
    <button
      onClick={toggleDarkMode}
      className="btn-secondary px-4 py-2 text-sm"
      aria-label="Toggle theme"
    >
      <span className="flex items-center gap-2">
        {isDarkMode ? <Sun size={16} weight="duotone" /> : <Moon size={16} weight="duotone" />}
        {isDarkMode ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}

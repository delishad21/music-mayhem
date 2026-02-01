'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDarkMode, toggleDarkMode } = useStore();

  useEffect(() => {
    // Initialize theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      if (!isDarkMode) {
        toggleDarkMode();
      }
    }
  }, [isDarkMode, toggleDarkMode]);

  return <>{children}</>;
}

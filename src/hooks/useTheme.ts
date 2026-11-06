import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mangalist:theme';

/** Lê o tema já aplicado por public/theme-init.js (fonte única no 1º paint). */
function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Tema claro/escuro persistido em localStorage e refletido em <html data-theme>. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // A barra do navegador/PWA segue o tema escolhido, não só o do sistema.
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', paper);
      m.removeAttribute('media');
    });
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* armazenamento bloqueado: o tema vale só nesta sessão */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, isDark: theme === 'dark', toggleTheme };
}

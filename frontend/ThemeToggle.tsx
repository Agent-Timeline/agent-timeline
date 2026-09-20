import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { const saved = localStorage.getItem('agent-timeline-theme'); if (saved === 'light' || saved === 'dark') return saved; } catch { /* Storage may be disabled. */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('agent-timeline-theme', theme); } catch { /* Theme still works without persistence. */ }
  }, [theme]);
  return <button type="button" className="theme-toggle" aria-label="Dark mode" aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</button>;
}

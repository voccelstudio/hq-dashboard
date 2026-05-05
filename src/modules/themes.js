// ============================================================
// THEMES - 4 protocolos visuales con persistencia
// ============================================================

import { log } from './daemon-log.js';
import { toast } from './toast.js';

const THEMES = ['yellow', 'green', 'blue', 'red'];
const THEME_LABELS = {
  yellow: 'CYBER_YELLOW',
  green: 'TOXIC_GREEN',
  blue: 'COBALT_BLUE',
  red: 'BLOOD_RED',
};
const THEME_COLORS = {
  yellow: '#fce300',
  green: '#00ff41',
  blue: '#00f1fd',
  red: '#ff3860',
};
const STORAGE_KEY = 'sys_theme';

export function initThemes() {
  // Aplica el tema guardado al boot
  const saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(THEMES.includes(saved) ? saved : 'yellow', false);

  // Wire-up de botones en cada theme card
  document.querySelectorAll('.theme-card').forEach(card => {
    const t = card.dataset.theme;
    if (!THEMES.includes(t)) return;
    const applyBtn = card.querySelector('.apply');
    const previewBtn = card.querySelector('.preview');
    if (applyBtn) applyBtn.addEventListener('click', () => applyTheme(t, true));
    if (previewBtn) previewBtn.addEventListener('click', () => applyTheme(t, false));
  });
}

export function applyTheme(theme, persist = true) {
  if (!THEMES.includes(theme)) return;

  document.documentElement.className = `theme-${theme}`;
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('current', c.dataset.theme === theme);
  });

  // Update meta theme-color para que la barra del browser cambie en mobile
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);

  if (persist) {
    localStorage.setItem(STORAGE_KEY, theme);
    log('OK', 'THEME', `Protocol applied: ${THEME_LABELS[theme]}`);
    toast(`Theme: ${THEME_LABELS[theme]}`, 'ok', 'THEME');
  }
}

export function getCurrentTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'yellow';
}

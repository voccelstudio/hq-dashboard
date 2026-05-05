// ============================================================
// SYS_DASHBOARD - Entry point
// ============================================================
// Importa todos los estilos y módulos, registra service worker
// y arranca cada subsistema en el orden correcto.
// ============================================================

// Styles (orden importa: base → themes → layout → components)
import './styles/base.css';
import './styles/themes.css';
import './styles/layout.css';
import './styles/components.css';

// Core modules
import { initNav } from './modules/nav.js';
import { initThemes } from './modules/themes.js';
import { initSettings } from './modules/settings.js';
import { initGeolocation } from './modules/geolocation.js';
import { initClocks } from './modules/clocks.js';
import { initWeather } from './modules/weather.js';
import { initDaemonLog, log } from './modules/daemon-log.js';
import { initToasts, toast } from './modules/toast.js';

// Feature modules (los implementamos en tanda 4)
import { initNews } from './modules/news.js';
import { initSearch } from './modules/search.js';
import { initLinks } from './modules/links.js';
import { initNotes } from './modules/notes.js';
import { initVisualizer } from './modules/visualizer.js';
import { initWorldMap } from './modules/world-map.js';
import { initMetrics } from './modules/metrics.js';
import { initAlarms } from './modules/alarms.js';
import { initPomodoro } from './modules/pomodoro.js';

// ============================================================
// CONFIG (read-only desde import.meta.env)
// ============================================================
export const CONFIG = {
  OPENWEATHER_API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || '',
  OPERATOR_NAME: import.meta.env.VITE_OPERATOR_NAME || 'OPERATOR_01',
  IS_DEV: import.meta.env.DEV,
};

// ============================================================
// BOOT
// ============================================================
async function boot() {
  // Subsistemas que no dependen de nada externo
  initToasts();
  initDaemonLog();
  initSettings();      // antes que themes para que aplique densidad/scan-lines
  initThemes();        // lee localStorage y aplica clase
  initNav();           // navegación + atajos + drawer mobile

  // Sub-sistemas de UI estática
  initLinks();
  initSearch();
  initNotes();
  initMetrics();
  initWorldMap();
  initPomodoro();
  initAlarms();
  initVisualizer();

  log('OK', 'BOOT', `${CONFIG.OPERATOR_NAME} session initialized`);

  // Geolocation primero — devuelve location o null
  const userLocation = await initGeolocation();

  // Clocks y weather dependen de userLocation (puede ser null)
  initClocks(userLocation);
  initWeather(userLocation);

  // News al final (requests externos, no urgente)
  initNews();

  // PWA Service worker (solo en producción para no romper HMR)
  if ('serviceWorker' in navigator && !CONFIG.IS_DEV) {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => log('OK', 'PWA', 'Service worker registered'))
      .catch(err => log('WARN', 'PWA', `SW registration failed: ${err.message}`));
  }

  // Power button = easter egg
  const powerBtn = document.getElementById('powerBtn');
  if (powerBtn) {
    powerBtn.addEventListener('click', () => {
      toast('Try harder, operator', 'warn', 'POWER');
      log('WARN', 'POWER', 'Shutdown sequence aborted');
    });
  }

  // New process button = log nuevo PID
  const newProcessBtn = document.getElementById('newProcessBtn');
  if (newProcessBtn) {
    newProcessBtn.addEventListener('click', () => {
      const pid = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      log('INFO', 'PROC', `New process spawned: pid_${pid}`);
      toast(`pid_${pid} spawned`, 'ok', 'PROC');
    });
  }
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

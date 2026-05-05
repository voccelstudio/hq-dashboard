// ============================================================
// SETTINGS - Panel de configuración persistente
// ============================================================

import { log } from './daemon-log.js';
import { toast } from './toast.js';
import { redetectLocation } from './geolocation.js';
import { setUserLocation as setClocksLocation } from './clocks.js';
import { setUserLocation as setWeatherLocation } from './weather.js';

const STORAGE_KEY = 'sys_settings';

const DEFAULTS = {
  operatorName: '',         // si está vacío, usa CONFIG.OPERATOR_NAME del .env
  scanlines: true,
  density: 'normal',
  autoNews: true,
  notifications: false,
};

let current = { ...DEFAULTS };

export function getSettings() {
  return { ...current };
}

export function initSettings() {
  // Cargar
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) current = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    log('WARN', 'SETTINGS', `Failed to load: ${e.message}`);
  }
  applySettings(current);

  // Botón abrir
  const openBtn = document.getElementById('settingsBtn');
  const modal = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('settingsCloseBtn');
  const cancelBtn = document.getElementById('settingsCancelBtn');
  const saveBtn = document.getElementById('settingsSaveBtn');

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (saveBtn) saveBtn.addEventListener('click', saveModal);

  // Click en backdrop cierra
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal();
    });
  }

  // Toggles
  const tgScan = document.getElementById('toggleScanlines');
  const tgNews = document.getElementById('toggleAutoNews');
  const tgNotifs = document.getElementById('toggleNotifs');
  if (tgScan) tgScan.addEventListener('click', () => toggleSwitch(tgScan));
  if (tgNews) tgNews.addEventListener('click', () => toggleSwitch(tgNews));
  if (tgNotifs) tgNotifs.addEventListener('click', () => toggleNotifsSwitch(tgNotifs));

  // Reset
  const resetBtn = document.getElementById('resetAllBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetAll);

  // Re-detect geo
  const reGeoBtn = document.getElementById('reGeoBtn');
  if (reGeoBtn) {
    reGeoBtn.addEventListener('click', async () => {
      const loc = await redetectLocation();
      if (loc) {
        toast(`Location: ${loc.city}`, 'ok', 'GEO');
        setClocksLocation(loc);
        setWeatherLocation(loc);
      }
    });
  }
}

function openModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;

  // Populate UI con valores actuales
  setVal('setOperatorName', current.operatorName);
  setVal('setDensity', current.density);
  setToggle('toggleScanlines', current.scanlines);
  setToggle('toggleAutoNews', current.autoNews);
  setToggle('toggleNotifs', current.notifications);

  modal.classList.add('open');
}

function closeModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('open');
}

function saveModal() {
  current = {
    operatorName: getVal('setOperatorName').trim(),
    density: getVal('setDensity'),
    scanlines: getToggle('toggleScanlines'),
    autoNews: getToggle('toggleAutoNews'),
    notifications: getToggle('toggleNotifs'),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  applySettings(current);
  log('OK', 'SETTINGS', 'Configuration saved');
  toast('Settings saved', 'ok', 'CONFIG');
  closeModal();
}

function applySettings(s) {
  // Operator name
  const finalName = s.operatorName || (window.__OPERATOR_FALLBACK__ || 'OPERATOR_01');
  setText('opName', finalName);
  setText('sideOpName', finalName);

  // Scanlines
  document.body.classList.toggle('no-effects', !s.scanlines);

  // Density
  document.body.classList.toggle('density-compact', s.density === 'compact');
}

function resetAll() {
  if (!confirm('WIPE ALL DATA?\n\nEsto borra notas, alarmas, theme, settings y datos cacheados. ¿Continuar?')) return;
  // Borra solo nuestras keys, no todo localStorage
  const keys = ['sys_settings', 'sys_theme', 'sys_notes', 'sys_alarms', 'sys_pomodoro', 'sys_geo', 'sys_weather_cache'];
  keys.forEach(k => localStorage.removeItem(k));
  log('WARN', 'SETTINGS', 'All data wiped');
  toast('All data wiped — reloading...', 'warn', 'WIPE');
  setTimeout(() => location.reload(), 800);
}

// ---------- Helpers ----------
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ''; }
function getVal(id)    { const el = document.getElementById(id); return el ? el.value : ''; }
function setText(id, v){ const el = document.getElementById(id); if (el) el.textContent = v; }
function setToggle(id, on) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('on', !!on);
  el.setAttribute('aria-checked', !!on);
}
function getToggle(id) {
  const el = document.getElementById(id);
  return el ? el.classList.contains('on') : false;
}
function toggleSwitch(el) {
  const on = !el.classList.contains('on');
  el.classList.toggle('on', on);
  el.setAttribute('aria-checked', on);
}

async function toggleNotifsSwitch(el) {
  const on = !el.classList.contains('on');
  if (on) {
    if (!('Notification' in window)) {
      toast('Browser no soporta notificaciones', 'err', 'NOTIF');
      return;
    }
    if (Notification.permission === 'denied') {
      toast('Permiso bloqueado — habilitalo en el browser', 'warn', 'NOTIF');
      return;
    }
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        toast('Permiso denegado', 'warn', 'NOTIF');
        return;
      }
    }
    toast('Notifications enabled', 'ok', 'NOTIF');
  }
  el.classList.toggle('on', on);
  el.setAttribute('aria-checked', on);
}

// Expone fallback name desde main.js
export function setOperatorFallback(name) {
  window.__OPERATOR_FALLBACK__ = name;
  applySettings(current);
}

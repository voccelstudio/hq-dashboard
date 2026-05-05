// ============================================================
// WEATHER - OpenWeather con cache + multi-ciudad + iconos
// ============================================================

import { CITIES } from '../config/cities.js';
import { CONFIG } from '../main.js';
import { log } from './daemon-log.js';
import { getActiveCities } from './clocks.js';

const CACHE_KEY = 'sys_weather_cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 min
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min

let userLocation = null;
let refreshTimer = null;

// Mapeo OpenWeather main → Material Symbol
const COND_ICONS = {
  Clear: 'wb_sunny',
  Clouds: 'cloud',
  Rain: 'rainy',
  Drizzle: 'rainy',
  Snow: 'ac_unit',
  Thunderstorm: 'thunderstorm',
  Mist: 'foggy',
  Fog: 'foggy',
  Haze: 'foggy',
  Smoke: 'smoke',
  Dust: 'foggy',
  Sand: 'foggy',
  OFFLINE: 'cloud_off',
  SYNC: 'sync',
  MOCK: 'science',
};

export function initWeather(loc) {
  userLocation = loc;
  fetchAll();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(fetchAll, REFRESH_INTERVAL);
}

export function setUserLocation(loc) {
  userLocation = loc;
  fetchAll();
}

async function fetchAll() {
  const cities = getActiveCities();
  if (!cities.length) return;

  if (!CONFIG.OPENWEATHER_API_KEY) {
    // Sin key → datos mock estables (no random) para que se vea el UI
    cities.forEach((c, i) => {
      const mocks = [
        { temp: 22, cond: 'Clear', desc: 'clear sky' },
        { temp: 18, cond: 'Clouds', desc: 'scattered clouds' },
        { temp: 8,  cond: 'Rain',  desc: 'light rain' },
        { temp: 31, cond: 'Haze',  desc: 'haze' },
        { temp: 16, cond: 'Clouds', desc: 'overcast' },
      ];
      const m = mocks[i % mocks.length];
      updateUI(c.code, m.temp, m.cond, m.desc, true);
    });
    log('INFO', 'WEATHER', 'No API key — using mock data');
    return;
  }

  // Cache check
  const cache = readCache();
  const stale = !cache || Date.now() - cache.ts > CACHE_TTL;

  if (!stale) {
    cities.forEach(c => {
      const data = cache.data[c.code];
      if (data) updateUI(c.code, data.temp, data.cond, data.desc, false);
    });
    log('OK', 'WEATHER', `Cached data (age: ${Math.round((Date.now() - cache.ts) / 1000)}s)`);
    return;
  }

  // Fetch fresh
  const newCache = { ts: Date.now(), data: {} };
  let okCount = 0;

  await Promise.all(cities.map(async c => {
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${c.lat}&lon=${c.lon}&units=metric&appid=${CONFIG.OPENWEATHER_API_KEY}`
      );
      if (!r.ok) {
        if (r.status === 401) {
          log('ERR', 'WEATHER', 'API key invalid (401)');
        } else {
          log('WARN', 'WEATHER', `${c.code}: HTTP ${r.status}`);
        }
        updateUI(c.code, '--', 'OFFLINE', 'No data', false);
        return;
      }
      const j = await r.json();
      const temp = Math.round(j.main.temp);
      const cond = j.weather[0]?.main || 'Clear';
      const desc = j.weather[0]?.description || '';
      newCache.data[c.code] = { temp, cond, desc };
      updateUI(c.code, temp, cond, desc, false);
      okCount++;
    } catch (err) {
      log('WARN', 'WEATHER', `${c.code}: ${err.message}`);
      updateUI(c.code, '--', 'OFFLINE', 'Network error', false);
    }
  }));

  if (okCount > 0) {
    writeCache(newCache);
    log('OK', 'WEATHER', `Fetched ${okCount}/${cities.length} cities`);
  }
}

function updateUI(code, temp, cond, desc, isMock) {
  const condUpper = (cond || 'SYNC').toUpperCase();
  const tempStr = temp === '--' ? '--' : `${temp}°C`;
  const tempStrShort = temp === '--' ? '--°' : `${temp}°`;
  const tag = isMock ? ' [MOCK]' : '';

  // Mini clocks
  document.querySelectorAll(`[data-weather="${cssEscape(code)}"]`).forEach(el => {
    el.textContent = `${tempStr} / ${condUpper}${tag}`;
  });

  // Chronos blocks
  document.querySelectorAll(`[data-weather-block="${cssEscape(code)}"]`).forEach(el => {
    const tEl = el.querySelector('.temp');
    const cEl = el.querySelector('.cond');
    if (tEl) tEl.textContent = tempStrShort;
    if (cEl) cEl.textContent = condUpper;
  });

  // Local hero (sólo si es el code "YOU")
  if (code === 'YOU') {
    setText('localTemp', tempStrShort);
    setText('localCond', isMock ? `${condUpper} [MOCK]` : condUpper);
    const icon = COND_ICONS[cond] || COND_ICONS[condUpper] || 'cyclone';
    const iconEl = document.getElementById('localIcon');
    if (iconEl) iconEl.textContent = icon;
  }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(c) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {}
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function cssEscape(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '');
}

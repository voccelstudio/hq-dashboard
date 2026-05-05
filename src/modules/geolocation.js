// ============================================================
// GEOLOCATION - Detecta la ubicación del usuario
// ============================================================
// Estrategia:
// 1. Intenta navigator.geolocation (precisión: alta, requiere permiso)
// 2. Reverse geocoding gratis con BigDataCloud (sin key, sin CORS)
// 3. Fallback: IP geolocation con ipapi.co (sin key, free)
// 4. Cache en localStorage para no pedir permiso cada carga
// ============================================================

import { log } from './daemon-log.js';
import { toast } from './toast.js';

const CACHE_KEY = 'sys_geo';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// Timezone fallback table - cuando no podemos resolver tz desde reverse geocode
function tzFromLatLon(lat, lon) {
  // Aproximación grosera por longitud
  // (Intl.DateTimeFormat resolvedOptions ya nos da el tz del browser, lo usamos como default)
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export async function initGeolocation() {
  // 1. Cache fresh?
  const cached = readCache();
  if (cached) {
    log('OK', 'GEO', `Cached: ${cached.city}, ${cached.country}`);
    return cached;
  }

  return await detectLocation(false);
}

export async function redetectLocation() {
  localStorage.removeItem(CACHE_KEY);
  return await detectLocation(true);
}

async function detectLocation(showToast) {
  // 1. Intentar navigator.geolocation
  const browserPos = await tryBrowserGeo();
  if (browserPos) {
    const enriched = await enrichLocation(browserPos.lat, browserPos.lon);
    writeCache(enriched);
    log('OK', 'GEO', `Detected: ${enriched.city}, ${enriched.country}`);
    if (showToast) toast(`${enriched.city}, ${enriched.country}`, 'ok', 'GEO');
    return enriched;
  }

  // 2. Fallback: IP geolocation
  log('INFO', 'GEO', 'Browser geo unavailable, trying IP fallback');
  const ipPos = await tryIpGeo();
  if (ipPos) {
    writeCache(ipPos);
    log('OK', 'GEO', `IP-based: ${ipPos.city}, ${ipPos.country}`);
    if (showToast) toast(`IP: ${ipPos.city}`, 'ok', 'GEO');
    return ipPos;
  }

  log('WARN', 'GEO', 'No location detected');
  if (showToast) toast('Could not detect location', 'warn', 'GEO');
  return null;
}

function tryBrowserGeo() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    const timeout = setTimeout(() => resolve(null), 8000);
    navigator.geolocation.getCurrentPosition(
      pos => {
        clearTimeout(timeout);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      err => {
        clearTimeout(timeout);
        log('INFO', 'GEO', `Geo denied/failed: ${err.message}`);
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 7000 }
    );
  });
}

async function enrichLocation(lat, lon) {
  // BigDataCloud free reverse geocoding (no key required, CORS friendly)
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (r.ok) {
      const j = await r.json();
      return {
        lat,
        lon,
        city: j.city || j.locality || j.principalSubdivision || 'Unknown',
        country: (j.countryCode || j.countryName || '').toUpperCase().slice(0, 3),
        countryName: j.countryName || '',
        tz: tzFromLatLon(lat, lon),
        source: 'browser',
      };
    }
  } catch (err) {
    log('WARN', 'GEO', `Reverse geocode failed: ${err.message}`);
  }
  // Sin reverse geocode → al menos lat/lon
  return {
    lat,
    lon,
    city: 'Unknown',
    country: '---',
    countryName: '',
    tz: tzFromLatLon(lat, lon),
    source: 'browser',
  };
}

async function tryIpGeo() {
  // ipapi.co free tier - sin key, CORS habilitado
  try {
    const r = await fetch('https://ipapi.co/json/');
    if (r.ok) {
      const j = await r.json();
      if (j.latitude && j.longitude) {
        return {
          lat: j.latitude,
          lon: j.longitude,
          city: j.city || 'Unknown',
          country: (j.country_code || '').toUpperCase(),
          countryName: j.country_name || '',
          tz: j.timezone || tzFromLatLon(j.latitude, j.longitude),
          source: 'ip',
        };
      }
    }
  } catch (err) {
    log('WARN', 'GEO', `IP geo failed: ${err.message}`);
  }

  // Last resort: timezone-only (sin lat/lon → no weather)
  return null;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.ts > CACHE_TTL) return null;
    return obj.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// ============================================================
// CLOCKS - Local time + 4 fixed cities + user location
// ============================================================

import { CITIES } from '../config/cities.js';
import { log } from './daemon-log.js';

let userLocation = null;
let activeCities = [];
let tickInterval = null;

export function initClocks(loc) {
  userLocation = loc;
  activeCities = buildActiveCities();
  buildMiniClocks();
  buildChronosNodes();
  updateNodeCount();
  tickInterval = setInterval(tick, 1000);
  tick();
  log('OK', 'CLOCKS', `${activeCities.length} time nodes online`);
}

export function setUserLocation(loc) {
  userLocation = loc;
  activeCities = buildActiveCities();
  // Forzar rebuild
  const mini = document.getElementById('miniClocks');
  const chr = document.getElementById('clockNodes');
  if (mini) mini.dataset.built = '';
  if (chr) chr.dataset.built = '';
  buildMiniClocks();
  buildChronosNodes();
  updateNodeCount();
  tick();
}

function buildActiveCities() {
  const list = [...CITIES];
  if (userLocation) {
    // Insertar al principio como "local"
    list.unshift({
      code: 'YOU',
      name: 'LOCAL',
      city: userLocation.city,
      country: userLocation.country,
      tz: userLocation.tz,
      lat: userLocation.lat,
      lon: userLocation.lon,
      mapX: latLonToMapX(userLocation.lat, userLocation.lon),
      mapY: latLonToMapY(userLocation.lat, userLocation.lon),
      isLocal: true,
    });
  }
  return list;
}

function latLonToMapX(lat, lon) {
  // Mapa SVG va de 0..1000 en X = -180..180 longitud
  return ((lon + 180) / 360) * 1000;
}

function latLonToMapY(lat, lon) {
  // Mapa va de 0..500 en Y = 90..-90 latitud (proyección equirectangular simple)
  return ((90 - lat) / 180) * 500;
}

// ---------- Local hero (Terminal view) ----------
function updateLocalHero() {
  if (!userLocation) {
    setText('localCity', 'No location');
    setText('localCountry', '---');
    setText('localTime', new Date().toLocaleTimeString('en-GB'));
    setText('localDate', formatDate(new Date()));
    setText('localHeroStatus', 'OFFLINE');
    return;
  }
  const now = new Date();
  setText('localCity', userLocation.city.toUpperCase());
  setText('localCountry', `[ ${userLocation.country} // ${userLocation.tz} ]`);
  setText('localTime', now.toLocaleTimeString('en-GB', { timeZone: userLocation.tz, hour12: false }));
  setText('localDate', formatDateTZ(now, userLocation.tz));
  setText('localHeroStatus', userLocation.source === 'ip' ? 'IP_NODE' : 'GPS_NODE');
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return `${yyyy}.${mm}.${dd} // ${day}`;
}

function formatDateTZ(d, tz) {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
    const parts = fmt.formatToParts(d);
    const get = t => parts.find(p => p.type === t)?.value || '';
    return `${get('year')}.${get('month')}.${get('day')} // ${get('weekday').toUpperCase()}`;
  } catch {
    return formatDate(d);
  }
}

// ---------- Mini clocks ----------
function buildMiniClocks() {
  const mini = document.getElementById('miniClocks');
  if (!mini || mini.dataset.built === '1') return;

  mini.innerHTML = activeCities.map(c => `
    <div class="mini-clock${c.isLocal ? ' local' : ''}">
      <div>
        <div class="city">${escape(c.code)}${c.isLocal ? ' (LOCAL)' : ''}</div>
        <div class="weather" data-weather="${escape(c.code)}">--°C / SYNC</div>
      </div>
      <div class="time" data-time="${escape(c.code)}">--:--:--</div>
    </div>
  `).join('');
  mini.dataset.built = '1';
}

// ---------- Chronos nodes (detailed) ----------
function buildChronosNodes() {
  const cn = document.getElementById('clockNodes');
  if (!cn || cn.dataset.built === '1') return;

  cn.innerHTML = activeCities.map(c => `
    <div class="clock-node${c.isLocal ? ' local' : ''}">
      <div class="header">
        <span><span class="code">[ ${escape(c.code)} ]</span> <span class="name">${escape(c.name)}</span></span>
        <span style="color:var(--success); font-size:10px">● ACTIVE</span>
      </div>
      <div class="body">
        <div>
          <div class="time" data-fulltime="${escape(c.code)}">--:--:--</div>
          <div class="tz">${escape(c.tz)}</div>
        </div>
        <div class="weather-block" data-weather-block="${escape(c.code)}">
          <span class="temp">--°</span>
          <span class="cond">SYNC...</span>
        </div>
      </div>
    </div>
  `).join('');
  cn.dataset.built = '1';
}

function updateNodeCount() {
  setText('nodeCount', activeCities.length.toString());
}

// ---------- Tick ----------
function tick() {
  // Statusbar local
  const now = new Date();
  setText('statusTime', now.toLocaleTimeString('en-GB'));
  const offset = -now.getTimezoneOffset() / 60;
  const sign = offset >= 0 ? '+' : '-';
  const offStr = ` ${sign}${String(Math.abs(offset)).padStart(2, '0')}`;
  setText('statusTz', offStr);

  // Local hero
  updateLocalHero();

  // Mini + Chronos
  activeCities.forEach(c => {
    const t = new Date().toLocaleTimeString('en-GB', { timeZone: c.tz, hour12: false });
    document.querySelectorAll(`[data-time="${cssEscape(c.code)}"]`).forEach(el => (el.textContent = t));
    document.querySelectorAll(`[data-fulltime="${cssEscape(c.code)}"]`).forEach(el => (el.textContent = t));
  });
}

export function getActiveCities() {
  return activeCities;
}

// ---------- Helpers ----------
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function escape(s) {
  return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}
function cssEscape(s) {
  // Para querySelector con valores dinámicos
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '');
}

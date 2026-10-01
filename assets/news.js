/* ===== NEWS SYSTEM =====
   4 categorías, feeds RSS externos vía rss2json.

   Decisiones:
   - Cache por categoría en localStorage con TTL. Sin esto, cada cambio de
     pestaña dispara N requests y rss2json (proxy gratuito, sin API key)
     corta con "converting new feeds in a very short period".
   - Timeout por feed con AbortController. Un feed colgado no debe frenar la
     categoría entera.
   - Sin contenido inventado. Si no hay red, se muestra lo último cacheado
     con la hora real, o un estado de error claro. Un article que parece real
     pero es ficticio es peor que una lista vacía.
   - El estado de cada fuente es visible. Si 2 de 4 feeds caen, se dice.
*/

var NEWS_TTL = 20 * 60 * 1000;      // 20 min: cada cuánto revalidamos
var NEWS_STALE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días: cuánto vale lo cacheado offline
var NEWS_TIMEOUT = 9000;
var NEWS_PER_SOURCE = 6;
var NEWS_MAX_ITEMS = 18;

var NEWS_SOURCES = {
  ARCHITECTURE: [
    { name: 'ArchDaily', url: 'https://www.archdaily.com/feed' },
    { name: 'Designboom', url: 'https://www.designboom.com/feed' },
    { name: 'ArchRecord', url: 'https://www.architecturalrecord.com/rss/articles' },
    { name: 'Dezeen', url: 'https://www.dezeen.com/feed/' }
  ],
  TECH: [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'Ars Technica', url: 'https://arstechnica.com/feed/' },
    { name: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
    { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' }
  ],
  MUSIC: [
    { name: 'Pitchfork', url: 'https://pitchfork.com/feed/feed-news/rss' },
    { name: 'Rolling Stone', url: 'https://www.rollingstone.com/feed/' },
    { name: 'Consequence of Sound', url: 'https://consequence.net/feed/' },
    { name: 'Stereogum', url: 'https://www.stereogum.com/feed' }
  ],
  LIFESTYLE: [
    { name: 'Lifehacker', url: 'https://lifehacker.com/feed/rss' },
    { name: 'Well+Good', url: 'https://www.wellandgood.com/feed/' },
    { name: 'Apartment Therapy', url: 'https://www.apartmenttherapy.com/main.rss' },
    { name: 'GQ', url: 'https://www.gq.com/feed/rss' },
    { name: 'Conde Nast Traveler', url: 'https://www.cntraveler.com/feed/rss' },
    { name: 'Outside', url: 'https://www.outsideonline.com/feed/' }
  ]
};

/* --- cache --- */
// El bundle principal expone l(level, tag, msg) para el daemon log. Si no está
// (carga parcial, tests), caemos a console en vez de romper.
function newsLog(level, tag, msg) {
  try {
    if (typeof window.logNews === 'function') return window.logNews(level, tag, msg);
    if (typeof window.l === 'function') return window.l(level, tag, msg);
  } catch (e) { /* logging nunca debe romper la carga */ }
  if (typeof console !== 'undefined') console.log(`[${level}] ${tag}: ${msg}`);
}

function newsCacheKey(cat) { return 'sys_news_' + cat; }

function readNewsCache(cat) {
  try {
    var raw = localStorage.getItem(newsCacheKey(cat));
    if (!raw) return null;
    var d = JSON.parse(raw);
    if (!d || !Array.isArray(d.items)) return null;
    // JSON no preserva Date: vuelve como string ISO. Hay que revivirlo o el
    // sort (a.date.getTime()) revienta con "getTime is not a function".
    d.items.forEach(function (i) {
      if (i.date && !(i.date instanceof Date)) i.date = parseDate(i.date);
      if (i.fetchedAt) i.fetchedAt = new Date(i.fetchedAt);
    });
    return d;
  } catch (e) { return null; }
}

function writeNewsCache(cat, items, health) {
  try {
    localStorage.setItem(newsCacheKey(cat), JSON.stringify({
      items: items,
      health: health,
      at: Date.now()
    }));
  } catch (e) { /* cuota llena: no es crítico, seguimos sin cache */ }
}

/* --- helpers --- */
function stripHTML(html) {
  if (!html) return '';
  var d = document.createElement('div');
  d.innerHTML = String(html);
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

function firstImage(html) {
  if (!html) return null;
  var m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) return m[1];
  m = html.match(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif))/i);
  return m ? m[1] : null;
}

// Feeds mandan RFC822 ("Mon, 05 Jan 2026 10:00:00 GMT"), ISO, o basura.
// Date.parse devuelve NaN y un NaN en el sort rompe el orden de toda la lista.
function parseDate(raw) {
  if (!raw) return null;
  var t = Date.parse(raw);
  if (!isNaN(t)) return new Date(t);
  // último recurso: "hace 3 horas", "2 days ago"
  var rel = String(raw).match(/(\d+)\s*(min|hour|day|week|month)/i);
  if (rel) {
    var n = parseInt(rel[1], 10);
    var mult = { min: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 };
    var ms = mult[rel[2].toLowerCase()] || 0;
    if (ms) return new Date(Date.now() - n * ms);
  }
  return null;
}

function formatDate(d) {
  // Acepta Date o string: la cache devuelve ISO y los items nuevos, Date.
  var dt = d instanceof Date ? d : (d ? new Date(d) : null);
  if (!dt || isNaN(dt.getTime())) return 'UNKNOWN';
  var now = Date.now();
  var diff = now - dt.getTime();
  if (diff < 0) diff = 0;
  var mins = Math.floor(diff / 6e4);
  if (mins < 60) return mins + 'M AGO';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'H AGO';
  var days = Math.floor(hrs / 24);
  if (days < 30) return days + 'D AGO';
  return dt.toISOString().slice(0, 10);
}

// El mismo artículo en dos feeds: comparar títulos normalizados es más barato
// y más robusto que comparar URLs (que traen utm_* distintos).
function titleKey(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
}

function dedupe(items) {
  var seen = {};
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var k = titleKey(items[i].title);
    if (!k || seen[k]) continue;
    seen[k] = 1;
    out.push(items[i]);
  }
  return out;
}

/* --- fetch de una fuente --- */
function fetchSource(src) {
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, NEWS_TIMEOUT);
  var api = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(src.url);

  return fetch(api, { signal: ctrl.signal })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !Array.isArray(data.items)) {
        // rss2json responde 200 con status:"error" cuando el feed no existe o
        // se pasó el rate limit. Hay que mirar el body, no solo el status HTTP.
        throw new Error(data.message || 'feed error');
      }
      return data.items.slice(0, NEWS_PER_SOURCE).map(function (r) {
        return {
          title: stripHTML(r.title || ''),
          desc: stripHTML(r.description || '').slice(0, 220),
          source: src.name,
          url: r.link || r.guid || '#',
          thumb: r.thumbnail || (r.enclosure && r.enclosure.link) || firstImage(r.content) || firstImage(r.description),
          date: parseDate(r.pubDate)
        };
      }).filter(function (i) { return i.title; });
    })
    .catch(function (err) {
      return { __error: (err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || 'error') };
    })
    .then(function (r) {
      clearTimeout(timer);
      if (Array.isArray(r)) return { name: src.name, ok: true, items: r };
      return { name: src.name, ok: false, error: r.__error };
    });
}

/* --- estado de salud por categoría --- */
var newsHealth = {};

function renderHealth(cat) {
  var el = document.getElementById('newsHealth');
  if (!el) return;
  var h = newsHealth[cat];
  if (!h) { el.textContent = ''; el.removeAttribute('title'); return; }
  if (!h.total) { el.textContent = 'OFFLINE'; el.title = 'Sin fuentes'; return; }
  var good = h.ok;
  if (good === h.total) {
    el.textContent = good + '/' + h.total + ' FEEDS';
    el.style.color = '';
  } else if (good > 0) {
    el.textContent = good + '/' + h.total + ' FEEDS';
    el.style.color = 'var(--warn)';
    el.title = 'Sin respuesta: ' + (h.failed || []).join(', ');
  } else {
    el.textContent = 'ALL FEEDS DOWN';
    el.style.color = 'var(--error)';
    el.title = 'Sin respuesta: ' + (h.failed || []).join(', ');
  }
}

/* --- render --- */
function newsItemHTML(item, idx) {
  var thumb = item.thumb
    ? ' style="background-image:url(&quot;' + String(item.thumb).replace(/"/g, '&quot;') + '&quot;)"'
    : '';
  var url = String(item.url || '#');
  // javascript: en un feed remoto es un vector de XSS. Solo permitimos http(s).
  if (!/^https?:\/\//i.test(url)) url = '#';

  return '<div class="news-item-container">' +
    '<a class="news-item" href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer">' +
      '<div class="news-thumb"' + thumb + '></div>' +
      '<div class="news-content">' +
        '<div class="news-source">[ ' + item.source.replace(/[<>]/g, '') + ' ]' +
          (item.cached ? '<span class="news-cached" title="Sin red — mostrando lo último leído"> CACHED</span>' : '') +
        '</div>' +
        '<div class="news-title">' + item.title.replace(/[<>]/g, '') + '</div>' +
        '<div class="news-desc" id="newsDesc-' + idx + '">' + item.desc.replace(/[<>]/g, '') + '</div>' +
        '<div class="news-meta">' +
          '<span><span class="label">PUBLISHED:</span> ' + formatDate(item.date) + '</span>' +
          (item.cached
            ? '<span style="color:var(--warn)">READ ' + formatDate(new Date(item.fetchedAt)) + '</span>'
            : '<button class="viz-btn" onclick="translateNews(event, \'newsDesc-' + idx + '\')" style="margin-left:auto;font-size:9px;padding:2px 6px;height:auto">TRANSLATE</button>') +
        '</div>' +
      '</div>' +
    '</a></div>';
}

function renderNewsEmpty(cat, reason) {
  var msgs = {
    offline: 'SIN CONEXIÓN — no hay cache guardado para esta categoría todavía.\n\nAbrí el dashboard con red una vez para|archivear el feed.',
    rate:  'RATE LIMIT del agregador. Probá en unos minutos.\n\nLos artículos cacheados se muestran si los hay.',
    fail:  'No se pudo leer ningún feed de esta categoría.\n\nPuede ser un problema de red o que las fuentes esten caída.'
  };
  return '<div class="empty-msg" style="white-space:pre-wrap">' +
    '<div style="color:var(--error);font-weight:700">[ SIGNAL_LOST ]</div>' +
    '<div style="margin-top:12px">' + (msgs[reason] || msgs.fail) + '</div>' +
    '<div style="margin-top:12px;color:var(--outline-bright)">CAT: ' + cat + '</div>' +
    '</div>';
}

function renderNews(cat, items, stale) {
  var el = document.getElementById('newsList');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = renderNewsEmpty(cat, stale);
    return;
  }
  el.innerHTML = items.map(newsItemHTML).join('');
  newsLog('OK', 'NEWS', 'Loaded ' + items.length + ' entries from ' + cat + (stale ? ' (cache)' : ''));
}

/* --- carga principal --- */
var newsInFlight = {};

async function loadNews(force) {
  var cat = window.currentNewsCat || 'ARCHITECTURE';
  var listEl = document.getElementById('newsList');
  if (!listEl) return;

  // dedupe: si esta categoría ya se está cargando, no se dispara otra vez
  if (newsInFlight[cat]) return newsInFlight[cat];

  var sources = NEWS_SOURCES[cat] || NEWS_SOURCES.ARCHITECTURE;
  var cached = readNewsCache(cat);
  var fresh = cached && !force && (Date.now() - cached.at) < NEWS_TTL;

  if (fresh) {
    renderNews(cat, cached.items, false);
    renderHealth(cat);
    return cached.items;
  }

  // Cacheado pero vencido: se muestra igual mientras revalidamos en background.
  if (cached && !force) {
    renderNews(cat, cached.items.map(function (i) {
      return Object.assign({}, i, { cached: true, fetchedAt: cached.at });
    }), false);
  } else if (!listEl.querySelector('.news-item-container')) {
    listEl.innerHTML = '<div class="loading">FETCHING_FEED</div>';
  }

  var job = (async function () {
    var results = await Promise.all(sources.map(fetchSource));

    var items = [];
    var health = { total: sources.length, ok: 0, failed: [] };
    results.forEach(function (r) {
      if (r.ok) { health.ok++; items = items.concat(r.items); }
      else { health.failed.push(r.name + ' (' + r.error + ')'); }
    });
    newsHealth[cat] = health;

    items = dedupe(items);
    // Orden por fecha real. Sin fecha = al final, no mezclado con el resto.
    // El sort va sobre strings/Date indistinto porque la cache devuelve ISO.
    items.sort(function (a, b) {
      var ta = a.date ? new Date(a.date).getTime() : 0;
      var tb = b.date ? new Date(b.date).getTime() : 0;
      if (isNaN(ta)) ta = 0;
      if (isNaN(tb)) tb = 0;
      return tb - ta;
    });
    items = items.slice(0, NEWS_MAX_ITEMS);

    if (items.length) {
      writeNewsCache(cat, items, health);
      renderNews(cat, items, false);
      renderHealth(cat);
      if (health.ok < health.total) {
        newsLog('WARN', 'NEWS', health.ok + '/' + health.total + ' feeds — ' + health.failed.join(', '));
      }
      return items;
    }

    // Cero items de la red. Último recurso: lo cacheado, mientras no expire.
    var fallback = readNewsCache(cat);
    if (fallback && fallback.items.length && (Date.now() - fallback.at) < NEWS_STALE_TTL) {
      renderNews(cat, fallback.items.map(function (i) {
        return Object.assign({}, i, { cached: true, fetchedAt: fallback.at });
      }), false);
      renderHealth(cat);
      newsLog('WARN', 'NEWS', 'Feeds caídos — mostrando cache de ' + cat);
      return fallback.items;
    }

    var rateLimited = health.failed.some(function (f) { return /short period|api key/i.test(f); });
    renderNews(cat, [], navigator.onLine === false ? 'offline' : (rateLimited ? 'rate' : 'fail'));
    renderHealth(cat);
    newsLog('ERR', 'NEWS', 'Sin items en ' + cat + ' (' + health.failed.join(', ') + ')');
    return [];
  })();

  newsInFlight[cat] = job;
  try {
    return await job;
  } finally {
    delete newsInFlight[cat];
  }
}

/* --- init --- */
function initNews() {
  // El botón TRANSLATE vive en el markup que renderiza este módulo, así que el
  // handler también. El bundle ya no lo expone (el markup viejo se fue con él).
  window.translateNews = function (event, id) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    var el = document.getElementById(id);
    if (!el) return;
    var btn = event && event.currentTarget;
    var original = el.dataset.original || el.textContent;

    // Segundo click: volver al original sin volver a pegarle a la API.
    if (el.dataset.translated === '1') {
      el.textContent = original;
      el.dataset.translated = '';
      if (btn) btn.textContent = 'TRANSLATE';
      return;
    }

    el.dataset.original = original;
    if (btn) btn.textContent = '...';

    // Sin API key, el endpoint público de MyMemory es la opción que no pide
    // signup. Si falla, el texto queda intacto — nunca se pierde contenido.
    var url = 'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(original.slice(0, 480)) + '&langpair=en|es';
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var t = d && d.responseData && d.responseData.translatedText;
        if (!t || d.responseStatus !== 200) throw new Error('no translation');
        el.textContent = t;
        el.dataset.translated = '1';
        if (btn) btn.textContent = 'ORIGINAL';
      })
      .catch(function () {
        if (btn) btn.textContent = 'TRANSLATE';
      });
  };

  var tabs = document.querySelectorAll('#newsCategories .viz-btn');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (b) { b.classList.remove('active'); });
      tab.classList.add('active');
      window.currentNewsCat = tab.dataset.cat;
      loadNews(true);
    });
  });

  var refresh = document.getElementById('refreshNewsBtn');
  if (refresh) {
    refresh.addEventListener('click', function () { loadNews(true); });
  }

  // Reconectar: si vuelve la red y no hay nada cacheado, reintentar.
  window.addEventListener('online', function () {
    var cat = window.currentNewsCat || 'ARCHITECTURE';
    var c = readNewsCache(cat);
    if (!c || !c.items.length) loadNews(true);
  });

  // Refresco automático
  if (window.newsAutoRefresh) window.newsAutoRefresh();

  // Primera carga. false = usa la cache si no venció, si no va a la red.
  loadNews(false);
}

function scheduleNewsAutoRefresh() {
  window.newsAutoRefresh = function () {
    if (window.newsRefreshTimer) clearInterval(window.newsRefreshTimer);
    window.newsRefreshTimer = null;

    // Respeta el toggle del panel de settings (sys_settings.autoNews).
    var on = true;
    try {
      var s = JSON.parse(localStorage.getItem('sys_settings') || '{}');
      if (typeof s.autoNews === 'boolean') on = s.autoNews;
    } catch (e) { /* settings corrupto: refrescamos igual */ }
    if (!on) return;

    // 30 min, alineado con el TTL de cache: cuando dispara, la cache venció.
    window.newsRefreshTimer = setInterval(function () { loadNews(false); }, 30 * 60 * 1000);
  };
}

scheduleNewsAutoRefresh();
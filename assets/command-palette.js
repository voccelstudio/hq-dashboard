/* COMMAND PALETTE
   Ctrl+K / Cmd+K. Fuzzy search over the views, panels and the handful of
   actions that otherwise mean walking to another tab.

   The view list is read off the DOM instead of hardcoded, so it stays in sync
   when a view is added or removed, and it picks up the XP and Phantom Thief
   relabels for free. Same for panels: the headers already carry the themed
   names, so "news" or "chronos" resolve the same way the user sees them. */
(function() {
  'use strict';

  var $e = function(s, r) { return (r || document).querySelector(s); };
  var $$e = function(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var PALETTE_THEMES = [
    { name: 'CYBER_YELLOW',  id: 'yellow', cls: 'theme-yellow' },
    { name: 'TOXIC_GREEN',   id: 'green',  cls: 'theme-green' },
    { name: 'COBALT_BLUE',   id: 'blue',   cls: 'theme-blue' },
    { name: 'BLOOD_RED',     id: 'red',    cls: 'theme-red' },
    { name: 'PHANTOM_THIEF', id: 'p5',     cls: 'theme-p5' },
    { name: 'WINDOWS_XP',    id: 'xp', cls: 'theme-xp' }
  ];

  var currentView = function() {
    var a = $e('.view.active');
    return a ? a.dataset.view : null;
  };

  /* Normalise for matching: drop accents, keep letters and digits.
     "radio" then matches RADIO, "perfil" matches PROFILE. */
  function norm(s) {
    return (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  /* Subsequence match, with a bonus for matches at word starts.
     "xp" finds "WINDOWS_XP" without matching every "x" along the way. */
  function fuzzy(hay, needle) {
    var h = norm(hay);
    var n = norm(needle);
    if (!n) return { score: 0, hits: [] };
    var hi = 0;
    var score = 0;
    var streak = 0;
    var hits = [];
    for (var i = 0; i < n.length; i++) {
      var c = n[i];
      var found = h.indexOf(c, hi);
      if (found === -1) return null;
      var wordStart = found === 0 || /[\s_\-./]/.test(h[found - 1]);
      streak = found === hi && i > 0 ? streak + 1 : 0;
      score += 10 + streak * 6 + (wordStart ? 8 : 0) - Math.min(found - hi, 12);
      if (wordStart) hits.push(found);
      hi = found + 1;
    }
    // shorter haystacks win ties, so "CHRONOS" beats "CHRONOS_EXTRA_THING"
    return { score: score - h.length * 0.1, hits: hits };
  }

  function highlight(text, hits) {
    if (!hits || !hits.length) return escapeHTML(text);
    var out = '';
    var set = {};
    hits.forEach(function(i) { set[i] = true; });
    for (var i = 0; i < text.length; i++) {
      out += set[i] ? '<em>' + escapeHTML(text[i]) + '</em>' : escapeHTML(text[i]);
    }
    return out;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var inInput = function() {
    var a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable || a.tagName === 'SELECT'));
  };

  /* Build the command list fresh on every open: labels drift with the theme,
     and which panels exist is whatever the current view rendered. */
  function buildCommands() {
    var out = [];
    var v = currentView();

    $$e('.nav-item[data-view]').forEach(function(n) {
      var view = n.dataset.view;
      var side = $e('.side-item[data-view="' + view + '"] .label');
      out.push({
        group: 'GO TO',
        title: n.textContent.trim() || view.toUpperCase(),
        sub: (side ? side.textContent.trim() : view) + (view === v ? '  [ACTIVE]' : ''),
        kw: view,
        run: function() { go(view); }
      });
    });

    (v ? $$e('.view.active .panel') : []).forEach(function(p, i) {
      var head = p.querySelector('.panel-header .left');
      var title = head ? head.textContent.trim().replace(/\s+/g, ' ') : 'PANEL_' + (i + 1);
      var sub = $e('.view.active .view-subtitle');
      var ref = p;
      out.push({
        group: 'PANEL',
        title: title,
        sub: sub ? sub.textContent.trim() : '',
        kw: title + ' ' + p.className,
        run: function() { reveal(ref); }
      });
    });

    PALETTE_THEMES.forEach(function(t) {
      out.push({
        group: 'THEME',
        title: t.name,
        sub: t.id === 'xp' ? 'RETRO_OS' : 'COLOR_PROTOCOL',
        run: function() { setTheme(t); }
      });
    });

    out.push({
      group: 'ACTION',
      title: 'CUSTOM THEME',
      sub: 'OPEN_VISUAL_EDITOR',
      run: function() { go('themes'); setTimeout(function() { scrollToTheme('custom'); }, 120); }
    });
    out.push({
      group: 'ACTION',
      title: 'SETTINGS',
      sub: 'OPEN_CONFIG',
      run: function() { click('settingsBtn'); }
    });
    out.push({
      group: 'ACTION',
      title: 'FULLSCREEN',
      sub: 'TOGGLE_DISPLAY_MODE',
      run: function() { click('fullscreenBtn'); }
    });
    out.push({
      group: 'ACTION',
      title: 'EXPORT BACKUP',
      sub: 'DOWNLOAD_LOCAL_STATE',
      run: function() { click('exportBtn'); }
    });
    out.push({
      group: 'ACTION',
      title: 'IMPORT BACKUP',
      sub: 'RESTORE_LOCAL_STATE',
      run: function() { click('importBtn'); }
    });
    out.push({
      group: 'ACTION',
      title: 'WIPE SYSTEM',
      sub: 'RESET_ALL_LOCAL_DATA',
      danger: true,
      // resetAllBtn lives in the settings modal, which is the least surprising
      // place to be when something is about to be deleted
      run: function() { click('settingsBtn'); setTimeout(function() { click('resetAllBtn'); }, 120); }
    });
    out.push({
      group: 'ACTION',
      title: 'REFRESH NEWS FEED',
      sub: 'RECONNECT_RSS_NODES',
      run: function() { go('terminal'); click('refreshNewsBtn'); }
    });
    out.push({
      group: 'ACTION',
      title: 'NEW SECTION',
      sub: 'ADD_TO_PROCESS_TABLE',
      run: function() { go('command'); click('newProcessBtn'); }
    });
    out.push({
      group: 'ACTION',
      title: 'WEB SEARCH',
      sub: 'FOCUS_QUERY_FIELD',
      run: function() { go('command'); setTimeout(function() { var s = $e('#searchInput'); if (s) s.focus(); }, 120); }
    });

    return out;
  }

  function go(view) {
    var item = $e('.nav-item[data-view="' + view + '"]');
    if (item) item.click();
  }

  function click(id) {
    var b = document.getElementById(id);
    if (b) b.click();
  }

  function scrollToTheme(t) {
    var card = $e('.theme-card[data-theme="' + t + '"]');
    if (card) card.scrollIntoView({ block: 'center' });
  }

  /* Panels live inside #main, which is the scroll container, so scrolling the
     window does nothing. Walk up to whatever actually overflows and set its
     scrollTop directly; scrollIntoView is unreliable here. */
  function scrollContainerFor(el) {
    var n = el.parentElement;
    while (n && n !== document.body) {
      var oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
      n = n.parentElement;
    }
    return null;
  }

  function centerIn(el) {
    var box = scrollContainerFor(el);
    if (!box) {
      el.scrollIntoView({ block: 'center' });
      return;
    }
    var er = el.getBoundingClientRect();
    var br = box.getBoundingClientRect();
    box.scrollTop += (er.top - br.top) - (box.clientHeight - er.height) / 2;
  }

  /* Panels are scroll targets, so make sure one is actually on screen. */
  function reveal(p) {
    if (p.classList.contains('collapsed')) {
      var b = p.querySelector('.collapse-btn');
      if (b) b.click();
    }
    // let the collapse transition settle before measuring
    setTimeout(function() { centerIn(p); }, 60);
  }

  function setTheme(t) {
    if (t.id === 'xp') {
      // XP lives on its own storage key, so drive it the way features.js does
      document.documentElement.className = t.cls;
      localStorage.setItem('sys_theme', 'xp');
      document.body.classList.remove('p5-active');
      if (window.P5_resetLabels) window.P5_resetLabels();
      if (window.XP_updateLabels) window.XP_updateLabels();
    } else {
      // The bundle's applyTheme() bails out while sys_theme says 'xp', so
      // write the same DOM it would and keep the two storage conventions in sync.
      document.documentElement.className = t.cls;
      localStorage.setItem('sys_theme', t.id);
      document.body.classList.toggle('p5-active', t.id === 'p5');
      if (t.id === 'p5') { if (window.P5_updateLabels) window.P5_updateLabels(); }
      else if (window.P5_resetLabels) window.P5_resetLabels();
      if (window.XP_resetLabels) window.XP_resetLabels();
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        var swatch = { yellow: '#fce300', green: '#00ff41', blue: '#00f1fd', red: '#ff3860', p5: '#d32f2f' };
        if (swatch[t.id]) meta.setAttribute('content', swatch[t.id]);
      }
    }
    $$e('.theme-card').forEach(function(c) {
      c.classList.toggle('current', c.dataset.theme === t.id);
    });
  }

  /* ===== UI ===== */
  var overlay, input, list, status, items = [], sel = 0, open = false, lastFocus = null;

  function build() {
    overlay = document.createElement('div');
    overlay.id = 'cmdPalette';
    overlay.className = 'cmd-palette';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Command palette');
    overlay.innerHTML =
      '<div class="cmd-box">' +
        '<div class="cmd-input-row">' +
          '<span class="cmd-caret">&gt;</span>' +
          '<input id="cmdPaletteInput" type="text" placeholder="TYPE A COMMAND..." autocomplete="off" ' +
            'autocorrect="off" autocapitalize="off" spellcheck="false" ' +
            'role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="cmdPaletteList" />' +
          '<kbd>ESC</kbd>' +
        '</div>' +
        '<ul class="cmd-list" id="cmdPaletteList" role="listbox" aria-label="Commands"></ul>' +
        '<div class="cmd-status"><span id="cmdPaletteStatus"></span><span class="cmd-hint">↑↓ MOVE · ENTER RUN</span></div>' +
      '</div>';
    document.body.appendChild(overlay);

    input = $e('#cmdPaletteInput');
    list = $e('#cmdPaletteList');
    status = $e('#cmdPaletteStatus');

    overlay.addEventListener('mousedown', function(e) {
      if (e.target === overlay) close();
    });
    input.addEventListener('input', render);
    input.addEventListener('keydown', onKey);
    list.addEventListener('mousedown', function(e) {
      var li = e.target.closest('.cmd-item');
      if (!li) return;
      e.preventDefault();
      sel = parseInt(li.dataset.i, 10);
      runSel();
    });
  }

  function onKey(e) {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runSel();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  }

  function move(d) {
    if (!items.length) return;
    sel = (sel + d + items.length) % items.length;
    paintSel();
  }

  function paintSel() {
    $$e('.cmd-item', list).forEach(function(li, i) {
      var on = i === sel;
      li.classList.toggle('sel', on);
      li.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
    });
  }

  function runSel() {
    var c = items[sel];
    if (!c) return;
    close();
    // let the close animation settle before the view swaps under the user
    setTimeout(function() { c.run(); }, 0);
  }

  function render() {
    var q = input.value;
    var scored = [];
    buildCommands().forEach(function(c) {
      var whole = fuzzy(c.title + ' ' + (c.sub || '') + ' ' + (c.kw || ''), q);
      if (!whole) return;
      var titleOnly = fuzzy(c.title, q);
      scored.push({ c: c, score: whole.score, hits: titleOnly ? titleOnly.hits : [] });
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    scored = scored.slice(0, 40);
    items = scored.map(function(s) { return s.c; });
    sel = 0;

    list.innerHTML = items.length ? items.map(function(c, i) {
      return '<li class="cmd-item' + (c.danger ? ' danger' : '') + '" role="option" ' +
        'aria-selected="' + (i === sel) + '" data-i="' + i + '">' +
        '<span class="cmd-g">' + escapeHTML(c.group) + '</span>' +
        '<span class="cmd-t">' + highlight(c.title, scored[i].hits) + '</span>' +
        (c.sub ? '<span class="cmd-s">' + escapeHTML(c.sub) + '</span>' : '') +
      '</li>';
    }).join('') : '<li class="cmd-none">NO_MATCH // ' + escapeHTML(q.toUpperCase()) + '</li>';

    status.textContent = items.length ? items.length + ' RESULT' + (items.length === 1 ? '' : 'S') : 'NO RESULTS';
    paintSel();
  }

  function show() {
    if (open) return;
    if (!overlay) build();
    open = true;
    lastFocus = document.activeElement;
    input.value = '';
    render();
    overlay.classList.add('open');
    document.body.classList.add('cmd-open');
    input.focus();
  }

  function close() {
    if (!open) return;
    open = false;
    overlay.classList.remove('open');
    document.body.classList.remove('cmd-open');
    // the palette input must not keep focus while it is hidden, or the next
    // keypress goes to an invisible field and the shortcut looks dead
    var back = (lastFocus && lastFocus.isConnected && lastFocus !== document.body) ? lastFocus : null;
    if (back && back.focus) back.focus();
    else if (input && input.blur) input.blur();
  }

  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      open ? close() : show();
      return;
    }
    // bare / is already taken by the bundle to focus the search field
    if ((e.key === '?' || e.code === 'Slash') && (e.shiftKey || e.key === '?') && !inInput() && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      show();
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    // small nudge in the topbar so the shortcut is discoverable
    var bar = $e('.topbar-right');
    if (bar && !$e('#cmdPaletteHint')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.id = 'cmdPaletteHint';
      b.className = 'icon-btn cmd-hint-btn';
      b.title = 'Command palette (Ctrl+K)';
      b.setAttribute('aria-label', 'Open command palette');
      b.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">search</span>';
      b.addEventListener('click', show);
      bar.insertBefore(b, $e('#fullscreenBtn'));
    }
  });

  window.cmdPalette = { show: show, close: close };

})();

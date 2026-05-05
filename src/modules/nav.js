// ============================================================
// NAV - View switcher + mobile drawer + keyboard shortcuts
// ============================================================

const VIEWS = ['terminal', 'command', 'chronos', 'tools', 'themes'];
let currentView = 'terminal';

export function initNav() {
  // Click en cualquier nav-item o side-item
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const v = el.dataset.view;
      if (v) switchView(v);
      closeDrawer();
    });
  });

  // Hamburger
  const hamburger = document.getElementById('hamburgerBtn');
  if (hamburger) hamburger.addEventListener('click', toggleDrawer);

  // Backdrop click
  const backdrop = document.getElementById('sidebarBackdrop');
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Ctrl+1..5 → switch view
    if (e.ctrlKey && /^[1-5]$/.test(e.key)) {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      switchView(VIEWS[idx]);
      return;
    }

    // "/" → focus search (solo si no está escribiendo)
    if (e.key === '/' && !isTyping()) {
      e.preventDefault();
      switchView('command');
      setTimeout(() => {
        const input = document.getElementById('searchInput');
        if (input) input.focus();
      }, 100);
      return;
    }

    // Esc → cierra drawer/modal
    if (e.key === 'Escape') {
      closeDrawer();
      const modal = document.getElementById('settingsModal');
      if (modal && modal.classList.contains('open')) {
        modal.classList.remove('open');
      }
    }
  });

  // Hash routing inicial
  const hash = window.location.hash.replace('#', '');
  if (VIEWS.includes(hash)) {
    switchView(hash);
  }

  // Escuchar cambios de hash (back/forward del navegador)
  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '');
    if (VIEWS.includes(h) && h !== currentView) {
      switchView(h, false);
    }
  });
}

export function switchView(view, updateHash = true) {
  if (!VIEWS.includes(view)) return;
  currentView = view;

  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.dataset.view === view);
  });
  document.querySelectorAll('.nav-item, .side-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });

  if (updateHash) {
    history.replaceState(null, '', `#${view}`);
  }

  // Scroll al top del main al cambiar de vista
  const main = document.getElementById('main');
  if (main) main.scrollTop = 0;

  // Custom event para que otros módulos reaccionen
  document.dispatchEvent(new CustomEvent('view:changed', { detail: { view } }));
}

export function getCurrentView() {
  return currentView;
}

// ---------- Drawer (mobile) ----------
function toggleDrawer() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !backdrop) return;
  const isOpen = sidebar.classList.toggle('open');
  backdrop.classList.toggle('open', isOpen);
}

function closeDrawer() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

function isTyping() {
  const a = document.activeElement;
  if (!a) return false;
  const tag = a.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || a.isContentEditable;
}

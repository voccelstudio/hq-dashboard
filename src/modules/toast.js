// ============================================================
// TOAST - Notificaciones in-app
// ============================================================
// Uso: toast('mensaje', 'ok' | 'warn' | 'err' | 'info', 'TAG')
// ============================================================

let container = null;
const DEFAULT_DURATION = 3500;

export function initToasts() {
  container = document.getElementById('toastContainer');
}

export function toast(msg, type = 'info', tag = 'SYS', duration = DEFAULT_DURATION) {
  if (!container) container = document.getElementById('toastContainer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="tag">[ ${escape(tag)} ]</span>
    <span>${escape(msg)}</span>
  `;
  container.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function escape(s) {
  return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

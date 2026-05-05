// ============================================================
// DAEMON LOG - Global logger con UI en Tools view
// ============================================================

const MAX_ENTRIES = 50;
const VISIBLE_ENTRIES = 12;

const entries = [];

export function log(level, tag, msg) {
  const ts = new Date().toTimeString().slice(0, 8);
  entries.unshift({
    ts,
    level: (level || 'info').toLowerCase(),
    tag: tag || 'SYS',
    msg: msg || '',
  });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  render();
  // Console mirror para debug en dev
  const prefix = `[${ts}] [${tag}]`;
  if (level === 'ERR') console.error(prefix, msg);
  else if (level === 'WARN') console.warn(prefix, msg);
  else console.log(prefix, msg);
}

function render() {
  const el = document.getElementById('daemonLog');
  if (!el) return;
  el.innerHTML = entries
    .slice(0, VISIBLE_ENTRIES)
    .map(
      e => `
    <div class="row ${escapeAttr(e.level)}">
      <span class="ts">[ ${escapeText(e.ts)} ]</span>
      <span class="tag">${escapeText(e.tag)}:</span>
      <span class="msg">${escapeText(e.msg)}</span>
    </div>
  `
    )
    .join('');
}

function escapeText(s) {
  return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}
function escapeAttr(s) {
  return String(s).replace(/[^a-z0-9_-]/gi, '');
}

export function initDaemonLog() {
  // Logs iniciales
  log('OK', 'SYS_NET', 'ETH0 LINK UP (10Gbps)');
  log('INFO', 'VPN', 'CONNECTED (NODE_ZEPHYR)');
  log('OK', 'FIREWALL', 'ACTIVE - rules loaded');
  log('INFO', 'CRON', 'Backup script scheduled');
}

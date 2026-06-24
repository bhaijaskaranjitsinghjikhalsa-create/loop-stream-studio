// Shared client helpers
window.JSK = (function () {
  function fmt(bytes) {
    if (!bytes || bytes < 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < u.length - 1) { bytes /= 1024; i++; }
    return bytes.toFixed(i ? 1 : 0) + ' ' + u[i];
  }
  function fmtBps(bps) {
    return fmt(bps) + '/s';
  }
  function fmtDuration(sec) {
    if (!sec || sec < 0) return '—';
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return (h ? h + 'h ' : '') + (m || h ? m + 'm ' : '') + s + 's';
  }
  function fmtTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString();
  }
  async function api(path, opts = {}) {
    const r = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `HTTP ${r.status}`);
    }
    return r.json();
  }
  function toast(msg, type = 'info') {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText =
        'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px';
      document.body.appendChild(el);
    }
    const t = document.createElement('div');
    const colors = {
      info: 'background:linear-gradient(135deg,#a855f7,#ec4899);color:white',
      error: 'background:#7f1d1d;color:#fecaca;border:1px solid #b91c1c',
      success: 'background:#064e3b;color:#a7f3d0;border:1px solid #10b981',
    };
    t.style.cssText =
      'padding:10px 16px;border-radius:10px;font-size:14px;font-weight:500;box-shadow:0 8px 20px rgba(0,0,0,0.4);' +
      (colors[type] || colors.info);
    t.textContent = msg;
    el.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }
  return { fmt, fmtBps, fmtDuration, fmtTime, api, toast };
})();

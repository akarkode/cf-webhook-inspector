const MAX_LOG_ENTRIES = 200;
const LOG_PREFIX = 'log:';

// Escape HTML special characters for safe embedding in HTML attributes / text nodes.
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Safely embed arbitrary data as a JS literal inside a <script> block.
function safeJson(data) {
  return JSON.stringify(data).replace(/<\//g, '<\\/');
}

async function collectRecentLogs(env) {
  const keys = [];
  let cursor;

  do {
    const res = await env.LOGS.list({
      prefix: LOG_PREFIX,
      cursor,
      limit: MAX_LOG_ENTRIES,
    });
    keys.push(...res.keys.map((k) => k.name));
    cursor = res.list_complete || keys.length >= MAX_LOG_ENTRIES ? null : res.cursor;
  } while (cursor);

  const sorted = keys.sort((a, b) => (a < b ? 1 : -1)).slice(0, MAX_LOG_ENTRIES);
  if (!sorted.length) return [];

  const logs = await Promise.all(sorted.map((name) => env.LOGS.get(name, { type: 'json' })));
  return logs.filter(Boolean);
}

function buildHTML(logs, domain, kvError) {
  const total = logs.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Webhook Inspector \u2014 ${escapeHtml(domain)}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;min-height:100vh}

    /* ── Header ── */
    .hdr{background:linear-gradient(135deg,#161b22 0%,#1c2128 100%);border-bottom:1px solid #30363d;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;position:sticky;top:0;z-index:100}
    .hdr-left{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .logo{display:flex;align-items:center;gap:8px}
    .logo-icon{width:28px;height:28px;background:linear-gradient(135deg,#4f6ef7,#8b5cf6);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:15px}
    .logo-text{font-size:15px;font-weight:700;color:#f0f6fc}
    .domain-tag{background:#21262d;border:1px solid #30363d;border-radius:6px;padding:3px 10px;font-family:'SFMono-Regular',Consolas,monospace;font-size:12px;color:#8b949e}
    .stat-pill{background:#1f2937;border:1px solid #374151;border-radius:20px;padding:3px 12px;font-size:12px;color:#9ca3af}
    .stat-pill strong{color:#60a5fa}
    .hdr-right{display:flex;align-items:center;gap:8px}
    .btn{padding:6px 14px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid transparent;transition:background .15s,color .15s;display:inline-flex;align-items:center;gap:5px}
    .btn-danger{background:#21262d;border-color:#ef4444;color:#ef4444}
    .btn-danger:hover{background:#ef4444;color:#fff}
    .btn-toggle{background:#21262d;border-color:#30363d;color:#8b949e}
    .btn-toggle.on{background:rgba(34,197,94,.15);border-color:#22c55e;color:#22c55e}

    /* ── Filters ── */
    .filters{background:#161b22;border-bottom:1px solid #30363d;padding:10px 24px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .filter-lbl{color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
    .fi{background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:6px 10px;color:#c9d1d9;font-size:12px;outline:none;transition:border-color .15s}
    .fi:focus{border-color:#4f6ef7}
    .fi::placeholder{color:#4b5563}
    select.fi{cursor:pointer}
    .btn-clr-f{background:none;border:none;color:#4b5563;font-size:11px;cursor:pointer;padding:4px 8px;border-radius:4px}
    .btn-clr-f:hover{color:#ef4444;background:rgba(239,68,68,.1)}

    /* ── Error banner ── */
    .err-banner{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:10px 16px;margin:14px 24px;color:#ef4444;font-size:12px}

    /* ── Table ── */
    .tbl-wrap{padding:14px 24px;overflow-x:auto}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead th{background:#161b22;color:#8b949e;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:9px 12px;text-align:left;border-bottom:1px solid #30363d;white-space:nowrap;position:sticky;top:57px;z-index:10}
    tbody tr{border-bottom:1px solid #21262d;transition:background .1s}
    tbody tr:hover{background:#1c2128}
    tbody td{padding:8px 12px;vertical-align:top;color:#c9d1d9}
    tr.hidden-row{display:none}
    .td-time{white-space:nowrap;min-width:130px}
    .ts-abs{display:block;color:#e6edf3;font-size:11px;font-family:'SFMono-Regular',Consolas,monospace}
    .ts-rel{display:block;color:#6b7280;font-size:10px;margin-top:2px}
    .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;color:#fff;white-space:nowrap;letter-spacing:.3px}
    .mono{font-family:'SFMono-Regular',Consolas,monospace}
    .ov{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .empty{text-align:center;padding:60px 20px;color:#4b5563}
    .empty strong{color:#60a5fa}

    /* ── Footer ── */
    .footer{padding:10px 24px;border-top:1px solid #21262d;color:#4b5563;font-size:11px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px}
    .rf-ind{display:flex;align-items:center;gap:6px}
    .rf-dot{width:7px;height:7px;border-radius:50%;background:#22c55e}
    .rf-dot.paused{background:#6b7280}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    .rf-dot.active{animation:pulse 1.5s ease-in-out infinite}

    @media(max-width:768px){.hdr,.filters,.tbl-wrap,.footer{padding-left:14px;padding-right:14px}.ov{max-width:100px}}
  </style>
</head>
<body>

<header class="hdr">
  <div class="hdr-left">
    <div class="logo">
      <div class="logo-icon">&#128269;</div>
      <span class="logo-text">Webhook Inspector</span>
    </div>
    <span class="domain-tag">${escapeHtml(domain)}</span>
    <span class="stat-pill">Total: <strong id="total-count">${total}</strong> requests</span>
  </div>
  <div class="hdr-right">
    <button class="btn btn-toggle on" id="rf-btn" onclick="toggleRefresh()">
      &#x21BB; Auto-refresh: <span id="rf-status">ON</span>
    </button>
    <button class="btn btn-danger" onclick="clearLogs()">&#x1F5D1; Clear Logs</button>
  </div>
</header>

<div class="filters">
  <span class="filter-lbl">Filter:</span>
  <select class="fi" id="f-method" onchange="applyFilters()">
    <option value="">All Methods</option>
    <option value="GET">GET</option>
    <option value="POST">POST</option>
    <option value="PUT">PUT</option>
    <option value="DELETE">DELETE</option>
    <option value="PATCH">PATCH</option>
    <option value="HEAD">HEAD</option>
    <option value="OPTIONS">OPTIONS</option>
  </select>
  <input class="fi" id="f-path" type="text" placeholder="Filter by path&hellip;" oninput="applyFilters()" />
  <input class="fi" id="f-ip" type="text" placeholder="Filter by IP&hellip;" oninput="applyFilters()" />
  <input class="fi" id="f-search" type="text" placeholder="Search all fields&hellip;" oninput="applyFilters()" />
  <button class="btn-clr-f" onclick="clearFilters()">&#x2715; Clear filters</button>
</div>

${kvError ? `<div class="err-banner">&#x26A0;&#xFE0F; KV Error: ${escapeHtml(kvError)}</div>` : ''}

<div class="tbl-wrap">
  <table>
    <thead>
      <tr>
        <th>Time (WIB / UTC+7)</th>
        <th>Method</th>
        <th>Path</th>
        <th>IP</th>
        <th>Country</th>
        <th>Status</th>
        <th>User-Agent</th>
        <th>Body</th>
      </tr>
    </thead>
    <tbody id="log-tbody"></tbody>
  </table>
</div>

<footer class="footer">
  <span>Showing <span id="vis-count">${total}</span> of <span id="total-footer">${total}</span> entries &bull; displaying latest 200 (entries auto-expire after 7 days)</span>
  <div class="rf-ind">
    <div class="rf-dot active" id="rf-dot"></div>
    <span id="rf-label">Auto-refresh every 5s</span>
  </div>
</footer>

<script>
(function () {
  var ALL_LOGS = ${safeJson(logs)};
  var autoRefresh = true;
  var rfTimer = null;
  var INTERVAL = 5000;

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function methodColor(m) {
    var c = {GET:'#3b82f6',POST:'#22c55e',DELETE:'#ef4444',PUT:'#f59e0b',PATCH:'#8b5cf6',HEAD:'#06b6d4',OPTIONS:'#6b7280'};
    return c[m] || '#6b7280';
  }

  function statusColor(s) {
    s = parseInt(s, 10);
    if (s >= 500) return '#ef4444';
    if (s >= 400) return '#f59e0b';
    if (s >= 300) return '#3b82f6';
    if (s >= 200) return '#22c55e';
    return '#6b7280';
  }

  function fmtWIB(iso) {
    try {
      return new Date(iso).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      });
    } catch (e) { return iso; }
  }

  function timeAgo(iso) {
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 5)    return 'baru saja';
    if (d < 60)   return d + ' detik lalu';
    if (d < 3600) return Math.floor(d / 60) + ' menit lalu';
    if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
    return Math.floor(d / 86400) + ' hari lalu';
  }

  function renderTable(logs) {
    var tbody = document.getElementById('log-tbody');
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">No logs recorded yet. Send requests to this domain to start logging.</td></tr>';
      updateCounts(0, 0);
      return;
    }
    var html = '';
    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      var mc = methodColor(l.method);
      var sc = statusColor(l.status);
      html +=
        '<tr data-method="' + esc(l.method) + '" data-path="' + esc(l.path) + '" data-ip="' + esc(l.ip) + '" data-ua="' + esc(l.userAgent) + '" data-body="' + esc(l.body) + '">' +
        '<td class="td-time"><span class="ts-abs">' + esc(fmtWIB(l.timestamp)) + '</span><span class="ts-rel">' + esc(timeAgo(l.timestamp)) + '</span></td>' +
        '<td><span class="badge" style="background:' + mc + '">' + esc(l.method) + '</span></td>' +
        '<td class="mono ov" title="' + esc(l.path) + '">' + esc(l.path) + '</td>' +
        '<td class="mono">' + esc(l.ip) + '</td>' +
        '<td>' + esc(l.country) + '</td>' +
        '<td><span class="badge" style="background:' + sc + '">' + esc(String(l.status)) + '</span></td>' +
        '<td class="ov" title="' + esc(l.userAgent) + '">' + esc(l.userAgent) + '</td>' +
        '<td class="mono ov" title="' + esc(l.body) + '">' + esc(l.body) + '</td>' +
        '</tr>';
    }
    tbody.innerHTML = html;
    updateCounts(logs.length, logs.length);
  }

  function updateCounts(visible, total) {
    document.getElementById('total-count').textContent = total;
    document.getElementById('total-footer').textContent = total;
    document.getElementById('vis-count').textContent = visible;
  }

  function applyFilters() {
    var fMethod = document.getElementById('f-method').value;
    var fPath   = document.getElementById('f-path').value.toLowerCase();
    var fIp     = document.getElementById('f-ip').value.toLowerCase();
    var fSearch = document.getElementById('f-search').value.toLowerCase();

    var rows = document.querySelectorAll('#log-tbody tr[data-method]');
    var visible = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var dm = r.getAttribute('data-method') || '';
      var dp = (r.getAttribute('data-path') || '').toLowerCase();
      var di = (r.getAttribute('data-ip') || '').toLowerCase();
      var du = (r.getAttribute('data-ua') || '').toLowerCase();
      var db = (r.getAttribute('data-body') || '').toLowerCase();

      var show = true;
      if (fMethod && dm !== fMethod) show = false;
      if (fPath   && dp.indexOf(fPath) === -1) show = false;
      if (fIp     && di.indexOf(fIp)   === -1) show = false;
      if (fSearch && dp.indexOf(fSearch) === -1 && di.indexOf(fSearch) === -1 &&
                     du.indexOf(fSearch) === -1 && db.indexOf(fSearch) === -1) show = false;

      r.className = show ? '' : 'hidden-row';
      if (show) visible++;
    }
    document.getElementById('vis-count').textContent = visible;
  }

  function clearFilters() {
    document.getElementById('f-method').value = '';
    document.getElementById('f-path').value   = '';
    document.getElementById('f-ip').value     = '';
    document.getElementById('f-search').value = '';
    applyFilters();
  }

  function fetchLogs() {
    fetch(location.pathname + '?api=1')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (Array.isArray(data.logs)) {
          ALL_LOGS = data.logs;
          renderTable(ALL_LOGS);
          applyFilters();
        }
      })
      .catch(function () {});
  }

  function scheduleRefresh() {
    if (rfTimer) clearTimeout(rfTimer);
    if (autoRefresh) {
      rfTimer = setTimeout(function () { fetchLogs(); scheduleRefresh(); }, INTERVAL);
    }
  }

  function toggleRefresh() {
    autoRefresh = !autoRefresh;
    var btn   = document.getElementById('rf-btn');
    var dot   = document.getElementById('rf-dot');
    var lbl   = document.getElementById('rf-label');
    var st    = document.getElementById('rf-status');
    if (autoRefresh) {
      btn.classList.add('on');
      st.textContent  = 'ON';
      dot.className   = 'rf-dot active';
      lbl.textContent = 'Auto-refresh every 5s';
      scheduleRefresh();
    } else {
      btn.classList.remove('on');
      st.textContent  = 'OFF';
      dot.className   = 'rf-dot paused';
      lbl.textContent = 'Auto-refresh paused';
      if (rfTimer) { clearTimeout(rfTimer); rfTimer = null; }
    }
  }

  function clearLogs() {
    if (!confirm('Clear all logs? This cannot be undone.')) return;
    fetch('/clear', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          ALL_LOGS = [];
          renderTable([]);
        } else {
          alert('Failed to clear logs: ' + (data.error || 'unknown error'));
        }
      })
      .catch(function () { alert('Failed to clear logs.'); });
  }

  // Update relative timestamps every 15 seconds
  function refreshRelative() {
    var rows = document.querySelectorAll('#log-tbody tr[data-method]');
    for (var i = 0; i < rows.length; i++) {
      if (ALL_LOGS[i]) {
        var rel = rows[i].querySelector('.ts-rel');
        if (rel) rel.textContent = timeAgo(ALL_LOGS[i].timestamp);
      }
    }
  }

  // Expose for onclick attributes
  window.toggleRefresh = toggleRefresh;
  window.clearLogs = clearLogs;
  window.applyFilters = applyFilters;
  window.clearFilters = clearFilters;

  // Boot
  renderTable(ALL_LOGS);
  applyFilters();
  scheduleRefresh();
  setInterval(refreshRelative, 15000);
})();
</script>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // JSON API used by auto-refresh
  if (url.searchParams.get('api') === '1') {
    let logs = [];
    try {
      logs = await collectRecentLogs(env);
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ logs }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Full HTML dashboard
  let logs = [];
  let kvError = null;
  try {
    logs = await collectRecentLogs(env);
  } catch (e) {
    kvError = e.message;
  }

  return new Response(buildHTML(logs, url.hostname, kvError), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

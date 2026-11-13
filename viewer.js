'use strict';
/* Halaman pelihat hanya-lihat. Data terenkripsi; didekripsi di browser setelah password diketik. */
const root = document.getElementById('root');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE = 100;
const FLASK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/></svg>';

const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function decrypt(pkg, password) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(pkg.salt), iterations: pkg.iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(pkg.iv) }, key, b64(pkg.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}
function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? `${m[3]} ${MON[+m[2] - 1]} ${m[1]}` : esc(s);
}

let pkg = null, data = null;
const st = { open: false, a: 0, q: '', sort: -1, dir: 1, from: '', to: '', dcol: -1, page: 1 };

function lockView(msg) {
  root.innerHTML = `<div class="lock"><form class="lc" id="f"><div class="logo">${FLASK}</div><h2>Lab Data Viewer</h2><div class="s">View-only. Enter the password you were given.</div>
  ${msg ? `<div class="err">${esc(msg)}</div>` : ''}<input type="password" id="pw" autocomplete="current-password" placeholder="Password" autofocus>
  <button class="btn p" style="width:100%;justify-content:center;padding:11px" id="go">Open</button>
  <div class="note">The data is encrypted. It is opened inside your browser and never sent anywhere.</div></form></div>`;
  document.getElementById('f').onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('go'), pw = document.getElementById('pw').value;
    if (!pw) return;
    btn.disabled = true; btn.textContent = 'Opening…';
    try {
      if (!pkg) { const r = await fetch('data.enc.json', { cache: 'no-store' }); if (!r.ok) throw new Error('missing'); pkg = await r.json(); }
      data = await decrypt(pkg, pw);
      st.a = 0; st.open = data.archives.length < 2; resetFilters(); view();
    } catch (err) {
      lockView(err && err.name === 'OperationError' ? 'Wrong password. Please try again.' :
        (window.isSecureContext ? 'Cannot open the data. Please check your connection and try again.' : 'This page must be opened with https://.'));
    }
  };
}

function resetFilters() { Object.assign(st, { q: '', sort: -1, dir: 1, from: '', to: '', page: 1 }); st.dcol = data.archives[st.a].columns.findIndex(c => c.type === 'date'); }

function cell(c, v) {
  if (v === null || v === undefined || v === '') return '';
  if (c.type === 'date') return fmtDate(v);
  if (c.type === 'choice') { const i = Math.max(0, c.choices.indexOf(v)), k = c.colors && c.colors[i]; return `<span class="badge ${k ? 'k' + k : 'b' + (i % 6)}">${esc(v)}</span>`; }
  return esc(v);
}

const ICONS = {
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  arch: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bk: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  log: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/>',
  clip: '<path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 5 5l-9 9a1.7 1.7 0 0 1-2.5-2.5l8-8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
};
const icon = n => `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ICONS.arch}</svg>`;

function cardsView() {
  root.innerHTML = `<div class="wrap"><div class="head"><div class="logo">${FLASK}</div><div><h1>${esc(data.title)}</h1><small>View only · data as of ${esc(data.generated_at)}</small></div><div class="sp"></div><button class="btn" id="lk">Lock</button></div>
  <div class="grid">${data.archives.map((a, i) => `<div class="card" data-a="${i}"><div class="thumb"><div class="folder">${icon(a.icon)}</div></div><h3 title="${esc(a.name)}">${esc(a.name)}</h3><p>${a.rows.length} records</p><button class="btn p open" data-a="${i}">Open archive →</button></div>`).join('')}</div></div>`;
  document.getElementById('lk').onclick = () => { data = null; lockView(''); };
  root.querySelectorAll('.card').forEach(c => c.onclick = () => { st.a = +c.dataset.a; st.open = true; resetFilters(); view(); });
}

function view() {
  if (!st.open) return cardsView();
  const A = data.archives[st.a], cols = A.columns;
  const dateCols = cols.map((c, i) => [c, i]).filter(([c]) => c.type === 'date');
  let rows = A.rows;
  const q = st.q.trim().toLowerCase();
  if (q) rows = rows.filter(r => r.some(v => v !== null && String(v).toLowerCase().includes(q)));
  if (st.dcol >= 0 && (st.from || st.to)) rows = rows.filter(r => { const v = r[st.dcol]; return v && (!st.from || v >= st.from) && (!st.to || v <= st.to); });
  if (st.sort >= 0) {
    const i = st.sort, num = cols[i].type === 'number';
    rows = rows.slice().sort((x, y) => {
      const a = x[i], b = y[i];
      if (a === null || a === '') return 1; if (b === null || b === '') return -1;
      return (num ? a - b : String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })) * st.dir;
    });
  }
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  st.page = Math.min(st.page, pages);
  const slice = rows.slice((st.page - 1) * PAGE, st.page * PAGE);
  root.innerHTML = `<div class="wrap"><div class="head"><div class="logo">${FLASK}</div><div><h1>${esc(data.title)}</h1><small>View only · data as of ${esc(data.generated_at)}</small></div><div class="sp"></div><button class="btn" id="lk">Lock</button></div>
  ${data.archives.length > 1 ? '<div style="margin-bottom:12px"><a href="#" id="bk" style="color:var(--teal2);text-decoration:none;font-size:13px;font-weight:600">← All archives</a></div>' : ''}
  <div class="panel"><div class="bar"><h2>${esc(A.name)}</h2><input class="inp" id="q" placeholder="Search…" value="${esc(st.q)}">
  ${dateCols.length ? `<select class="inp" id="dc" style="min-width:110px">${dateCols.map(([c, i]) => `<option value="${i}" ${i === st.dcol ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select><input class="inp" type="date" id="df" value="${st.from}" title="From"><input class="inp" type="date" id="dt" value="${st.to}" title="To">` : ''}</div>
  <div class="tw"><table><thead><tr>${cols.map((c, i) => `<th class="${c.type === 'number' ? 'num' : ''}" data-s="${i}">${esc(c.title)} ${st.sort === i ? (st.dir > 0 ? '↑' : '↓') : ''}</th>`).join('')}</tr></thead>
  <tbody>${slice.length ? slice.map(r => `<tr>${cols.map((c, i) => `<td class="${c.type === 'number' ? 'num' : ''}">${cell(c, r[i])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="empty">No records found.</td></tr>`}</tbody></table></div>
  <div class="foot"><span>${slice.length} of ${rows.length} shown · view only</span><span class="pager"><button class="btn" id="pv" ${st.page <= 1 ? 'disabled' : ''}>‹ Prev</button> Page ${st.page} / ${pages} <button class="btn" id="nx" ${st.page >= pages ? 'disabled' : ''}>Next ›</button></span></div></div></div>`;
  const $ = id => document.getElementById(id);
  $('lk').onclick = () => { data = null; lockView(''); };
  if ($('bk')) $('bk').onclick = e => { e.preventDefault(); st.open = false; view(); };
  root.querySelectorAll('[data-s]').forEach(t => t.onclick = () => { const i = +t.dataset.s; st.dir = st.sort === i ? -st.dir : 1; st.sort = i; st.page = 1; view(); });
  $('q').oninput = e => { st.q = e.target.value; st.page = 1; const p = e.target.selectionStart; view(); const n = $('q'); n.focus(); n.setSelectionRange(p, p); };
  if ($('dc')) { $('dc').onchange = e => { st.dcol = +e.target.value; view(); }; $('df').onchange = e => { st.from = e.target.value; st.page = 1; view(); }; $('dt').onchange = e => { st.to = e.target.value; st.page = 1; view(); }; }
  $('pv').onclick = () => { st.page--; view(); }; $('nx').onclick = () => { st.page++; view(); };
}

lockView('');

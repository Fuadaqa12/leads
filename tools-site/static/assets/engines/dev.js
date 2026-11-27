TK.register('dev', function (root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg, mode = o.mode;
  function btn(icon, label, fn, cls) { var b = el('<button class="btn ' + (cls || 'sec sm') + '" type="button">' + svg(icon) + '<span>' + esc(label) + '</span></button>'); b.onclick = fn; return b; }
  function area(ph, ro) { var a = el('<textarea class="inp mono" spellcheck="false"' + (ro ? ' readonly' : '') + '></textarea>'); if (ph) a.placeholder = ph; return a; }
  function labeled(label, node, extra) { var w = el('<div class="stack" style="gap:8px"><div class="row" style="justify-content:space-between"><span class="lbl">' + esc(label) + '</span><div class="row"></div></div></div>'); if (extra) extra.forEach(function (x) { K.$('.row .row', w).appendChild(x); }); w.appendChild(node); return w; }
  function rnd(n) { var a = new Uint32Array(n); crypto.getRandomValues(a); return a; }

  if (mode === 'json') {
    var i = area('{"name":"value","list":[1,2,3]}'), out = area('', true), msg = el('<p class="muted" style="margin:0"></p>'), ind = 2;
    function fmt(min) {
      var v = i.value.trim(); if (!v) { out.value = ''; msg.textContent = ''; return; }
      try { var j = JSON.parse(v); out.value = min ? JSON.stringify(j) : JSON.stringify(j, null, ind === 'tab' ? '\t' : ind); msg.innerHTML = '<span class="okmsg">✓ ' + esc(t('valid_json')) + '</span>'; }
      catch (e) { var m = String(e.message); msg.innerHTML = '<span class="err">✗ ' + esc(t('invalid_json')) + ': ' + esc(m) + '</span>'; }
    }
    var bar = el('<div class="row"></div>');
    bar.append(btn('braces', t('format'), function () { fmt(false); }, 'btn'), btn('compress', t('minify'), function () { fmt(true); }), K.seg([[2, '2'], [4, '4'], ['tab', 'Tab']], 2, function (v) { ind = v; fmt(false); }));
    i.oninput = K.debounce(function () { fmt(false); }, 300);
    root.append(labeled(t('input'), i), bar, msg, labeled(t('result'), out, [btn('copy', t('copy'), function () { K.copy(out.value); }), btn('download', '.json', function () { K.download(new Blob([out.value], { type: 'application/json' }), 'data.json'); })]));
    i.style.minHeight = out.style.minHeight = '240px';
  }
  else if (mode === 'base64' || mode === 'url') {
    var dir = 'enc', a = area(t('paste_text')), b = area('', true), m2 = el('<p class="err hide" style="margin:0"></p>');
    var full = false;
    function run() {
      m2.classList.add('hide');
      try {
        if (mode === 'base64') b.value = dir === 'enc' ? btoa(String.fromCharCode.apply(null, new TextEncoder().encode(a.value))) : new TextDecoder().decode(Uint8Array.from(atob(a.value.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')), function (c) { return c.charCodeAt(0); }));
        else b.value = dir === 'enc' ? (full ? encodeURI(a.value) : encodeURIComponent(a.value)) : decodeURIComponent(a.value.replace(/\+/g, ' '));
      } catch (e) { b.value = ''; m2.textContent = t(mode === 'base64' ? 'invalid_b64' : 'invalid_input'); m2.classList.remove('hide'); }
    }
    var sw = btn('convert', t('swap'), function () { a.value = b.value; dir = dir === 'enc' ? 'dec' : 'enc'; K.$$('.seg button', root).forEach(function (x, ix) { x.classList.toggle('on', (ix === 0) === (dir === 'enc')); }); run(); });
    var bar2 = el('<div class="row"></div>');
    bar2.append(K.seg([['enc', t('encode')], ['dec', t('decode')]], 'enc', function (v) { dir = v; run(); }), sw);
    if (mode === 'url') { var c = el('<label class="chk"><input type="checkbox"> ' + esc(t('keep_url_chars')) + '</label>'); K.$('input', c).onchange = function (e) { full = e.target.checked; run(); }; bar2.append(c); }
    a.oninput = run;
    root.append(bar2, labeled(t('input'), a), m2, labeled(t('result'), b, [btn('copy', t('copy'), function () { K.copy(b.value); })]));
  }
  else if (mode === 'uuid') {
    var n = 5, up = false, hy = true, o2 = area('', true);
    var f = el('<div class="row"><label class="f" style="width:140px"><span>' + esc(t('amount')) + '</span><input class="inp" type="number" min="1" max="1000" value="5"></label></div>');
    function gen() {
      var r = [];
      for (var k = 0; k < n; k++) { var u = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) { var v = rnd(1)[0] % 16; return (ch === 'x' ? v : (v & 3 | 8)).toString(16); }); if (!hy) u = u.replace(/-/g, ''); if (up) u = u.toUpperCase(); r.push(u); }
      o2.value = r.join('\n');
    }
    K.$('input', f).oninput = function (e) { n = Math.max(1, Math.min(1000, +e.target.value || 1)); gen(); };
    var c1 = el('<label class="chk"><input type="checkbox"> ' + esc(t('uppercase')) + '</label>'), c2 = el('<label class="chk"><input type="checkbox" checked> ' + esc(t('hyphens')) + '</label>');
    K.$('input', c1).onchange = function (e) { up = e.target.checked; gen(); }; K.$('input', c2).onchange = function (e) { hy = e.target.checked; gen(); };
    f.append(c1, c2);
    root.append(f, labeled('UUID v4', o2, [btn('convert', t('generate'), gen), btn('copy', t('copy'), function () { K.copy(o2.value); })]));
    gen();
  }
  else if (mode === 'hash') {
    var hi = area(t('paste_text')), res = el('<div class="stack" style="gap:8px"></div>'), src = 'text', fileBuf = null;
    var dz = K.dropzone({ onFiles: function (fl) { fl[0].arrayBuffer().then(function (b) { fileBuf = b; dz.querySelector('b').textContent = fl[0].name + ' · ' + K.bytes(fl[0].size); go(); }); } });
    dz.classList.add('hide');
    var algs = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
    function hex(b) { return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
    function go() {
      var data = src === 'text' ? new TextEncoder().encode(hi.value) : (fileBuf ? new Uint8Array(fileBuf) : null);
      if (!data) { res.innerHTML = ''; return; }
      Promise.all(algs.map(function (a) { return a === 'MD5' ? Promise.resolve(md5(data)) : crypto.subtle.digest(a, data).then(hex); })).then(function (hs) {
        res.innerHTML = '';
        hs.forEach(function (h, ix) { var r = el('<div class="file"><div class="meta"><div class="sz">' + algs[ix] + '</div><div class="nm mono" style="white-space:normal;word-break:break-all">' + h + '</div></div></div>'); var cb = el('<button class="ibtn" type="button" aria-label="copy">' + svg('copy') + '</button>'); cb.onclick = function () { K.copy(h); }; r.appendChild(cb); res.appendChild(r); });
      });
    }
    if (!crypto.subtle) { root.append(el('<p class="err">' + esc(t('needs_https')) + '</p>')); }
    hi.oninput = K.debounce(go, 150);
    root.append(K.seg([['text', t('text')], ['file', t('file')]], 'text', function (v) { src = v; hi.classList.toggle('hide', v !== 'text'); dz.classList.toggle('hide', v === 'text'); go(); }), hi, dz, res);
    hi.style.minHeight = '120px'; go();
  }
  else if (mode === 'password') {
    var P = { len: 16, up: true, lo: true, dg: true, sy: true, amb: false };
    var show = el('<div class="pw"></div>'), meter = el('<div class="stack" style="gap:6px"><div class="meter"><i></i></div><span class="muted"></span></div>');
    var lr = el('<label class="range"><div><span>' + esc(t('length')) + '</span><output>16</output></div><input type="range" min="4" max="64" value="16"></label>');
    K.$('input', lr).oninput = function (e) { P.len = +e.target.value; K.$('output', lr).textContent = P.len; gen2(); };
    var ch = el('<div class="row"></div>');
    [['up', 'A–Z'], ['lo', 'a–z'], ['dg', '0–9'], ['sy', '!@#$'], ['amb', t('no_similar')]].forEach(function (x) { var c = el('<label class="chk"><input type="checkbox"' + (P[x[0]] ? ' checked' : '') + '> ' + esc(x[1]) + '</label>'); K.$('input', c).onchange = function (e) { P[x[0]] = e.target.checked; gen2(); }; ch.appendChild(c); });
    var cur = '';
    function gen2() {
      var sets = []; if (P.up) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); if (P.lo) sets.push('abcdefghijklmnopqrstuvwxyz'); if (P.dg) sets.push('0123456789'); if (P.sy) sets.push('!@#$%^&*()-_=+[]{};:,.?/~');
      if (!sets.length) { sets.push('abcdefghijklmnopqrstuvwxyz'); }
      if (P.amb) sets = sets.map(function (s) { return s.replace(/[Il1O0o]/g, ''); });
      var all = sets.join(''), r = rnd(P.len + sets.length), pw = [];
      sets.forEach(function (s, ix) { pw.push(s[r[ix] % s.length]); });
      for (var k = sets.length; k < P.len; k++) pw.push(all[r[k] % all.length]);
      var r2 = rnd(pw.length); for (var j = pw.length - 1; j > 0; j--) { var q = r2[j] % (j + 1), tmp = pw[j]; pw[j] = pw[q]; pw[q] = tmp; }
      cur = pw.slice(0, P.len).join(''); show.textContent = cur;
      var bits = P.len * Math.log2(all.length), lv = bits < 40 ? 0 : bits < 60 ? 1 : bits < 80 ? 2 : 3;
      var col = ['#e03e52', '#f59e0b', '#10b981', '#0f9f6e'][lv];
      K.$('i', meter).style.cssText = 'width:' + Math.min(100, bits / 1.28) + '%;background:' + col;
      K.$('span', meter).textContent = t(['pw_weak', 'pw_medium', 'pw_strong', 'pw_very_strong'][lv]) + ' · ' + Math.round(bits) + ' bit';
    }
    var bar3 = el('<div class="row"></div>');
    bar3.append(btn('copy', t('copy'), function () { K.copy(cur); }, 'btn big'), btn('convert', t('generate'), gen2, 'btn sec'));
    root.append(show, meter, lr, ch, bar3); gen2();
  }
  else if (mode === 'qr') {
    var Q = { text: 'https://example.com', fg: '#111111', bg: '#ffffff', size: 512, ec: 'M' };
    var qi = area(t('qr_placeholder')); qi.style.minHeight = '90px'; qi.value = '';
    var cv = document.createElement('canvas');
    var pv = el('<div class="preview" style="background:none;border:1px solid var(--line)"></div>'); pv.appendChild(cv); cv.style.maxWidth = '280px'; cv.style.width = '100%';
    var g2 = el('<div class="fields"><label class="f"><span>' + esc(t('color')) + '</span><input class="inp" type="color" value="#111111" data-k="fg" style="padding:4px"></label><label class="f"><span>' + esc(t('background')) + '</span><input class="inp" type="color" value="#ffffff" data-k="bg" style="padding:4px"></label><label class="f"><span>' + esc(t('size')) + '</span><select class="sel" data-k="size"><option>256</option><option selected>512</option><option>1024</option><option>2048</option></select></label><label class="f"><span>' + esc(t('error_correction')) + '</span><select class="sel" data-k="ec"><option value="L">L 7%</option><option value="M" selected>M 15%</option><option value="Q">Q 25%</option><option value="H">H 30%</option></select></label></div>');
    K.$$('[data-k]', g2).forEach(function (x) { x.oninput = x.onchange = function () { Q[x.dataset.k] = x.dataset.k === 'size' ? +x.value : x.value; draw(); }; });
    var qm = el('<p class="err hide" style="margin:0"></p>');
    function make() {
      var q = window.qrcode; if (!q) return null;
      if (q.stringToBytesFuncs && q.stringToBytesFuncs['UTF-8']) q.stringToBytes = q.stringToBytesFuncs['UTF-8'];
      var qr = q(0, Q.ec); qr.addData(qi.value || 'https://example.com', 'Byte'); qr.make(); return qr;
    }
    function draw() {
      qm.classList.add('hide');
      var qr; try { qr = make(); } catch (e) { qm.textContent = t('too_long'); qm.classList.remove('hide'); return; }
      if (!qr) return;
      var n = qr.getModuleCount(), quiet = 4, cell = Math.max(1, Math.floor(Q.size / (n + quiet * 2))), s = cell * (n + quiet * 2);
      cv.width = cv.height = s; var x = cv.getContext('2d'); x.fillStyle = Q.bg; x.fillRect(0, 0, s, s); x.fillStyle = Q.fg;
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
    function svgOut() {
      var qr = make(), n = qr.getModuleCount(), qz = 4, p = '';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) p += 'M' + (c + qz) + ' ' + (r + qz) + 'h1v1h-1z';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + qz * 2) + ' ' + (n + qz * 2) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="' + Q.bg + '"/><path d="' + p + '" fill="' + Q.fg + '"/></svg>';
    }
    qi.oninput = K.debounce(draw, 120);
    var bar4 = el('<div class="row"></div>');
    bar4.append(btn('download', 'PNG', function () { cv.toBlob(function (b) { K.download(b, 'qr-code.png'); }); }, 'btn big'), btn('download', 'SVG', function () { K.download(new Blob([svgOut()], { type: 'image/svg+xml' }), 'qr-code.svg'); }, 'btn sec'));
    var lay = el('<div class="fields" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));align-items:start"></div>');
    var left = el('<div class="stack"></div>'); left.append(labeled(t('qr_content'), qi), g2, qm);
    var right = el('<div class="stack"></div>'); right.append(pv, bar4);
    lay.append(left, right); root.append(lay);
    draw();
  }
  else if (mode === 'color') {
    var col = { r: 91, g: 76, b: 245 };
    var sw2 = el('<div class="swatch"></div>'), pick = el('<input type="color" class="inp" style="height:60px;padding:4px">');
    var fields = el('<div class="stack" style="gap:10px"></div>');
    var fmts = ['HEX', 'RGB', 'HSL', 'CMYK'];
    var inputs = {};
    fmts.forEach(function (f) { var r = el('<label class="f"><span>' + f + '</span><div class="row" style="flex-wrap:nowrap"><input class="inp mono" data-f="' + f + '"></div></label>'); var cb = el('<button class="ibtn" type="button" style="width:46px;height:46px">' + svg('copy') + '</button>'); cb.onclick = function () { K.copy(inputs[f].value); }; K.$('.row', r).appendChild(cb); inputs[f] = K.$('input', r); fields.appendChild(r); });
    function toHsl(r, g, b) { r /= 255; g /= 255; b /= 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2; if (mx !== mn) { var d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]; }
    function fromHsl(h, s, l) { s /= 100; l /= 100; var k = function (n) { return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l), f = function (n) { return Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); }; return { r: f(0), g: f(8), b: f(4) }; }
    function hex() { return '#' + [col.r, col.g, col.b].map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''); }
    var shades = el('<div class="row" style="gap:6px"></div>');
    function paint(skip) {
      var h = toHsl(col.r, col.g, col.b), k = 1 - Math.max(col.r, col.g, col.b) / 255, cm = k === 1 ? [0, 0, 0] : [col.r, col.g, col.b].map(function (v) { return Math.round((1 - v / 255 - k) / (1 - k) * 100); });
      var vals = { HEX: hex(), RGB: 'rgb(' + col.r + ', ' + col.g + ', ' + col.b + ')', HSL: 'hsl(' + h[0] + ', ' + h[1] + '%, ' + h[2] + '%)', CMYK: 'cmyk(' + cm.join('%, ') + '%, ' + Math.round(k * 100) + '%)' };
      fmts.forEach(function (f) { if (f !== skip) inputs[f].value = vals[f]; });
      sw2.style.background = hex(); pick.value = hex();
      shades.innerHTML = '';
      [92, 80, 65, 50, 35, 22, 12].forEach(function (L) { var c = fromHsl(h[0], h[1], L), hx = '#' + [c.r, c.g, c.b].map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''); var b = el('<button type="button" title="' + hx + '" style="width:44px;height:44px;border-radius:10px;border:1px solid var(--line);cursor:pointer;background:' + hx + '"></button>'); b.onclick = function () { col = c; paint(); }; shades.appendChild(b); });
    }
    pick.oninput = function () { var v = pick.value; col = { r: parseInt(v.substr(1, 2), 16), g: parseInt(v.substr(3, 2), 16), b: parseInt(v.substr(5, 2), 16) }; paint(); };
    inputs.HEX.oninput = function () { var v = inputs.HEX.value.trim().replace('#', ''); if (v.length === 3) v = v.split('').map(function (c) { return c + c; }).join(''); if (/^[0-9a-f]{6}$/i.test(v)) { col = { r: parseInt(v.substr(0, 2), 16), g: parseInt(v.substr(2, 2), 16), b: parseInt(v.substr(4, 2), 16) }; paint('HEX'); } };
    inputs.RGB.oninput = function () { var m = inputs.RGB.value.match(/(\d+)\D+(\d+)\D+(\d+)/); if (m && m.slice(1).every(function (v) { return v <= 255; })) { col = { r: +m[1], g: +m[2], b: +m[3] }; paint('RGB'); } };
    inputs.HSL.oninput = function () { var m = inputs.HSL.value.match(/(\d+)\D+(\d+)\D+(\d+)/); if (m) { col = fromHsl(+m[1], +m[2], +m[3]); paint('HSL'); } };
    inputs.CMYK.readOnly = true;
    var lay2 = el('<div class="fields" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));align-items:start"></div>');
    var l2 = el('<div class="stack"></div>'); l2.append(sw2, pick, el('<span class="lbl">' + esc(t('shades')) + '</span>'), shades);
    lay2.append(l2, fields); root.append(lay2); paint();
  }
  else if (mode === 'timestamp') {
    var now = el('<div class="result"><div class="sub">' + esc(t('current_timestamp')) + '</div><div class="big mono"></div></div>');
    setInterval(function () { K.$('.big', now).textContent = Math.floor(Date.now() / 1000); }, 1000); K.$('.big', now).textContent = Math.floor(Date.now() / 1000);
    var ti = el('<label class="f"><span>' + esc(t('timestamp_input')) + '</span><input class="inp mono" inputmode="numeric"></label>');
    var tout = el('<div class="stack" style="gap:6px"></div>');
    var di = el('<label class="f"><span>' + esc(t('date_time')) + '</span><input class="inp" type="datetime-local" step="1"></label>');
    var dout = el('<div class="stack" style="gap:6px"></div>');
    var dtf = new Intl.DateTimeFormat(K.lang, { dateStyle: 'full', timeStyle: 'medium' });
    function line(k, v) { var r = el('<div class="file"><div class="meta"><div class="sz">' + esc(k) + '</div><div class="nm mono" style="white-space:normal">' + esc(v) + '</div></div></div>'); var cb = el('<button class="ibtn" type="button">' + svg('copy') + '</button>'); cb.onclick = function () { K.copy(v); }; r.appendChild(cb); return r; }
    K.$('input', ti).oninput = function (e) {
      var v = e.target.value.trim(); tout.innerHTML = ''; if (!/^-?\d+$/.test(v)) return;
      var ms = v.length > 11 ? +v : +v * 1000, d = new Date(ms); if (isNaN(d)) return;
      tout.append(line(t('local_time'), dtf.format(d)), line('UTC', d.toUTCString()), line('ISO 8601', d.toISOString()));
    };
    K.$('input', di).oninput = function (e) {
      dout.innerHTML = ''; var d = new Date(e.target.value); if (isNaN(d)) return;
      dout.append(line(t('seconds'), String(Math.floor(d / 1000))), line(t('milliseconds'), String(+d)), line('ISO 8601', d.toISOString()));
    };
    var nowv = new Date(); nowv.setMinutes(nowv.getMinutes() - nowv.getTimezoneOffset()); K.$('input', di).value = nowv.toISOString().slice(0, 19);
    K.$('input', ti).value = Math.floor(Date.now() / 1000);
    var lay3 = el('<div class="fields" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:start"></div>');
    var a1 = el('<div class="panel stack"><b>' + esc(t('ts_to_date')) + '</b></div>'); a1.append(ti, tout);
    var a2 = el('<div class="panel stack"><b>' + esc(t('date_to_ts')) + '</b></div>'); a2.append(di, dout);
    lay3.append(a1, a2); root.append(now, lay3);
    K.$('input', ti).oninput({ target: K.$('input', ti) }); K.$('input', di).oninput({ target: K.$('input', di) });
  }
});

/* compact MD5 (public domain, after J. Myers) */
function md5(bytes) {
  function add(x, y) { var l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
  function rol(n, c) { return (n << c) | (n >>> (32 - c)); }
  function cmn(q, a, b, x, s, t) { return add(rol(add(add(a, q), add(x, t)), s), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  var n = bytes.length, nb = ((n + 8) >> 6) + 1, x = new Array(nb * 16).fill(0), i;
  for (i = 0; i < n; i++) x[i >> 2] |= bytes[i] << ((i % 4) * 8);
  x[i >> 2] |= 0x80 << ((i % 4) * 8); x[nb * 16 - 2] = n * 8; x[nb * 16 - 1] = Math.floor(n / 536870912);
  var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (i = 0; i < x.length; i += 16) {
    var oa = a, ob = b, oc = c, od = d;
    a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586); c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426); c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417); c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101); c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632); c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
    a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083); c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690); c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784); c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463); c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353); c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222); c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835); c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415); c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606); c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744); c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379); c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
  }
  return [a, b, c, d].map(function (v) { var s = ''; for (var j = 0; j < 4; j++) s += ((v >> (j * 8)) & 255).toString(16).padStart(2, '0'); return s; }).join('');
}

TK.register('calc', function (root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg, N = K.num, mode = o.mode;
  var V = {};
  // field: [key, label, default, unit|options, type]
  function form(fields, compute, cols) {
    var g = el('<div class="fields"></div>');
    if (cols) g.style.gridTemplateColumns = cols;
    var res = el('<div class="out"></div>');
    fields.forEach(function (f) {
      var k = f[0], type = f[4] || 'num', w;
      V[k] = f[2];
      if (type === 'sel') {
        w = el('<label class="f"><span>' + esc(f[1]) + '</span><select class="sel">' + f[3].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] == f[2] ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select></label>');
        K.$('select', w).onchange = function (e) { V[k] = e.target.value; go(); };
      } else if (type === 'date') {
        w = el('<label class="f"><span>' + esc(f[1]) + '</span><input class="inp" type="date" value="' + f[2] + '"></label>');
        K.$('input', w).oninput = function (e) { V[k] = e.target.value; go(); };
      } else {
        w = el('<label class="f"><span>' + esc(f[1]) + '</span><div class="inp-u"><input class="inp" inputmode="decimal" value="' + (f[2] == null ? '' : f[2]) + '">' + (f[3] ? '<em>' + esc(f[3]) + '</em>' : '') + '</div></label>');
        K.$('input', w).oninput = function (e) { V[k] = e.target.value; go(); };
      }
      w.dataset.k = k; g.appendChild(w);
    });
    function go() { var p = {}; for (var k in V) p[k] = typeof V[k] === 'string' && !/^\d{4}-/.test(V[k]) && isFinite(K.pnum(V[k])) ? K.pnum(V[k]) : V[k]; var h = compute(p); res.innerHTML = h || ''; }
    root.append(g, res); go();
    return { go: go, grid: g };
  }
  function result(big, sub, extra) { return '<div class="result" style="margin-top:16px"><div class="big">' + big + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' + (extra || ''); }
  function stats(arr) { return '<div class="stats" style="margin-top:12px">' + arr.map(function (a) { return '<div class="stat"><b>' + a[1] + '</b><span>' + esc(a[0]) + '</span></div>'; }).join('') + '</div>'; }
  function ok(v) { return typeof v === 'number' && isFinite(v); }
  function todayStr(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.toISOString().slice(0, 10); }

  if (mode === 'percent') {
    var rows = [
      ['a', t('pct_q1'), function (x, y) { return x * y / 100; }],
      ['b', t('pct_q2'), function (x, y) { return y ? x / y * 100 : NaN; }, '%'],
      ['c', t('pct_q3'), function (x, y) { return x ? (y - x) / x * 100 : NaN; }, '%'],
      ['d', t('pct_q4'), function (x, y) { return x * (1 + y / 100); }],
      ['e', t('pct_q5'), function (x, y) { return x * (1 - y / 100); }]
    ];
    rows.forEach(function (r) {
      var parts = r[1].split(/(\{[xy]\})/);
      var box = el('<div class="panel" style="margin-bottom:10px"><div class="row" style="gap:8px;font-weight:600"></div></div>');
      var line = K.$('.row', box), i1 = el('<input class="inp" inputmode="decimal" style="width:120px">'), i2 = el('<input class="inp" inputmode="decimal" style="width:120px">'), out = el('<b style="font-size:22px;margin-inline-start:auto;color:var(--brand)">—</b>');
      parts.forEach(function (pt) { if (pt === '{x}') line.append(i1); else if (pt === '{y}') line.append(i2); else if (pt) line.append(document.createTextNode(pt)); });
      line.append(document.createTextNode(' ='), out);
      function c() { var x = K.pnum(i1.value), y = K.pnum(i2.value); var v = r[2](x, y); out.textContent = ok(v) ? N(v, 4) + (r[3] || '') : '—'; }
      var ex = { a: [15, 200], b: [30, 120], c: [80, 100], d: [250, 20], e: [250, 20] }[r[0]]; i1.value = ex[0]; i2.value = ex[1];
      i1.oninput = i2.oninput = c; root.appendChild(box); c();
    });
  }
  else if (mode === 'bmi') {
    var unit = 'm';
    var holder = el('<div></div>');
    var sg = K.seg([['m', t('metric')], ['i', t('imperial')]], 'm', function (v) { unit = v; build(); });
    root.append(sg, holder);
    function build() {
      holder.innerHTML = ''; V = {};
      var r = root; root = holder;
      var f = unit === 'm' ? [['h', t('height'), 175, 'cm'], ['w', t('weight'), 70, 'kg']] : [['ft', t('height') + ' (ft)', 5, 'ft'], ['in', t('height') + ' (in)', 9, 'in'], ['w', t('weight'), 155, 'lb']];
      form(f, function (p) {
        var h = unit === 'm' ? p.h / 100 : ((p.ft || 0) * 12 + (p.in || 0)) * .0254, w = unit === 'm' ? p.w : p.w * .45359237;
        var b = w / (h * h); if (!ok(b) || b <= 0 || b > 200) return '';
        var cats = [[18.5, 'bmi_under', '#3b82f6'], [25, 'bmi_normal', '#10b981'], [30, 'bmi_over', '#f59e0b'], [99, 'bmi_obese', '#e03e52']];
        var c = cats.filter(function (x) { return b < x[0]; })[0];
        var lo = 18.5 * h * h, hi = 24.9 * h * h, cv = unit === 'm' ? 1 : 1 / .45359237, u = unit === 'm' ? 'kg' : 'lb';
        var pos = Math.max(0, Math.min(100, (b - 12) / 28 * 100));
        return result('<span style="color:' + c[2] + '">' + N(b, 1) + '</span>', esc(t(c[1])), '<div style="margin-top:14px;position:relative"><div class="bar"><i style="width:23%;background:#3b82f6"></i><i style="width:23%;background:#10b981"></i><i style="width:18%;background:#f59e0b"></i><i style="width:36%;background:#e03e52"></i></div><div style="position:absolute;top:-5px;inset-inline-start:calc(' + pos + '% - 2px);width:4px;height:22px;background:var(--text);border-radius:2px"></div></div>' + stats([[t('healthy_weight'), N(lo * cv, 1) + '–' + N(hi * cv, 1) + ' ' + u]]));
      });
      root = r;
    }
    build();
  }
  else if (mode === 'age') {
    form([['b', t('birth_date'), '1995-06-15', null, 'date'], ['d', t('on_date'), todayStr(), null, 'date']], function (p) {
      var b = new Date(p.b), d = new Date(p.d); if (isNaN(b) || isNaN(d) || d < b) return '';
      var y = d.getFullYear() - b.getFullYear(), m = d.getMonth() - b.getMonth(), dd = d.getDate() - b.getDate();
      if (dd < 0) { m--; dd += new Date(d.getFullYear(), d.getMonth(), 0).getDate(); }
      if (m < 0) { y--; m += 12; }
      var days = Math.floor((d - b) / 864e5);
      var nb = new Date(d.getFullYear(), b.getMonth(), b.getDate()); if (nb < d) nb.setFullYear(nb.getFullYear() + 1);
      var tn = Math.round((nb - d) / 864e5);
      return result(N(y, 0) + ' <small style="font-size:.5em">' + esc(t('years')) + '</small>', esc(t('age_full', { y: y, m: m, d: dd })), stats([[t('months_total'), N(y * 12 + m, 0)], [t('weeks_total'), N(Math.floor(days / 7), 0)], [t('days_total'), N(days, 0)], [t('next_birthday'), tn === 0 ? '🎉' : t('in_n_days', { n: tn })]]));
    });
  }
  else if (mode === 'loan') {
    form([['a', t('loan_amount'), 20000], ['r', t('interest_rate'), 12, '%'], ['y', t('term_years'), 5, t('yrs')]], function (p) {
      var n = Math.round(p.y * 12), i = p.r / 1200; if (!ok(p.a) || !ok(n) || n <= 0) return '';
      var m = i ? p.a * i / (1 - Math.pow(1 + i, -n)) : p.a / n, tot = m * n;
      var bal = p.a, rowsH = '';
      for (var k = 1; k <= Math.min(n, 600); k++) { var int = bal * i, pr = m - int; bal -= pr; if (k <= 12 || k % 12 === 0 || k === n) rowsH += '<tr><td>' + k + '</td><td>' + N(m, 2) + '</td><td>' + N(pr, 2) + '</td><td>' + N(int, 2) + '</td><td>' + N(Math.max(0, bal), 2) + '</td></tr>'; }
      var pp = p.a / tot * 100;
      return result(N(m, 2), esc(t('monthly_payment')), stats([[t('total_payment'), N(tot, 2)], [t('total_interest'), N(tot - p.a, 2)]]) + '<div class="bar" style="margin:14px 0 4px"><i style="width:' + pp + '%;background:var(--brand)"></i><i style="width:' + (100 - pp) + '%;background:var(--brand2)"></i></div><p class="muted" style="margin:0 0 14px">■ ' + esc(t('principal')) + ' ' + N(pp, 0) + '% · ■ ' + esc(t('interest')) + ' ' + N(100 - pp, 0) + '%</p><div class="scroll"><table class="table"><thead><tr><th>#</th><th>' + esc(t('payment')) + '</th><th>' + esc(t('principal')) + '</th><th>' + esc(t('interest')) + '</th><th>' + esc(t('balance')) + '</th></tr></thead><tbody>' + rowsH + '</tbody></table></div>');
    });
  }
  else if (mode === 'compound') {
    form([['p', t('initial_amount'), 1000], ['c', t('monthly_contribution'), 100], ['r', t('annual_rate'), 8, '%'], ['y', t('years'), 10, t('yrs')], ['n', t('compounding'), 12, [[1, t('yearly')], [4, t('quarterly')], [12, t('monthly')], [365, t('daily')]], 'sel']], function (p) {
      if (!ok(p.p) || !ok(p.y)) return '';
      var n = +p.n, r = (p.r || 0) / 100, c = p.c || 0, bal = p.p, contrib = p.p, rows = '';
      for (var yr = 1; yr <= Math.min(p.y, 100); yr++) {
        for (var m = 0; m < 12; m++) { bal += c; contrib += c; bal *= Math.pow(1 + r / n, n / 12); }
        rows += '<tr><td>' + yr + '</td><td>' + N(contrib, 2) + '</td><td>' + N(bal - contrib, 2) + '</td><td><b>' + N(bal, 2) + '</b></td></tr>';
      }
      return result(N(bal, 2), esc(t('future_value')), stats([[t('total_contributions'), N(contrib, 2)], [t('interest_earned'), N(bal - contrib, 2)]]) + '<div class="scroll" style="margin-top:14px"><table class="table"><thead><tr><th>' + esc(t('year')) + '</th><th>' + esc(t('contributions')) + '</th><th>' + esc(t('interest')) + '</th><th>' + esc(t('balance')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>');
    });
  }
  else if (mode === 'tip') {
    form([['b', t('bill_amount'), 50], ['p', t('tip_percent'), 15, '%'], ['n', t('people'), 2]], function (p) {
      if (!ok(p.b)) return ''; var tip = p.b * (p.p || 0) / 100, n = Math.max(1, Math.round(p.n || 1)), tot = p.b + tip;
      return result(N(tot / n, 2), esc(t('per_person')), stats([[t('tip'), N(tip, 2)], [t('total'), N(tot, 2)], [t('tip_per_person'), N(tip / n, 2)]]));
    });
  }
  else if (mode === 'discount') {
    form([['p', t('original_price'), 100], ['d', t('discount'), 20, '%'], ['x', t('extra_discount'), 0, '%'], ['tx', t('sales_tax'), 0, '%']], function (p) {
      if (!ok(p.p)) return ''; var a = p.p * (1 - (p.d || 0) / 100) * (1 - (p.x || 0) / 100), f = a * (1 + (p.tx || 0) / 100);
      return result(N(f, 2), esc(t('final_price')), stats([[t('you_save'), N(p.p - a, 2)], [t('total_discount'), N((1 - a / p.p) * 100, 2) + '%']]));
    });
  }
  else if (mode === 'datediff') {
    var inc = false;
    var c = el('<label class="chk" style="margin-top:12px"><input type="checkbox"> ' + esc(t('include_end')) + '</label>');
    var F = form([['a', t('start_date'), todayStr(), null, 'date'], ['b', t('end_date'), todayStr(30), null, 'date']], function (p) {
      var a = new Date(p.a), b = new Date(p.b); if (isNaN(a) || isNaN(b)) return '';
      var sgn = b < a ? -1 : 1; if (sgn < 0) { var tmp = a; a = b; b = tmp; }
      var days = Math.round((b - a) / 864e5) + (inc ? 1 : 0), wd = 0, d = new Date(a);
      for (var i = 0; i < days && i < 40000; i++) { var w = d.getDay(); if (w && w !== 6) wd++; d.setDate(d.getDate() + 1); }
      return result(N(days * sgn, 0) + ' <small style="font-size:.5em">' + esc(t('days')) + '</small>', '', stats([[t('weeks'), N(days / 7, 1)], [t('months'), N(days / 30.4375, 1)], [t('workdays'), N(wd, 0)], [t('hours'), N(days * 24, 0)]]));
    });
    K.$('input', c).onchange = function (e) { inc = e.target.checked; F.go(); };
    root.insertBefore(c, root.lastChild);
  }
  else if (mode === 'calorie') {
    form([['s', t('sex'), 'm', [['m', t('male')], ['f', t('female')]], 'sel'], ['a', t('age'), 30, t('yrs')], ['h', t('height'), 175, 'cm'], ['w', t('weight'), 70, 'kg'], ['act', t('activity'), 1.55, [[1.2, t('act_1')], [1.375, t('act_2')], [1.55, t('act_3')], [1.725, t('act_4')], [1.9, t('act_5')]], 'sel']], function (p) {
      if (!ok(p.a) || !ok(p.h) || !ok(p.w)) return '';
      var bmr = 10 * p.w + 6.25 * p.h - 5 * p.a + (p.s === 'f' ? -161 : 5), tdee = bmr * +p.act;
      return result(N(Math.round(tdee), 0) + ' <small style="font-size:.45em">' + esc(t('kcal_day')) + '</small>', esc(t('maintain_weight')), stats([[t('lose_weight'), N(Math.round(tdee - 500), 0)], [t('lose_fast'), N(Math.round(tdee - 1000), 0)], [t('gain_weight'), N(Math.round(tdee + 500), 0)], ['BMR', N(Math.round(bmr), 0)]]));
    });
  }
  else if (mode === 'average') {
    var ta = el('<textarea class="inp" placeholder="4, 8, 15, 16, 23, 42"></textarea>'); ta.style.minHeight = '120px';
    var out = el('<div></div>');
    ta.oninput = function () {
      var a = (ta.value.match(/-?\d+(?:[.,]\d+)?/g) || []).map(function (x) { return parseFloat(x.replace(',', '.')); });
      if (!a.length) { out.innerHTML = ''; return; }
      var s = a.reduce(function (x, y) { return x + y; }, 0), m = s / a.length, so = a.slice().sort(function (x, y) { return x - y; });
      var med = so.length % 2 ? so[(so.length - 1) / 2] : (so[so.length / 2 - 1] + so[so.length / 2]) / 2;
      var fq = {}, mx = 0; a.forEach(function (v) { fq[v] = (fq[v] || 0) + 1; mx = Math.max(mx, fq[v]); });
      var mode2 = mx > 1 ? Object.keys(fq).filter(function (k) { return fq[k] === mx; }).map(function (v) { return N(+v, 4); }).join(', ') : '—';
      var sd = Math.sqrt(a.reduce(function (x, v) { return x + (v - m) * (v - m); }, 0) / a.length);
      out.innerHTML = result(N(m, 4), esc(t('mean')), stats([[t('median'), N(med, 4)], [t('mode'), mode2], [t('sum'), N(s, 4)], [t('count'), N(a.length, 0)], [t('min_v'), N(so[0], 4)], [t('max_v'), N(so[so.length - 1], 4)], [t('std_dev'), N(sd, 4)]]));
    };
    root.append(el('<span class="lbl">' + esc(t('enter_numbers')) + '</span>'), ta, out);
    ta.value = '4, 8, 15, 16, 23, 42'; ta.oninput();
  }
  else if (mode === 'random') {
    var R = { min: 1, max: 100, n: 1, uniq: false };
    var sub = o.sub;
    if (sub === 'coin') {
      var face = el('<div class="result" style="padding:36px"><div class="big" style="font-size:72px">🪙</div><div class="sub"></div></div>'), cnt = { h: 0, t: 0 };
      var sc = el('<p class="muted" style="text-align:center"></p>');
      var fb = el('<button class="btn big" type="button" style="margin:16px auto;display:flex">' + esc(t('flip_coin')) + '</button>');
      fb.onclick = function () {
        var h = crypto.getRandomValues(new Uint8Array(1))[0] < 128; cnt[h ? 'h' : 't']++;
        var b = K.$('.big', face); b.style.transition = 'transform .5s'; b.style.transform = 'rotateY(720deg) scale(1.1)';
        setTimeout(function () { b.style.transition = 'none'; b.style.transform = ''; b.textContent = h ? '🦅' : '👑'; K.$('.sub', face).textContent = t(h ? 'heads' : 'tails'); sc.textContent = t('heads') + ': ' + cnt.h + ' · ' + t('tails') + ': ' + cnt.t; }, 500);
      };
      root.append(face, fb, sc); return;
    }
    var outR = el('<div class="result" style="margin-top:16px"><div class="big">—</div></div>');
    var g = el('<div class="fields"><label class="f"><span>' + esc(t('min_v')) + '</span><input class="inp" inputmode="numeric" value="1" data-k="min"></label><label class="f"><span>' + esc(t('max_v')) + '</span><input class="inp" inputmode="numeric" value="100" data-k="max"></label><label class="f"><span>' + esc(t('how_many')) + '</span><input class="inp" inputmode="numeric" value="1" data-k="n"></label></div>');
    K.$$('input', g).forEach(function (i) { i.oninput = function () { R[i.dataset.k] = Math.round(K.pnum(i.value)); }; });
    var u = el('<label class="chk" style="margin-top:12px"><input type="checkbox"> ' + esc(t('no_repeats')) + '</label>'); K.$('input', u).onchange = function (e) { R.uniq = e.target.checked; };
    var gb = el('<button class="btn big" type="button" style="margin-top:14px">' + svg('dice') + esc(t('generate')) + '</button>');
    gb.onclick = function () {
      var lo = Math.min(R.min, R.max), hi = Math.max(R.min, R.max), n = Math.max(1, Math.min(1000, R.n || 1)), span = hi - lo + 1, r = [];
      if (!isFinite(span)) return;
      if (R.uniq && n > span) n = span;
      var used = {};
      while (r.length < n) { var v = lo + Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * span); if (R.uniq) { if (used[v]) continue; used[v] = 1; } r.push(v); }
      K.$('.big', outR).textContent = r.join(', '); K.$('.big', outR).style.fontSize = n > 6 ? '24px' : '';
    };
    root.append(g, u, gb, outR); gb.onclick();
  }
});

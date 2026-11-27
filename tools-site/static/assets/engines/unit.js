TK.register('unit', function (root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg;
  var D = {
    length: { base: 'm', def: ['km', 'mi'], u: { mm: .001, cm: .01, m: 1, km: 1000, in: .0254, ft: .3048, yd: .9144, mi: 1609.344, nmi: 1852 } },
    weight: { base: 'kg', def: ['kg', 'lb'], u: { mg: 1e-6, g: .001, kg: 1, t: 1000, oz: .028349523125, lb: .45359237, st: 6.35029318 } },
    temperature: { def: ['c', 'f'], u: { c: 0, f: 0, k: 0 } },
    area: { base: 'm2', def: ['m2', 'ft2'], u: { mm2: 1e-6, cm2: 1e-4, m2: 1, ha: 1e4, km2: 1e6, in2: .00064516, ft2: .09290304, yd2: .83612736, ac: 4046.8564224, mi2: 2589988.110336 } },
    volume: { base: 'l', def: ['l', 'gal'], u: { ml: .001, l: 1, m3: 1000, tsp: .00492892, tbsp: .0147868, floz: .0295735, cup: .2365882, pt: .4731765, qt: .9463529, gal: 3.785411784 } },
    speed: { base: 'ms', def: ['kmh', 'mph'], u: { ms: 1, kmh: 1 / 3.6, mph: .44704, kn: .514444, fts: .3048 } },
    data: { base: 'b', def: ['mb', 'gb'], u: { bit: .125, b: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776, kbit: 125, mbit: 125000 } }
  };
  var SYM = { m2: 'm²', mm2: 'mm²', cm2: 'cm²', km2: 'km²', in2: 'in²', ft2: 'ft²', yd2: 'yd²', mi2: 'mi²', m3: 'm³', c: '°C', f: '°F', k: 'K', kmh: 'km/h', ms: 'm/s', fts: 'ft/s', floz: 'fl oz', b: 'B', kb: 'KB', mb: 'MB', gb: 'GB', tb: 'TB', kbit: 'kbit', mbit: 'Mbit' };
  var d = D[o.cat || 'length'];
  var keys = Object.keys(d.u);
  function nm(k) { return t('u_' + k) + ' (' + (SYM[k] || k) + ')'; }
  function toBase(v, k) { if (o.cat === 'temperature') return k === 'c' ? v : k === 'f' ? (v - 32) * 5 / 9 : v - 273.15; return v * d.u[k]; }
  function fromBase(v, k) { if (o.cat === 'temperature') return k === 'c' ? v : k === 'f' ? v * 9 / 5 + 32 : v + 273.15; return v / d.u[k]; }
  function fmt(v) { if (!isFinite(v)) return ''; var a = Math.abs(v); if (a !== 0 && (a < 1e-6 || a >= 1e15)) return v.toExponential(6).replace(/\.?0+e/, 'e'); return String(+v.toPrecision(10)); }
  var opts = keys.map(function (k) { return '<option value="' + k + '">' + esc(nm(k)) + '</option>'; }).join('');
  var box = el('<div class="fields" style="grid-template-columns:1fr auto 1fr;align-items:end"></div>');
  var A = el('<div class="stack" style="gap:8px"><select class="sel">' + opts + '</select><input class="inp" inputmode="decimal" style="height:58px;font-size:22px;font-weight:700"></div>');
  var B = el('<div class="stack" style="gap:8px"><select class="sel">' + opts + '</select><input class="inp" inputmode="decimal" style="height:58px;font-size:22px;font-weight:700"></div>');
  var sw = el('<button class="ibtn" type="button" style="width:46px;height:58px" aria-label="swap">' + svg('convert') + '</button>');
  box.append(A, sw, B);
  var sa = K.$('select', A), sb = K.$('select', B), ia = K.$('input', A), ib = K.$('input', B);
  sa.value = d.def[0]; sb.value = d.def[1]; ia.value = o.cat === 'temperature' ? 25 : 1;
  var formula = el('<p class="muted" style="text-align:center;margin:14px 0 0"></p>');
  var table = el('<div class="scroll" style="margin-top:16px;max-height:none"></div>');
  function conv(from) {
    var src = from === 'a' ? ia : ib, dst = from === 'a' ? ib : ia, su = from === 'a' ? sa.value : sb.value, du = from === 'a' ? sb.value : sa.value;
    var v = K.pnum(src.value); if (!isFinite(v)) { dst.value = ''; table.innerHTML = ''; return; }
    var base = toBase(v, su); dst.value = fmt(fromBase(base, du));
    var va = K.pnum(ia.value), ba = toBase(va, sa.value);
    formula.textContent = fmt(va) + ' ' + (SYM[sa.value] || sa.value) + ' = ' + ib.value + ' ' + (SYM[sb.value] || sb.value);
    table.innerHTML = '<table class="table"><tbody>' + keys.map(function (k) { return '<tr><td>' + esc(t('u_' + k)) + '</td><td style="text-align:end"><b>' + fmt(fromBase(ba, k)) + '</b> ' + (SYM[k] || k) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  ia.oninput = function () { conv('a'); }; ib.oninput = function () { conv('b'); };
  sa.onchange = function () { conv('a'); }; sb.onchange = function () { conv('a'); };
  sw.onclick = function () { var x = sa.value; sa.value = sb.value; sb.value = x; ia.value = ib.value; conv('a'); };
  root.append(box, formula, el('<span class="lbl" style="display:block;margin-top:18px">' + esc(t('all_units')) + '</span>'), table);
  conv('a');
  if (window.matchMedia('(max-width:560px)').matches) { box.style.gridTemplateColumns = '1fr'; sw.style.cssText = 'width:100%;height:40px'; }
});

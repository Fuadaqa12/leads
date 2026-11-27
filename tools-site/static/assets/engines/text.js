TK.register('text', function (root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg;
  var mode = o.mode || 'counter';
  var S = {};
  var inp = el('<textarea class="inp" spellcheck="false"></textarea>');
  inp.placeholder = t(mode === 'slug' ? 'enter_title' : 'paste_text');
  var opts = el('<div class="row"></div>');
  var outWrap = el('<div class="stack"><div class="row" style="justify-content:space-between"><span class="lbl"></span><div class="row"></div></div><textarea class="inp" readonly spellcheck="false"></textarea></div>');
  var out = K.$('textarea', outWrap), outBtns = K.$('.row .row', outWrap), outLbl = K.$('.lbl', outWrap);
  outLbl.textContent = t('result');
  var info = el('<p class="muted" style="margin:0"></p>');
  function btn(icon, label, fn, cls) { var b = el('<button class="btn ' + (cls || 'sec sm') + '" type="button">' + svg(icon) + '<span>' + esc(label) + '</span></button>'); b.onclick = fn; return b; }
  outBtns.append(btn('copy', t('copy'), function () { K.copy(out.value); }), btn('download', '.txt', function () { K.download(new Blob([out.value], { type: 'text/plain;charset=utf-8' }), 'text.txt'); }));
  var inBar = el('<div class="row" style="justify-content:space-between"><span class="lbl">' + esc(t('your_text')) + '</span><div class="row"></div></div>');
  K.$('.row', inBar).append(btn('x', t('clear'), function () { inp.value = ''; upd(); inp.focus(); }));
  function chk(key, label, def) { S[key] = def; var c = el('<label class="chk"><input type="checkbox"' + (def ? ' checked' : '') + '> ' + esc(label) + '</label>'); c.querySelector('input').onchange = function (e) { S[key] = e.target.checked; upd(); }; return c; }

  var upd = function () { };
  var cnt = function (s) { return s.length; };

  if (mode === 'counter') {
    var st = el('<div class="stats"></div>');
    var keys = ['words', 'characters', 'chars_no_spaces', 'sentences', 'paragraphs', 'reading_time'];
    var dens = el('<div class="stack hide"><span class="lbl">' + esc(t('top_words')) + '</span><div class="row"></div></div>');
    root.append(st, inBar, inp, dens);
    inp.style.minHeight = '260px';
    upd = function () {
      var s = inp.value;
      var words = (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || []);
      var v = [words.length, Array.from(s).length, Array.from(s.replace(/\s/g, '')).length, (s.match(/[^.!?…。]+[.!?…。]+/g) || []).length + (/[^.!?…。\s]\s*$/.test(s) ? 1 : 0), s.split(/\n\s*\n/).filter(function (p) { return p.trim(); }).length];
      var mins = words.length / 220;
      st.innerHTML = keys.map(function (k, i) { return '<div class="stat"><b>' + (i === 5 ? (mins < 1 ? (words.length ? '< 1' : '0') : K.num(Math.round(mins), 0)) + ' ' + esc(t('min')) : K.num(v[i], 0)) + '</b><span>' + esc(t(k)) + '</span></div>'; }).join('');
      var freq = {}; words.forEach(function (w) { w = w.toLowerCase(); if (w.length > 3) freq[w] = (freq[w] || 0) + 1; });
      var top = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; }).slice(0, 10);
      dens.classList.toggle('hide', !top.length);
      K.$('.row', dens).innerHTML = top.map(function (w) { return '<span class="chip">' + esc(w) + ' <b>' + freq[w] + '</b></span>'; }).join('');
    };
  } else if (mode === 'lorem') {
    S.n = 3; S.unit = 'p';
    var f = el('<div class="fields"><label class="f"><span>' + esc(t('amount')) + '</span><input class="inp" type="number" min="1" max="200" value="3"></label><label class="f"><span>' + esc(t('unit')) + '</span><select class="sel"><option value="p">' + esc(t('paragraphs')) + '</option><option value="s">' + esc(t('sentences')) + '</option><option value="w">' + esc(t('words')) + '</option></select></label></div>');
    K.$('input', f).oninput = function (e) { S.n = Math.min(500, Math.max(1, +e.target.value || 1)); upd(); };
    K.$('select', f).onchange = function (e) { S.unit = e.target.value; upd(); };
    var startL = chk('lorem', t('start_lorem'), true);
    var regen = btn('convert', t('generate'), function () { upd(); }, 'btn');
    var bar = el('<div class="row"></div>'); bar.append(startL, regen);
    root.append(f, bar, outWrap);
    var W = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nunc pulvinar sapien et ligula ullamcorper malesuada proin libero nunc consequat interdum varius quam lacus suspendisse faucibus interdum posuere lorem ipsum dolor'.split(' ');
    var rw = function () { return W[Math.floor(Math.random() * W.length)]; };
    var sent = function () { var n = 6 + Math.floor(Math.random() * 10), a = []; for (var i = 0; i < n; i++) a.push(rw()); if (n > 9) a[4] += ','; var s = a.join(' '); return s.charAt(0).toUpperCase() + s.slice(1) + '.'; };
    var para = function () { var n = 3 + Math.floor(Math.random() * 4), a = []; for (var i = 0; i < n; i++) a.push(sent()); return a.join(' '); };
    upd = function () {
      var r;
      if (S.unit === 'w') { var a = []; for (var i = 0; i < S.n; i++) a.push(rw()); r = a.join(' '); }
      else if (S.unit === 's') { var b = []; for (var j = 0; j < S.n; j++) b.push(sent()); r = b.join(' '); }
      else { var c = []; for (var k = 0; k < S.n; k++) c.push(para()); r = c.join('\n\n'); }
      if (S.lorem) { var start = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit'; r = S.unit === 'w' ? start.split(' ').slice(0, S.n).join(' ').replace(/,$/, '') + (S.n > 8 ? ' ' + r.split(' ').slice(8).join(' ') : '') : start + (S.unit === 's' && S.n === 1 ? '.' : '. ') + r.replace(/^[^.]*\.\s?/, ''); }
      out.value = r.trim(); out.style.minHeight = '300px';
    };
    upd(); return;
  } else if (mode === 'tts') {
    S.rate = 1; S.pitch = 1;
    root.append(inBar, inp);
    if (!('speechSynthesis' in window)) { root.append(el('<p class="err">' + esc(t('not_supported')) + '</p>')); return; }
    var vs = el('<label class="f"><span>' + esc(t('voice')) + '</span><select class="sel"></select></label>'), vsel = K.$('select', vs);
    var g = el('<div class="fields"></div>');
    function rg(k, lab, min, max, step) { var r = el('<label class="range"><div><span>' + esc(lab) + '</span><output>1</output></div><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="1"></label>'); var i = K.$('input', r); i.oninput = function () { S[k] = +i.value; K.$('output', r).textContent = i.value; }; return r; }
    g.append(vs, rg('rate', t('speed'), .5, 2, .1), rg('pitch', t('pitch'), 0, 2, .1));
    var voices = [];
    function loadV() {
      voices = speechSynthesis.getVoices();
      var lg = K.lang.slice(0, 2);
      var sorted = voices.slice().sort(function (a, b) { return (b.lang.slice(0, 2) === lg) - (a.lang.slice(0, 2) === lg); });
      vsel.innerHTML = sorted.map(function (v) { return '<option value="' + esc(v.name) + '">' + esc(v.name + ' (' + v.lang + ')') + '</option>'; }).join('');
    }
    loadV(); speechSynthesis.onvoiceschanged = loadV;
    var bar2 = el('<div class="row"></div>');
    bar2.append(btn('play', t('speak'), function () {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(inp.value || t('tts_sample'));
      var v = voices.filter(function (x) { return x.name === vsel.value; })[0]; if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = S.rate; u.pitch = S.pitch; speechSynthesis.speak(u);
    }, 'btn big'), btn('pause', t('pause'), function () { speechSynthesis.paused ? speechSynthesis.resume() : speechSynthesis.pause(); }), btn('stop', t('stop'), function () { speechSynthesis.cancel(); }));
    root.append(g, bar2, el('<p class="muted" style="margin:0">' + esc(t('tts_note')) + '</p>'));
    return;
  } else {
    root.append(inBar, inp);
    if (mode === 'case') {
      S.c = 'upper';
      var cases = [['upper', 'UPPERCASE'], ['lower', 'lowercase'], ['title', t('title_case')], ['sentence', t('sentence_case')], ['camel', 'camelCase'], ['snake', 'snake_case'], ['kebab', 'kebab-case'], ['invert', 'iNVERT']];
      opts.append(K.seg(cases, 'upper', function (v) { S.c = v; upd(); }));
      var LC = K.lang === 'tr' || K.lang === 'az' ? K.lang : undefined;
      var words = function (s) { return s.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^\p{L}\p{N}]+/u).filter(Boolean); };
      upd = function () {
        var s = inp.value, r;
        switch (S.c) {
          case 'upper': r = s.toLocaleUpperCase(LC); break;
          case 'lower': r = s.toLocaleLowerCase(LC); break;
          case 'title': r = s.toLocaleLowerCase(LC).replace(/(^|[\s\-"'(«])(\p{L})/gu, function (m, a, b) { return a + b.toLocaleUpperCase(LC); }); break;
          case 'sentence': r = s.toLocaleLowerCase(LC).replace(/(^\s*|[.!?…]\s+|\n\s*)(\p{L})/gu, function (m, a, b) { return a + b.toLocaleUpperCase(LC); }); break;
          case 'camel': r = s.split('\n').map(function (l) { return words(l).map(function (w, i) { w = w.toLocaleLowerCase(LC); return i ? w.charAt(0).toLocaleUpperCase(LC) + w.slice(1) : w; }).join(''); }).join('\n'); break;
          case 'snake': r = s.split('\n').map(function (l) { return words(l).join('_').toLocaleLowerCase(LC); }).join('\n'); break;
          case 'kebab': r = s.split('\n').map(function (l) { return words(l).join('-').toLocaleLowerCase(LC); }).join('\n'); break;
          case 'invert': r = Array.from(s).map(function (ch) { var u = ch.toLocaleUpperCase(LC); return ch === u ? ch.toLocaleLowerCase(LC) : u; }).join(''); break;
        }
        out.value = r;
      };
    } else if (mode === 'dedupe') {
      opts.append(chk('ci', t('ignore_case'), false), chk('trim', t('trim_lines'), true), chk('empty', t('remove_empty'), true));
      upd = function () {
        var seen = {}, lines = inp.value.split(/\r?\n/), res = [], d = 0;
        lines.forEach(function (l) { var x = S.trim ? l.trim() : l; if (S.empty && !x.trim()) return; var k = S.ci ? x.toLowerCase() : x; if (seen[k]) { d++; return; } seen[k] = 1; res.push(x); });
        out.value = res.join('\n'); info.textContent = t('removed_n_dupes', { n: d }) + ' · ' + t('n_lines', { n: res.length });
      };
    } else if (mode === 'sort') {
      S.s = 'az';
      opts.append(K.seg([['az', 'A → Z'], ['za', 'Z → A'], ['len', t('by_length')], ['num', '1 → 9'], ['rev', t('reverse_order')], ['shuffle', t('shuffle')]], 'az', function (v) { S.s = v; upd(); }), chk('empty', t('remove_empty'), true));
      var coll = new Intl.Collator(K.lang, { numeric: true, sensitivity: 'base' });
      upd = function () {
        var l = inp.value.split(/\r?\n/); if (S.empty) l = l.filter(function (x) { return x.trim(); });
        if (S.s === 'az') l.sort(coll.compare); else if (S.s === 'za') l.sort(coll.compare).reverse();
        else if (S.s === 'len') l.sort(function (a, b) { return a.length - b.length; });
        else if (S.s === 'num') l.sort(function (a, b) { return (parseFloat(a) || 0) - (parseFloat(b) || 0); });
        else if (S.s === 'rev') l.reverse();
        else for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = l[i]; l[i] = l[j]; l[j] = tmp; }
        out.value = l.join('\n');
      };
    } else if (mode === 'replace') {
      var fr = el('<div class="fields"><label class="f"><span>' + esc(t('find')) + '</span><input class="inp" data-k="f"></label><label class="f"><span>' + esc(t('replace_with')) + '</span><input class="inp" data-k="r"></label></div>');
      S.f = ''; S.r = '';
      K.$$('input', fr).forEach(function (i) { i.oninput = function () { S[i.dataset.k] = i.value; upd(); }; });
      root.insertBefore(fr, inBar);
      opts.append(chk('ci', t('ignore_case'), true), chk('whole', t('whole_words'), false), chk('re', t('use_regex'), false));
      upd = function () {
        info.textContent = '';
        if (!S.f) { out.value = inp.value; return; }
        try {
          var src = S.re ? S.f : S.f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (S.whole) src = '(?<![\\p{L}\\p{N}_])' + src + '(?![\\p{L}\\p{N}_])';
          var rx = new RegExp(src, 'gu' + (S.ci ? 'i' : ''));
          var n = (inp.value.match(rx) || []).length;
          out.value = inp.value.replace(rx, S.r.replace(/\\n/g, '\n')); info.textContent = t('n_replacements', { n: n });
        } catch (e) { info.textContent = t('invalid_regex'); }
      };
    } else if (mode === 'clean') {
      opts.append(chk('sp', t('collapse_spaces'), true), chk('tr', t('trim_lines'), true), chk('em', t('remove_empty'), true), chk('br', t('remove_breaks'), false), chk('tab', t('tabs_to_spaces'), true));
      upd = function () {
        var s = inp.value;
        if (S.tab) s = s.replace(/\t/g, ' ');
        if (S.sp) s = s.replace(/[  ]{2,}/g, ' ');
        if (S.tr) s = s.split('\n').map(function (l) { return l.trim(); }).join('\n');
        if (S.em) s = s.replace(/\n\s*\n+/g, '\n');
        if (S.br) s = s.replace(/\s*\n\s*/g, ' ');
        out.value = s.trim();
        info.textContent = t('chars_removed', { n: K.num(Math.max(0, inp.value.length - out.value.length), 0) });
      };
    } else if (mode === 'slug') {
      inp.style.minHeight = '90px'; out.style.minHeight = '70px';
      var M = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'і': 'i', 'ї': 'yi', 'є': 'ye', 'ґ': 'g', 'ə': 'e', 'ı': 'i', 'ß': 'ss', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ł': 'l', 'đ': 'd', 'þ': 'th' };
      S.sep = '-';
      opts.append(K.seg([['-', t('hyphen') + ' -'], ['_', t('underscore') + ' _']], '-', function (v) { S.sep = v; upd(); }), chk('low', t('lowercase'), true));
      upd = function () {
        out.value = inp.value.split('\n').map(function (l) {
          var s = S.low ? l.toLowerCase() : l;
          s = Array.from(s).map(function (c) { var lc = c.toLowerCase(); return M[lc] != null ? (c === lc ? M[lc] : M[lc].toUpperCase()) : c; }).join('');
          return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, S.sep).replace(new RegExp('^\\' + S.sep + '+|\\' + S.sep + '+$', 'g'), '');
        }).join('\n');
      };
    } else if (mode === 'reverse') {
      S.r = 'chars';
      opts.append(K.seg([['chars', t('reverse_chars')], ['words', t('reverse_words')], ['lines', t('reverse_lines')], ['flip', t('upside_down')]], 'chars', function (v) { S.r = v; upd(); }));
      var F = { a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z', '.': '˙', ',': "'", '?': '¿', '!': '¡', '(': ')', ')': '(', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '6': '9', '7': 'ㄥ', '9': '6' };
      upd = function () {
        var s = inp.value;
        if (S.r === 'chars') out.value = Array.from(s).reverse().join('');
        else if (S.r === 'words') out.value = s.split('\n').map(function (l) { return l.split(/(\s+)/).reverse().join(''); }).join('\n');
        else if (S.r === 'lines') out.value = s.split('\n').reverse().join('\n');
        else out.value = Array.from(s.toLowerCase()).reverse().map(function (c) { return F[c] || c; }).join('');
      };
    }
    root.append(opts, outWrap, info);
  }
  inp.addEventListener('input', K.debounce(function () { upd(); }, 60));
  upd();
});

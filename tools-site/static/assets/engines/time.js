TK.register('time', function (root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg;
  function pad(n, l) { return String(n).padStart(l || 2, '0'); }
  function btn(icon, label, cls) { return el('<button class="btn ' + (cls || 'sec') + '" type="button">' + svg(icon) + '<span>' + esc(label) + '</span></button>'); }
  var ac;
  function beep(times) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      for (var i = 0; i < (times || 6); i++) { var os = ac.createOscillator(), g = ac.createGain(); os.frequency.value = 880; os.connect(g); g.connect(ac.destination); var s = ac.currentTime + i * .5; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.3, s + .02); g.gain.linearRampToValueAtTime(0, s + .35); os.start(s); os.stop(s + .4); }
    } catch (e) { }
  }
  if (o.mode === 'stopwatch') {
    var disp = el('<div class="big-time">00:00.00</div>'), laps = el('<div class="laps"></div>');
    var start = 0, acc = 0, run = false, raf, lapList = [], last = 0;
    var bs = btn('play', t('start'), 'btn big'), bl = btn('flip', t('lap')), br = btn('rotate', t('reset'));
    function fmt(ms) { var h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1000) % 60, c = Math.floor(ms / 10) % 100; return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s) + '.' + pad(c); }
    function cur() { return acc + (run ? performance.now() - start : 0); }
    function tick() { disp.textContent = fmt(cur()); if (run) raf = requestAnimationFrame(tick); }
    bs.onclick = function () {
      if (run) { acc = cur(); run = false; cancelAnimationFrame(raf); bs.innerHTML = svg('play') + '<span>' + esc(t('resume')) + '</span>'; }
      else { start = performance.now(); run = true; tick(); bs.innerHTML = svg('pause') + '<span>' + esc(t('pause')) + '</span>'; }
    };
    bl.onclick = function () { if (!run) return; var c = cur(); lapList.unshift([lapList.length + 1, c - last, c]); last = c; laps.innerHTML = lapList.map(function (l) { return '<div><span>' + esc(t('lap')) + ' ' + l[0] + '</span><span>+' + fmt(l[1]) + '</span><b>' + fmt(l[2]) + '</b></div>'; }).join(''); };
    br.onclick = function () { run = false; cancelAnimationFrame(raf); acc = 0; last = 0; lapList = []; laps.innerHTML = ''; disp.textContent = fmt(0); bs.innerHTML = svg('play') + '<span>' + esc(t('start')) + '</span>'; };
    document.addEventListener('keydown', function (e) { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); bs.onclick(); } });
    var row = el('<div class="row" style="justify-content:center"></div>'); row.append(bs, bl, br);
    root.append(disp, row, laps, el('<p class="muted" style="text-align:center">' + esc(t('space_hint')) + '</p>'));
  } else {
    var total = 300000, left = total, end = 0, run2 = false, iv;
    var disp2 = el('<div class="big-time">05:00</div>');
    var inputs = el('<div class="row" style="justify-content:center"><label class="f" style="width:96px"><span>' + esc(t('hours')) + '</span><input class="inp" type="number" min="0" max="99" value="0" data-u="h"></label><label class="f" style="width:96px"><span>' + esc(t('minutes')) + '</span><input class="inp" type="number" min="0" max="59" value="5" data-u="m"></label><label class="f" style="width:96px"><span>' + esc(t('seconds')) + '</span><input class="inp" type="number" min="0" max="59" value="0" data-u="s"></label></div>');
    var presets = el('<div class="row" style="justify-content:center;margin:12px 0"></div>');
    [1, 3, 5, 10, 15, 25, 30, 60].forEach(function (m) { var b = el('<button class="chip" type="button">' + m + ' ' + esc(t('min')) + '</button>'); b.onclick = function () { set(m * 60000); }; presets.appendChild(b); });
    var bs2 = btn('play', t('start'), 'btn big'), br2 = btn('rotate', t('reset'));
    var bar = el('<div class="meter" style="margin:6px 0 18px"><i style="width:100%;background:linear-gradient(90deg,var(--brand),var(--brand2))"></i></div>');
    function fmt2(ms) { var s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s % 60); }
    function show() { disp2.textContent = fmt2(left); K.$('i', bar).style.width = (total ? left / total * 100 : 0) + '%'; document.title = run2 ? fmt2(left) + ' ⏳' : document.title.replace(/^[\d:]+ ⏳ /, ''); }
    var baseTitle = document.title;
    function set(ms) { total = left = ms; run2 = false; clearInterval(iv); var s = Math.round(ms / 1000); K.$('[data-u=h]', inputs).value = Math.floor(s / 3600); K.$('[data-u=m]', inputs).value = Math.floor(s / 60) % 60; K.$('[data-u=s]', inputs).value = s % 60; bs2.innerHTML = svg('play') + '<span>' + esc(t('start')) + '</span>'; document.title = baseTitle; show(); }
    K.$$('input', inputs).forEach(function (i) { i.oninput = function () { var h = +K.$('[data-u=h]', inputs).value || 0, m = +K.$('[data-u=m]', inputs).value || 0, s = +K.$('[data-u=s]', inputs).value || 0; total = left = (h * 3600 + m * 60 + s) * 1000; show(); }; });
    bs2.onclick = function () {
      if (run2) { run2 = false; clearInterval(iv); left = end - Date.now(); bs2.innerHTML = svg('play') + '<span>' + esc(t('resume')) + '</span>'; document.title = baseTitle; return; }
      if (left <= 0) return;
      try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch (e) { }
      run2 = true; end = Date.now() + left; bs2.innerHTML = svg('pause') + '<span>' + esc(t('pause')) + '</span>';
      iv = setInterval(function () { left = Math.max(0, end - Date.now()); show(); if (!left) { clearInterval(iv); run2 = false; beep(8); disp2.style.color = 'var(--brand2)'; setTimeout(function () { disp2.style.color = ''; }, 4000); document.title = '⏰ ' + t('times_up'); bs2.innerHTML = svg('play') + '<span>' + esc(t('start')) + '</span>'; K.toast(t('times_up')); } }, 100);
    };
    br2.onclick = function () { set(total); };
    var row2 = el('<div class="row" style="justify-content:center"></div>'); row2.append(bs2, br2);
    root.append(disp2, bar, inputs, presets, row2);
  }
});

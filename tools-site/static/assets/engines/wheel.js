TK.register('wheel', function (root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg;
  var COLS = ['#5b4cf5', '#e9408f', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6'];
  var names = t('wheel_default').split(',');
  var ta = el('<textarea class="inp" style="min-height:260px"></textarea>'); ta.value = names.join('\n');
  var cv = document.createElement('canvas'); cv.width = cv.height = 880;
  var wrap = el('<div class="wheel-wrap"><div class="wheel-ptr"></div></div>'); wrap.prepend(cv);
  var winner = el('<div class="result hide" style="margin-top:16px"><div class="sub">' + esc(t('winner')) + '</div><div class="big"></div></div>');
  var spinB = el('<button class="btn big" type="button" style="margin:16px auto 0;display:flex">' + svg('rotate') + esc(t('spin')) + '</button>');
  var rmC = el('<label class="chk"><input type="checkbox"> ' + esc(t('remove_winner')) + '</label>');
  var shuf = el('<button class="btn sec sm" type="button">' + svg('convert') + esc(t('shuffle')) + '</button>');
  var ang = 0, spinning = false, last = -1;
  function list() { return ta.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
  function draw() {
    var L = list(), x = cv.getContext('2d'), R = cv.width / 2, n = Math.max(L.length, 1), a = Math.PI * 2 / n;
    x.clearRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < n; i++) {
      x.beginPath(); x.moveTo(R, R); x.arc(R, R, R - 8, ang + i * a, ang + (i + 1) * a); x.closePath();
      x.fillStyle = L.length ? COLS[i % COLS.length] : '#ccc'; if (n % COLS.length === 1 && i === n - 1 && n > 1) x.fillStyle = COLS[4]; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 4; x.stroke();
      if (!L.length) continue;
      x.save(); x.translate(R, R); x.rotate(ang + (i + .5) * a); x.textAlign = 'right'; x.fillStyle = '#fff';
      var fs = Math.max(18, Math.min(44, 520 / n + 12)); x.font = '700 ' + fs + 'px system-ui,sans-serif';
      var s = L[i]; while (x.measureText(s).width > R - 110 && s.length > 2) s = s.slice(0, -1); if (s !== L[i]) s += '…';
      x.fillText(s, R - 34, fs / 3); x.restore();
    }
    x.beginPath(); x.arc(R, R, 56, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.08)'; x.stroke();
  }
  spinB.onclick = function () {
    var L = list(); if (spinning || L.length < 2) return;
    if (rmC.querySelector('input').checked && last >= 0) { var cur = list(); cur.splice(last, 1); ta.value = cur.join('\n'); L = cur; last = -1; draw(); if (L.length < 2) return; }
    spinning = true; winner.classList.add('hide');
    var start = ang, rnd = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296, target = start + Math.PI * 2 * (6 + rnd * 4), dur = 5200, t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4); ang = start + (target - start) * e; draw();
      if (p < 1) return requestAnimationFrame(step);
      spinning = false;
      var n = L.length, a = Math.PI * 2 / n, pointer = -Math.PI / 2, rel = ((pointer - ang) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2), idx = Math.floor(rel / a) % n;
      last = idx; K.$('.big', winner).textContent = L[idx]; winner.classList.remove('hide');
    })(t0);
  };
  shuf.onclick = function () { var L = list(); for (var i = L.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), tm = L[i]; L[i] = L[j]; L[j] = tm; } ta.value = L.join('\n'); draw(); };
  ta.oninput = K.debounce(draw, 100);
  var lay = el('<div class="fields" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:start"></div>');
  var left = el('<div></div>'); left.append(wrap, spinB, winner);
  var right = el('<div class="stack"><span class="lbl">' + esc(t('wheel_entries')) + '</span></div>'); var r2 = el('<div class="row"></div>'); r2.append(shuf, rmC); right.append(ta, r2);
  lay.append(left, right); root.append(lay); draw();
  cv.style.cursor = 'pointer'; cv.onclick = spinB.onclick;
});

TK.register('media', function (root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg;
  var screen = o.mode === 'screen';
  function btn(icon, label, cls) { return el('<button class="btn ' + (cls || 'sec') + '" type="button">' + svg(icon) + '<span>' + esc(label) + '</span></button>'); }
  var ok = screen ? !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) : !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  if (!ok || !window.MediaRecorder) { root.append(el('<p class="err">' + esc(t(screen ? 'screen_not_supported' : 'not_supported')) + '</p>')); return; }
  var mic = true;
  var opt = el('<label class="chk"><input type="checkbox" checked> ' + esc(t('record_mic')) + '</label>');
  K.$('input', opt).onchange = function (e) { mic = e.target.checked; };
  var startB = btn(screen ? 'monitor' : 'mic', t('start_recording'), 'btn big');
  var stopB = btn('stop', t('stop_recording'), 'btn'); stopB.style.background = 'var(--err)'; stopB.classList.add('hide');
  var timer = el('<div class="big-time hide" style="font-size:56px">00:00</div>');
  var live = el('<video class="vid hide" muted playsinline></video>');
  var canvas = el('<canvas class="hide" height="80" style="width:100%;height:80px;border-radius:12px;background:var(--bg2)"></canvas>');
  var res = el('<div class="stack hide"></div>');
  var recs = [], rec, stream, t0, iv, raf;
  function mime() { var c = screen ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'] : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']; for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported(c[i])) return c[i]; return ''; }
  function pad(n) { return String(n).padStart(2, '0'); }
  startB.onclick = function () {
    var p = screen ? navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true }).then(function (s) {
      if (!mic) return s;
      return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (m) {
        try {
          var ctx = new AudioContext(), dst = ctx.createMediaStreamDestination();
          if (s.getAudioTracks().length) ctx.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(dst);
          ctx.createMediaStreamSource(m).connect(dst);
          var out = new MediaStream(s.getVideoTracks().concat(dst.stream.getAudioTracks()));
          out._stop = function () { s.getTracks().concat(m.getTracks()).forEach(function (x) { x.stop(); }); ctx.close(); };
          return out;
        } catch (e) { return s; }
      }, function () { return s; });
    }) : navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    p.then(function (s) {
      stream = s; recs = [];
      var mt = mime(); rec = new MediaRecorder(s, mt ? { mimeType: mt } : undefined);
      rec.ondataavailable = function (e) { if (e.data.size) recs.push(e.data); };
      rec.onstop = finish;
      rec.start(1000); t0 = Date.now();
      s.getVideoTracks().forEach(function (tr) { tr.onended = function () { if (rec.state !== 'inactive') rec.stop(); }; });
      iv = setInterval(function () { var s2 = Math.floor((Date.now() - t0) / 1000); timer.textContent = pad(Math.floor(s2 / 60)) + ':' + pad(s2 % 60); }, 250);
      startB.classList.add('hide'); opt.classList.add('hide'); stopB.classList.remove('hide'); timer.classList.remove('hide'); res.classList.add('hide');
      if (screen) { live.srcObject = s; live.classList.remove('hide'); live.play(); } else viz(s);
    }, function (e) { K.toast(t('permission_denied')); });
  };
  stopB.onclick = function () { if (rec && rec.state !== 'inactive') rec.stop(); };
  function viz(s) {
    try {
      var ctx = new AudioContext(), an = ctx.createAnalyser(); an.fftSize = 256; ctx.createMediaStreamSource(s).connect(an);
      var d = new Uint8Array(an.frequencyBinCount), c = canvas, x = c.getContext('2d'); c.classList.remove('hide'); c.width = c.offsetWidth * 2; c.height = 160;
      var col = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#5b4cf5';
      (function draw() { an.getByteFrequencyData(d); x.clearRect(0, 0, c.width, c.height); var w = c.width / d.length; for (var i = 0; i < d.length; i++) { var h = d[i] / 255 * c.height; x.fillStyle = col; x.fillRect(i * w, (c.height - h) / 2, w - 2, h || 2); } raf = requestAnimationFrame(draw); })();
      s._ctx = ctx;
    } catch (e) { }
  }
  function finish() {
    clearInterval(iv); cancelAnimationFrame(raf);
    if (stream) { if (stream._stop) stream._stop(); stream.getTracks().forEach(function (x) { x.stop(); }); if (stream._ctx) stream._ctx.close(); }
    live.classList.add('hide'); live.srcObject = null; canvas.classList.add('hide');
    var type = (rec.mimeType || (screen ? 'video/webm' : 'audio/webm')).split(';')[0];
    var blob = new Blob(recs, { type: type }), url = URL.createObjectURL(blob), ext = type.indexOf('mp4') > 0 ? (screen ? 'mp4' : 'm4a') : type.indexOf('ogg') > 0 ? 'ogg' : 'webm';
    res.innerHTML = '';
    res.append(el(screen ? '<video class="vid" controls playsinline src="' + url + '"></video>' : '<audio controls style="width:100%" src="' + url + '"></audio>'), el('<p class="muted" style="margin:0">' + K.bytes(blob.size) + ' · ' + timer.textContent + '</p>'));
    var d = btn('download', t('download') + ' .' + ext, 'btn big'); d.onclick = function () { K.download(blob, (screen ? 'screen-recording-' : 'voice-recording-') + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') + '.' + ext); };
    res.append(d);
    res.classList.remove('hide'); stopB.classList.add('hide'); startB.classList.remove('hide'); opt.classList.remove('hide'); timer.classList.add('hide');
    startB.querySelector('span').textContent = t('record_again');
  }
  var row = el('<div class="row" style="justify-content:center"></div>'); row.append(startB, stopB);
  if (!screen) opt.classList.add('hide');
  root.append(el('<div class="stack" style="text-align:center"></div>'));
  var st = root.lastChild; st.append(timer, live, canvas, row, opt, res, el('<p class="muted" style="margin:0">' + esc(t(screen ? 'screen_note' : 'voice_note')) + '</p>'));
  opt.style.justifySelf = 'center';
});

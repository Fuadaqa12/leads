TK.register('image', function (root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg;
  var mode = o.mode || 'compress';
  if (mode === 'base64') return b64(root, o, K);
  var EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  var items = [];
  var S = { q: 70, fmt: o.to || 'same', maxw: 0, rmode: 'px', w: '', h: '', keep: true, pct: 50, angle: 0, fh: false, fv: false,
    f: { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0, invert: 0, 'hue-rotate': 0 } };
  if (mode === 'convert' && !o.to) S.fmt = 'image/png';
  if (mode === 'compress') S.fmt = 'same';

  var dz = K.dropzone({ accept: 'image/*', multiple: true, paste: true, hint: t('drop_hint_img'), onFiles: add });
  var work = el('<div class="stack hide"></div>');
  var settings = el('<div class="panel stack"></div>');
  var list = el('<div class="files"></div>');
  var actions = el('<div class="row end"></div>');
  var more = K.dropzone({ accept: 'image/*', multiple: true, mini: true, label: t('add_more'), onFiles: add });
  var clr = el('<button class="btn sec sm" type="button">' + svg('trash') + esc(t('clear')) + '</button>');
  var all = el('<button class="btn big" type="button">' + svg('download') + esc(t('download_all')) + '</button>');
  actions.append(clr, all);
  work.append(settings, list, more, actions);
  root.append(dz, work);

  clr.onclick = function () { items = []; render(); };
  all.onclick = function () { items.forEach(function (it, i) { if (it.out) setTimeout(function () { K.download(it.out.blob, it.out.name); }, i * 350); }); };

  function rng(key, label, min, max, val, unit, onIn) {
    var r = el('<label class="range"><div><span>' + esc(label) + '</span><output>' + val + (unit || '') + '</output></div><input type="range" min="' + min + '" max="' + max + '" value="' + val + '"></label>');
    var i = r.querySelector('input'), out = r.querySelector('output');
    i.oninput = function () { out.textContent = i.value + (unit || ''); onIn(+i.value); };
    return r;
  }
  function fmtSelect(withSame) {
    var opts = (withSame ? [['same', t(mode === 'compress' ? 'auto_best' : 'same_format')]] : []).concat([['image/jpeg', 'JPG'], ['image/png', 'PNG'], ['image/webp', 'WEBP']]);
    var f = el('<label class="f"><span>' + esc(t('output_format')) + '</span><select class="sel">' + opts.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === S.fmt ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>');
    f.querySelector('select').onchange = function (e) { S.fmt = e.target.value; qWrap.classList.toggle('hide', S.fmt === 'image/png'); run(); };
    return f;
  }
  var qWrap = rng('q', t('quality'), 5, 100, S.q, '%', function (v) { S.q = v; run(); });

  if (mode === 'compress') {
    var g = el('<div class="fields"></div>');
    var mw = el('<label class="f"><span>' + esc(t('max_width')) + '</span><select class="sel"><option value="0">' + esc(t('original_size')) + '</option>' + [3840, 2560, 1920, 1600, 1280, 1024, 800, 640].map(function (v) { return '<option value="' + v + '">' + v + ' px</option>'; }).join('') + '</select></label>');
    mw.querySelector('select').onchange = function (e) { S.maxw = +e.target.value; run(); };
    g.append(fmtSelect(true), mw);
    settings.append(qWrap, g, el('<p class="muted" style="margin:0">' + esc(t('compress_tip')) + '</p>'));
  } else if (mode === 'convert') {
    settings.append(fmtSelect(false), qWrap);
    qWrap.classList.toggle('hide', S.fmt === 'image/png');
  } else if (mode === 'resize') {
    var px = el('<div class="fields"><label class="f"><span>' + esc(t('width')) + '</span><div class="inp-u"><input class="inp" inputmode="numeric" data-k="w"><em>px</em></div></label><label class="f"><span>' + esc(t('height')) + '</span><div class="inp-u"><input class="inp" inputmode="numeric" data-k="h"><em>px</em></div></label></div>');
    var keep = el('<label class="chk"><input type="checkbox" checked> ' + esc(t('keep_ratio')) + '</label>');
    var pctR = rng('pct', t('scale'), 1, 200, S.pct, '%', function (v) { S.pct = v; run(); });
    var pxWrap = el('<div class="stack"></div>'); pxWrap.append(px, keep);
    pctR.classList.add('hide');
    var sg = K.seg([['px', t('by_pixels')], ['pct', t('by_percent')]], 'px', function (v) { S.rmode = v; pxWrap.classList.toggle('hide', v !== 'px'); pctR.classList.toggle('hide', v !== 'pct'); run(); });
    K.$$('input.inp', px).forEach(function (i) {
      i.oninput = function () {
        S[i.dataset.k] = i.value;
        var f = items[0]; if (S.keep && f) { var other = i.dataset.k === 'w' ? 'h' : 'w'; var r = f.h / f.w; var v = K.pnum(i.value); var ov = isFinite(v) ? Math.round(i.dataset.k === 'w' ? v * r : v / r) : ''; S[other] = ov; K.$('[data-k=' + other + ']', px).value = ov; }
        run();
      };
    });
    keep.querySelector('input').onchange = function (e) { S.keep = e.target.checked; };
    settings.append(sg, pxWrap, pctR, fmtSelect(true));
    settings.lastChild.querySelector('select').value = 'same';
    settings._px = px;
  } else if (mode === 'rotate') {
    var r = el('<div class="row"></div>');
    [['rl', 'rotate', t('rotate_left'), function () { S.angle = (S.angle + 270) % 360; }], ['rr', 'rotate', t('rotate_right'), function () { S.angle = (S.angle + 90) % 360; }],
     ['fh', 'flip', t('flip_h'), function () { S.fh = !S.fh; }], ['fv', 'flip', t('flip_v'), function () { S.fv = !S.fv; }]].forEach(function (b) {
      var x = el('<button class="btn sec" type="button">' + svg(b[1]) + esc(b[2]) + '</button>');
      if (b[0] === 'rl') x.firstChild.style.transform = 'scaleX(-1)';
      if (b[0] === 'fv') x.firstChild.style.transform = 'rotate(90deg)';
      x.onclick = function () { b[3](); run(); }; r.appendChild(x);
    });
    settings.append(r, fmtSelect(true));
  } else if (mode === 'filter') {
    var names = { brightness: [0, 200, '%'], contrast: [0, 200, '%'], saturate: [0, 300, '%'], grayscale: [0, 100, '%'], sepia: [0, 100, '%'], blur: [0, 20, 'px'], invert: [0, 100, '%'], 'hue-rotate': [0, 360, '°'] };
    var pre = el('<div class="row"></div>');
    [['none', t('f_original')], ['bw', t('f_bw')], ['vintage', t('f_vintage')], ['vivid', t('f_vivid')], ['soft', t('f_soft')]].forEach(function (p) {
      var b = el('<button class="btn sec sm" type="button">' + esc(p[1]) + '</button>');
      b.onclick = function () {
        var P = { none: {}, bw: { grayscale: 100, contrast: 115 }, vintage: { sepia: 55, contrast: 110, saturate: 80, brightness: 105 }, vivid: { saturate: 160, contrast: 115 }, soft: { brightness: 108, contrast: 90, saturate: 90, blur: 0 } }[p[0]];
        for (var k in S.f) S.f[k] = P[k] != null ? P[k] : (k === 'brightness' || k === 'contrast' || k === 'saturate' ? 100 : 0);
        buildSliders(); run();
      };
      pre.appendChild(b);
    });
    var sl = el('<div class="fields"></div>');
    function buildSliders() { sl.innerHTML = ''; for (var k in names) (function (k) { sl.appendChild(rng(k, t('f_' + k.replace('-', '_')), names[k][0], names[k][1], S.f[k], names[k][2], function (v) { S.f[k] = v; run(); })); })(k); }
    buildSliders();
    settings.append(pre, sl, fmtSelect(true));
  }

  function add(files) {
    files.forEach(function (f) {
      if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|bmp|avif|heic)$/i.test(f.name)) return;
      var it = { file: f, row: null };
      items.push(it);
      K.loadImage(f).then(function (img) {
        it.img = img; it.w = img.naturalWidth; it.h = img.naturalHeight;
        if (mode === 'resize' && items[0] === it && !S.w) { S.w = it.w; S.h = it.h; K.$('[data-k=w]', settings._px).value = it.w; K.$('[data-k=h]', settings._px).value = it.h; }
        proc(it);
      }, function () { it.err = true; draw(it); });
    });
    render();
  }
  function render() {
    work.classList.toggle('hide', !items.length); dz.classList.toggle('hide', !!items.length);
    list.innerHTML = '';
    items.forEach(function (it, i) {
      it.row = el('<div class="file"></div>');
      list.appendChild(it.row); draw(it, i);
    });
    all.classList.toggle('hide', items.length < 2);
  }
  function draw(it) {
    if (!it.row) return;
    var f = it.file, o2 = it.out;
    var thumb = o2 ? '<img class="th" src="' + o2.url + '" alt="">' : '<div class="th">' + (it.err ? '!' : '…') + '</div>';
    var info = '';
    if (it.err) info = '<span class="err">' + esc(t('cannot_read')) + '</span>';
    else if (o2) {
      var diff = Math.round((1 - o2.blob.size / f.size) * 100);
      info = K.bytes(f.size) + ' → <b>' + K.bytes(o2.blob.size) + '</b>' + (mode === 'compress' || diff > 0 ? ' <span class="save' + (diff < 0 ? ' neg' : '') + '">' + (diff >= 0 ? '−' : '+') + Math.abs(diff) + '%</span>' : '') + ' · ' + o2.w + '×' + o2.h + (o2.kept ? ' · ' + esc(t('already_optimal')) : '');
    } else info = K.bytes(f.size) + ' · ' + esc(t('processing'));
    it.row.innerHTML = thumb + '<div class="meta"><div class="nm">' + esc(f.name) + '</div><div class="sz">' + info + '</div></div>';
    var rm = el('<button class="ibtn" type="button" aria-label="' + esc(t('remove')) + '">' + svg('x') + '</button>');
    rm.onclick = function () { items.splice(items.indexOf(it), 1); render(); };
    if (o2) { var d = el('<button class="btn sm" type="button">' + svg('download') + '<span>' + esc(t('download')) + '</span></button>'); d.onclick = function () { K.download(o2.blob, o2.name); }; it.row.appendChild(d); }
    it.row.appendChild(rm);
  }
  var run = K.debounce(function () { items.forEach(proc); }, 250);

  function outType(f) {
    if (S.fmt !== 'same') return S.fmt;
    if (mode === 'compress' && f.type === 'image/png') return 'image/webp';
    return EXT[f.type] ? f.type : 'image/png';
  }
  function proc(it) {
    if (!it.img) return;
    var img = it.img, w = it.w, h = it.h, tw = w, th = h;
    if (mode === 'compress' && S.maxw && w > S.maxw) { tw = S.maxw; th = Math.round(h * S.maxw / w); }
    if (mode === 'resize') {
      if (S.rmode === 'pct') { tw = Math.max(1, Math.round(w * S.pct / 100)); th = Math.max(1, Math.round(h * S.pct / 100)); }
      else {
        var W = K.pnum(S.w), H = K.pnum(S.h);
        if (items[0] !== it && S.keep && isFinite(W)) { tw = Math.round(W); th = Math.round(h * W / w); }
        else { tw = isFinite(W) && W > 0 ? Math.round(W) : w; th = isFinite(H) && H > 0 ? Math.round(H) : Math.round(h * tw / w); }
      }
      tw = Math.min(tw, 16000); th = Math.min(th, 16000);
    }
    var rot = mode === 'rotate' ? S.angle : 0, swap = rot === 90 || rot === 270;
    var c = document.createElement('canvas'); c.width = swap ? th : tw; c.height = swap ? tw : th;
    var x = c.getContext('2d');
    var type = outType(it.file);
    if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    x.imageSmoothingQuality = 'high';
    if (mode === 'filter') {
      var fs = []; for (var k in S.f) fs.push(k + '(' + S.f[k] + (k === 'blur' ? 'px' : k === 'hue-rotate' ? 'deg' : '%') + ')');
      x.filter = fs.join(' ');
    }
    x.translate(c.width / 2, c.height / 2);
    if (rot) x.rotate(rot * Math.PI / 180);
    if (mode === 'rotate') x.scale(S.fh ? -1 : 1, S.fv ? -1 : 1);
    if (tw < w / 2) { // step down for quality
      var s = document.createElement('canvas'), cw = w, ch = h, src = img;
      while (cw / 2 > tw) { cw = Math.round(cw / 2); ch = Math.round(ch / 2); s = document.createElement('canvas'); s.width = cw; s.height = ch; s.getContext('2d').drawImage(src, 0, 0, cw, ch); src = s; }
      x.drawImage(src, -tw / 2, -th / 2, tw, th);
    } else x.drawImage(img, -tw / 2, -th / 2, tw, th);
    var q = (type === 'image/png') ? undefined : S.q / 100;
    if (mode !== 'compress' && mode !== 'convert') q = type === 'image/png' ? undefined : .92;
    var token = it.token = {};
    K.canvasBlob(c, type, q).then(function (blob) {
      if (it.token !== token || !blob) return;
      var kept = false;
      if (mode === 'compress' && blob.size >= it.file.size && S.fmt === 'same' && !S.maxw) { blob = it.file; kept = true; }
      if (it.out) URL.revokeObjectURL(it.out.url);
      var ext = EXT[blob.type] || EXT[type] || 'png';
      var suffix = { compress: '-compressed', resize: '-' + c.width + 'x' + c.height, convert: '', rotate: '-rotated', filter: '-edited' }[mode] || '';
      it.out = { blob: blob, url: URL.createObjectURL(blob), w: c.width, h: c.height, kept: kept, name: K.baseName(it.file.name) + suffix + '.' + ext };
      draw(it);
    });
  }
});

function b64(root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg;
  var a = el('<div class="stack"></div>'), b = el('<div class="stack hide"></div>');
  var sg = K.seg([['enc', t('img_to_b64')], ['dec', t('b64_to_img')]], 'enc', function (v) { a.classList.toggle('hide', v !== 'enc'); b.classList.toggle('hide', v !== 'dec'); });
  var out = el('<div class="stack hide"><div class="preview"><img alt=""></div><p class="muted" style="margin:0"></p><textarea class="inp mono" readonly></textarea><div class="row"></div></div>');
  var dz = K.dropzone({ accept: 'image/*', paste: true, hint: t('drop_hint_img'), onFiles: function (f) {
    var r = new FileReader(); r.onload = function () {
      var d = r.result; out.classList.remove('hide');
      K.$('img', out).src = d; K.$('textarea', out).value = d;
      K.$('p', out).textContent = f[0].name + ' · ' + K.bytes(f[0].size) + ' → ' + K.bytes(d.length) + ' ' + t('characters').toLowerCase();
      var row = K.$('.row', out); row.innerHTML = '';
      [[t('copy_data_uri'), d], ['CSS', 'background-image: url("' + d + '");'], ['HTML', '<img src="' + d + '" alt="">'], [t('copy_base64_only'), d.split(',')[1]]].forEach(function (x) {
        var bt = el('<button class="btn sec sm" type="button">' + svg('copy') + esc(x[0]) + '</button>'); bt.onclick = function () { K.copy(x[1]); }; row.appendChild(bt);
      });
    }; r.readAsDataURL(f[0]);
  } });
  a.append(dz, out);
  var ta = el('<textarea class="inp mono" placeholder="data:image/png;base64,iVBORw0..."></textarea>');
  var pv = el('<div class="preview hide"><img alt=""></div>');
  var msg = el('<p class="err hide"></p>');
  var dl = el('<button class="btn big hide" type="button">' + svg('download') + esc(t('download')) + '</button>');
  ta.oninput = function () {
    var v = ta.value.trim().replace(/\s/g, ''); msg.classList.add('hide'); pv.classList.add('hide'); dl.classList.add('hide');
    if (!v) return;
    if (!/^data:/.test(v)) { var mt = v.charAt(0) === '/' ? 'jpeg' : v.slice(0, 5) === 'UklGR' ? 'webp' : v.slice(0, 3) === 'R0l' ? 'gif' : 'png'; v = 'data:image/' + mt + ';base64,' + v; }
    var im = K.$('img', pv); im.onload = function () { pv.classList.remove('hide'); dl.classList.remove('hide'); };
    im.onerror = function () { msg.textContent = t('invalid_b64'); msg.classList.remove('hide'); };
    im.src = v;
    dl.onclick = function () { var ext = (v.match(/^data:image\/(\w+)/) || [0, 'png'])[1].replace('jpeg', 'jpg'); K.download(v, 'image.' + ext); };
  };
  b.append(ta, msg, pv, dl);
  root.append(sg, a, b);
}

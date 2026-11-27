TK.register('pdf', function (root, o, K) {
  var t = K.t, el = K.el, esc = K.esc, svg = K.svg;
  var mode = o.mode || 'merge';
  var multi = mode === 'merge' || mode === 'images';
  var isImg = mode === 'images';
  var items = [];
  var P = function () { return window.PDFLib; };

  var dz = K.dropzone({ accept: isImg ? 'image/*' : 'application/pdf,.pdf', multiple: multi, paste: isImg, hint: t(isImg ? 'drop_hint_img' : 'drop_hint_pdf'), onFiles: add });
  var work = el('<div class="stack hide"></div>');
  var list = el('<div class="files"></div>');
  var settings = el('<div class="panel stack"></div>');
  var status = el('<p class="muted hide" style="margin:0"></p>');
  var go = el('<button class="btn big" type="button"></button>');
  var actions = el('<div class="row end"></div>');
  var reset = el('<button class="btn sec" type="button">' + svg('trash') + esc(t('start_over')) + '</button>');
  actions.append(reset, go);
  var more = multi ? K.dropzone({ accept: isImg ? 'image/*' : 'application/pdf,.pdf', multiple: true, mini: true, label: t('add_more'), onFiles: add }) : null;
  work.append(list); if (more) work.append(more); work.append(settings, status, actions);
  root.append(dz, work);
  reset.onclick = function () { items = []; render(); };

  var label = { merge: t('merge_pdf_btn'), split: t('split_pdf_btn'), images: t('create_pdf_btn'), rotate: t('rotate_pdf_btn'), delete: t('delete_pages_btn') }[mode];
  go.innerHTML = svg('download') + '<span>' + esc(label) + '</span>';

  var S = { range: '', each: false, angle: 90, size: 'a4', orient: 'auto', margin: 'small' };
  if (mode === 'split') {
    var sg = K.seg([['range', t('extract_range')], ['each', t('every_page')]], 'range', function (v) { S.each = v === 'each'; rf.classList.toggle('hide', S.each); });
    var rf = el('<label class="f"><span>' + esc(t('pages_to_extract')) + '</span><input class="inp" placeholder="1-3, 5, 8-10"></label>');
    rf.querySelector('input').oninput = function (e) { S.range = e.target.value; };
    settings.append(sg, rf);
  } else if (mode === 'delete') {
    var df = el('<label class="f"><span>' + esc(t('pages_to_delete')) + '</span><input class="inp" placeholder="2, 4-6"></label>');
    df.querySelector('input').oninput = function (e) { S.range = e.target.value; };
    settings.append(df);
  } else if (mode === 'rotate') {
    var ag = K.seg([[90, '90° ↻'], [180, '180°'], [270, '90° ↺']], 90, function (v) { S.angle = v; });
    var rr = el('<label class="f"><span>' + esc(t('pages_optional')) + '</span><input class="inp" placeholder="' + esc(t('all_pages')) + '"></label>');
    rr.querySelector('input').oninput = function (e) { S.range = e.target.value; };
    settings.append(ag, rr);
  } else if (mode === 'images') {
    var g = el('<div class="fields"></div>');
    function sel(key, lab, opts) { var f = el('<label class="f"><span>' + esc(lab) + '</span><select class="sel">' + opts.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + '</option>'; }).join('') + '</select></label>'); f.querySelector('select').onchange = function (e) { S[key] = e.target.value; }; return f; }
    g.append(sel('size', t('page_size'), [['a4', 'A4'], ['letter', 'Letter'], ['fit', t('fit_image')]]), sel('orient', t('orientation'), [['auto', t('auto')], ['portrait', t('portrait')], ['landscape', t('landscape')]]), sel('margin', t('margin'), [['small', t('small')], ['none', t('none')], ['big', t('large')]]));
    settings.append(g);
  } else settings.classList.add('hide');

  function add(files) {
    files.forEach(function (f) {
      var it = { file: f, pages: null };
      if (!multi) items = [];
      items.push(it);
      if (!isImg) f.arrayBuffer().then(function (buf) { it.buf = buf; return P().PDFDocument.load(buf, { ignoreEncryption: true }); }).then(function (d) { it.pages = d.getPageCount(); render(); }, function () { it.err = true; render(); });
      else { it.url = URL.createObjectURL(f); }
    });
    render();
  }
  function render() {
    work.classList.toggle('hide', !items.length); dz.classList.toggle('hide', !!items.length); status.classList.add('hide');
    list.innerHTML = '';
    items.forEach(function (it, i) {
      var th = isImg ? '<img class="th" src="' + it.url + '" alt="">' : '<div class="th">PDF</div>';
      var info = K.bytes(it.file.size) + (it.pages ? ' · ' + t('n_pages', { n: it.pages }) : '') + (it.err ? ' · <span class="err">' + esc(t('cannot_read')) + '</span>' : '');
      var row = el('<div class="file">' + th + '<div class="meta"><div class="nm">' + (multi ? (i + 1) + '. ' : '') + esc(it.file.name) + '</div><div class="sz">' + info + '</div></div></div>');
      if (multi) {
        var up = el('<button class="ibtn" type="button" aria-label="up">' + svg('up') + '</button>'), dn = el('<button class="ibtn" type="button" aria-label="down">' + svg('down') + '</button>');
        up.disabled = i === 0; dn.disabled = i === items.length - 1;
        up.onclick = function () { items.splice(i - 1, 0, items.splice(i, 1)[0]); render(); };
        dn.onclick = function () { items.splice(i + 1, 0, items.splice(i, 1)[0]); render(); };
        row.append(up, dn);
      }
      var rm = el('<button class="ibtn" type="button" aria-label="' + esc(t('remove')) + '">' + svg('x') + '</button>');
      rm.onclick = function () { items.splice(i, 1); render(); }; row.appendChild(rm);
      list.appendChild(row);
    });
    go.disabled = mode === 'merge' ? items.length < 2 : !items.length;
    if (mode === 'merge' && items.length === 1) { status.textContent = t('add_second_pdf'); status.classList.remove('hide'); }
  }
  function parseRange(s, max) {
    var out = [];
    String(s || '').split(/[,;]+/).forEach(function (p) {
      p = p.trim(); if (!p) return;
      var m = p.match(/^(\d+)\s*[-–]\s*(\d*)$/);
      if (m) { var a = +m[1], b = m[2] ? +m[2] : max; if (a > b) { var tmp = a; a = b; b = tmp; } for (var i = a; i <= b; i++) if (i >= 1 && i <= max) out.push(i - 1); }
      else if (/^\d+$/.test(p) && +p >= 1 && +p <= max) out.push(+p - 1);
    });
    return out.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }
  function save(doc, name) { return doc.save().then(function (b) { K.download(new Blob([b], { type: 'application/pdf' }), name); }); }
  function busy(on) { go.disabled = on; go.innerHTML = on ? '<span class="spin"></span><span>' + esc(t('processing')) + '</span>' : svg('download') + '<span>' + esc(label) + '</span>'; }
  function done(msg) { busy(false); status.innerHTML = '<span class="okmsg">✓ ' + esc(msg || t('done_downloaded')) + '</span>'; status.classList.remove('hide'); }
  function fail(e) { console.error(e); busy(false); status.innerHTML = '<span class="err">' + esc(e && e.userMsg || t('error')) + '</span>'; status.classList.remove('hide'); }
  function uerr(k) { var e = new Error(k); e.userMsg = t(k); return e; }

  go.onclick = function () {
    if (!P()) return fail(uerr('error'));
    var L = P(); busy(true);
    var base = items[0] ? K.baseName(items[0].file.name) : 'document';
    var job;
    if (mode === 'merge') {
      job = L.PDFDocument.create().then(function (out) {
        return items.reduce(function (p, it) {
          return p.then(function () { return L.PDFDocument.load(it.buf, { ignoreEncryption: true }).then(function (src) { return out.copyPages(src, src.getPageIndices()).then(function (pg) { pg.forEach(function (x) { out.addPage(x); }); }); }); });
        }, Promise.resolve()).then(function () { return save(out, 'merged.pdf'); });
      });
    } else if (mode === 'images') {
      job = L.PDFDocument.create().then(function (out) {
        var A4 = [595.28, 841.89], LT = [612, 792];
        return items.reduce(function (p, it) {
          return p.then(function () { return toEmbeddable(it.file); }).then(function (r) {
            return (r.type === 'png' ? out.embedPng(r.buf) : out.embedJpg(r.buf)).then(function (im) {
              var iw = im.width, ih = im.height, pw, ph;
              var m = { none: 0, small: 24, big: 56 }[S.margin];
              if (S.size === 'fit') { pw = iw + m * 2; ph = ih + m * 2; }
              else {
                var base = S.size === 'a4' ? A4 : LT;
                var land = S.orient === 'landscape' || (S.orient === 'auto' && iw > ih);
                pw = land ? base[1] : base[0]; ph = land ? base[0] : base[1];
              }
              var page = out.addPage([pw, ph]);
              var sc = Math.min((pw - m * 2) / iw, (ph - m * 2) / ih, S.size === 'fit' ? 1 : Infinity);
              var dw = iw * sc, dh = ih * sc;
              page.drawImage(im, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
            });
          });
        }, Promise.resolve()).then(function () { return save(out, (items.length === 1 ? base : 'images') + '.pdf'); });
      });
    } else {
      var it = items[0];
      job = L.PDFDocument.load(it.buf, { ignoreEncryption: true }).then(function (src) {
        var n = src.getPageCount();
        if (mode === 'rotate') {
          var idx = S.range.trim() ? parseRange(S.range, n) : src.getPageIndices();
          if (!idx.length) throw uerr('bad_range');
          idx.forEach(function (i) { var pg = src.getPage(i); pg.setRotation(L.degrees((pg.getRotation().angle + S.angle) % 360)); });
          return save(src, base + '-rotated.pdf');
        }
        if (mode === 'delete') {
          var del = parseRange(S.range, n);
          if (!del.length) throw uerr('bad_range');
          if (del.length >= n) throw uerr('cant_delete_all');
          del.sort(function (a, b) { return b - a; }).forEach(function (i) { src.removePage(i); });
          return save(src, base + '-edited.pdf');
        }
        if (mode === 'split') {
          if (S.each) {
            return src.getPageIndices().reduce(function (p, i) {
              return p.then(function () { return L.PDFDocument.create().then(function (d) { return d.copyPages(src, [i]).then(function (pg) { d.addPage(pg[0]); return d.save(); }).then(function (b) { K.download(new Blob([b], { type: 'application/pdf' }), base + '-page-' + (i + 1) + '.pdf'); return new Promise(function (r) { setTimeout(r, 300); }); }); }); });
            }, Promise.resolve());
          }
          var pick = parseRange(S.range, n);
          if (!pick.length) throw uerr('bad_range');
          return L.PDFDocument.create().then(function (d) { return d.copyPages(src, pick).then(function (pg) { pg.forEach(function (x) { d.addPage(x); }); return save(d, base + '-pages.pdf'); }); });
        }
      });
    }
    job.then(function () { done(); }, fail);
  };

  function toEmbeddable(file) {
    if (file.type === 'image/jpeg' || file.type === 'image/png') return file.arrayBuffer().then(function (b) { return { buf: b, type: file.type === 'image/png' ? 'png' : 'jpg' }; });
    return K.loadImage(file).then(function (img) {
      var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
      return K.canvasBlob(c, 'image/jpeg', .92).then(function (b) { return b.arrayBuffer(); }).then(function (b) { return { buf: b, type: 'jpg' }; });
    });
  }
});

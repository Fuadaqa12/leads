// Static site generator: node build.mjs  ->  dist/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATS, TOOLS } from './src/tools.mjs';
import { ICONS, svg } from './src/icons.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const OUT = path.join(HERE, CFG.outDir || 'dist');
const SITE = CFG.siteUrl.replace(/\/$/, '') + '/';
const LANGS = CFG.languages;
const DEF = 'en';
const VER = Date.now().toString(36);

const I = {};
for (const l of LANGS) I[l] = (await import(`./src/i18n/${l}.mjs`)).default;
const EN = I.en;

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (s, v) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
const pre = l => (l === DEF ? '' : l + '/');
const url = (l, p = '') => SITE + pre(l) + p;
const depth = p => p.split('/').filter(Boolean).length;
const relRoot = p => '../'.repeat(depth(p)) || './';

// string getters with English fallback
const S = (l, k) => I[l].s?.[k] ?? EN.s[k] ?? k;
const TN = (l, id) => (I[l].tools?.[id] || EN.tools[id] || [id, '', '']);
const CN = (l, id) => (I[l].cats?.[id] || EN.cats[id]);
const catOf = id => CATS.find(c => c.id === id);

function write(rel, content) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

const ADS = !!CFG.adsenseClient;
function adSlot(name) {
  const slot = CFG.adSlots?.[name];
  if (!ADS || !slot) return '';
  return `<div class="ad live"><span class="ad-label">${esc(S('en', 'ad'))}</span><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(CFG.adsenseClient)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
}

function card(l, t, root) {
  const [n, d, k] = TN(l, t.id), c = catOf(t.cat);
  return `<a class="card" href="${root}${pre(l)}${t.id}/" data-q="${esc(n + ' ' + (k || '') + ' ' + d + ' ' + t.id.replace(/-/g, ' '))}"><span class="ic" style="--c:${c.color}">${svg(t.icon)}</span><div><b>${esc(n)}</b><span>${esc(d)}</span></div></a>`;
}

function layout(l, p, { title, desc, body, alt, schema = [], noindex = false, ogType = 'website', tail = '' }) {
  const root = relRoot(pre(l) + p), M = I[l].meta;
  const alts = alt ? LANGS.map(x => `<link rel="alternate" hreflang="${x}" href="${url(x, alt)}">`).join('') + `<link rel="alternate" hreflang="x-default" href="${url(DEF, alt)}">` : '';
  const langMenu = LANGS.map(x => `<a href="${root}${pre(x)}${alt ?? ''}" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="true"' : ''}>${esc(I[x].meta.name)}<small>${x}</small></a>`).join('');
  const footerCats = CATS.map(c => `<a href="${root}${pre(l)}category/${c.id}/">${esc(CN(l, c.id)[0])}</a>`).join('');
  const footerPop = TOOLS.filter(t => t.pop).slice(0, 6).map(t => `<a href="${root}${pre(l)}${t.id}/">${esc(TN(l, t.id)[0])}</a>`).join('');
  const head = [
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">`,
    `<meta name="root" content="${root}">`,
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url(l, p)}">`,
    alts,
    `<meta property="og:type" content="${ogType}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url(l, p)}"><meta property="og:site_name" content="${esc(CFG.siteName)}"><meta property="og:locale" content="${M.locale}"><meta property="og:image" content="${SITE}assets/og.png"><meta name="twitter:card" content="summary_large_image">`,
    `<meta name="theme-color" content="#5b4cf5"><link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="${root}assets/apple-touch-icon.png">`,
    CFG.gscVerification ? `<meta name="google-site-verification" content="${esc(CFG.gscVerification)}">` : '',
    `<script>try{var t=localStorage.getItem('theme');if(t||matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.setAttribute('data-theme',t||'dark')}catch(e){}</script>`,
    `<link rel="stylesheet" href="${root}assets/style.css?v=${VER}">`,
    ADS ? `<script>window.ADS_CLIENT="${esc(CFG.adsenseClient)}"</script><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(CFG.adsenseClient)}" crossorigin="anonymous"></script>` : '',
    CFG.gaId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(CFG.gaId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(CFG.gaId)}')</script>` : '',
    schema.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join(''),
  ].join('\n');
  return `<!doctype html>
<html lang="${l}" dir="${M.dir || 'ltr'}">
<head>
${head}
</head>
<body>
<header class="hdr"><div class="wrap">
<a class="logo" href="${root}${pre(l)}"><i>${svg('wrench')}</i>${esc(CFG.siteName)}</a>
<div class="hsearch"><input id="hsearch" type="search" placeholder="${esc(S(l, 'searchPh'))}" autocomplete="off" aria-label="${esc(S(l, 'searchPh'))}">${svg('search')}<div class="sres" id="hsres"></div></div>
<div class="row tools-actions" style="gap:8px;flex-wrap:nowrap">
<div class="lang"><button class="hbtn" type="button" aria-label="${esc(S(l, 'language'))}">${svg('globe')}<span class="lt">${esc(M.name)}</span></button><nav class="lang-menu">${langMenu}</nav></div>
<button class="hbtn" id="themeBtn" type="button" aria-label="${esc(S(l, 'theme'))}"></button>
</div>
</div></header>
<main>
${body}
</main>
<footer class="ftr"><div class="wrap">
<div class="cols">
<div><a class="logo" href="${root}${pre(l)}" style="margin-bottom:10px"><i>${svg('wrench')}</i>${esc(CFG.siteName)}</a><p style="margin:10px 0 0;max-width:340px">${esc(S(l, 'footerText'))}</p></div>
<div><h4>${esc(S(l, 'categories'))}</h4>${footerCats}</div>
<div><h4>${esc(S(l, 'popular'))}</h4>${footerPop}</div>
<div><h4>${esc(CFG.siteName)}</h4><a href="${root}${pre(l)}about/">${esc(S(l, 'about'))}</a><a href="${root}${pre(l)}privacy/">${esc(S(l, 'privacy'))}</a><a href="${root}${pre(l)}terms/">${esc(S(l, 'terms'))}</a><a href="${root}${pre(l)}contact/">${esc(S(l, 'contact'))}</a></div>
</div>
<div class="langs">${svg('globe').replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} ${LANGS.map(x => `<a href="${root}${pre(x)}${alt ?? ''}" hreflang="${x}">${esc(I[x].meta.name)}</a>`).join('')}</div>
<p style="margin:16px 0 0">© ${new Date().getFullYear()} ${esc(CFG.siteName)}. ${esc(S(l, 'rights'))}</p>
</div></footer>
<script src="${root}assets/i18n/${l}.js?v=${VER}" defer></script>
<script src="${root}assets/core.js?v=${VER}" defer></script>
${tail}
</body>
</html>`;
}

function homePage(l) {
  const p = '', root = relRoot(pre(l) + p);
  const pop = TOOLS.filter(t => t.pop);
  const chips = CATS.map(c => `<a class="chip" href="#${c.id}"><i style="--c:${c.color}"></i>${esc(CN(l, c.id)[0])}</a>`).join('');
  const secs = CATS.map(c => {
    const ts = TOOLS.filter(t => t.cat === c.id);
    return `<section class="sec" id="${c.id}" data-cat="${c.id}"><div class="sec-h"><div><h2><span class="ic" style="--c:${c.color};width:34px;height:34px;border-radius:10px">${svg(c.icon)}</span>${esc(CN(l, c.id)[0])}</h2></div><a href="${root}${pre(l)}category/${c.id}/">${esc(S(l, 'seeAll'))} →</a></div><div class="grid">${ts.map(t => card(l, t, root)).join('')}</div></section>`;
  }).join('');
  const body = `<section class="hero"><div class="wrap">
<h1>${S(l, 'heroH1')}</h1>
<p>${esc(fill(S(l, 'heroP'), { n: TOOLS.length }))}</p>
<div class="bigsearch"><input id="bigsearch" type="search" placeholder="${esc(S(l, 'searchPh'))}" autocomplete="off" aria-label="${esc(S(l, 'searchPh'))}">${svg('search')}</div>
<div class="badges"><span>${svg('check')}${esc(S(l, 'bFree'))}</span><span>${svg('check')}${esc(S(l, 'bNoSignup'))}</span><span>${svg('check')}${esc(S(l, 'bPrivate'))}</span><span>${svg('check')}${esc(S(l, 'bLangs'))}</span></div>
</div></section>
<div class="wrap">
<div class="chips">${chips}</div>
${adSlot('top')}
<section class="sec" id="popular"><div class="sec-h"><h2>🔥 ${esc(S(l, 'popular'))}</h2></div><div class="grid">${pop.map(t => card(l, t, root)).join('')}</div></section>
${secs}
<p class="empty hide" id="noRes">${esc(S(l, 'noResults'))}</p>
<section class="sec content"><h2>${esc(fill(S(l, 'whyTitle'), { site: CFG.siteName }))}</h2>${features(l)}<p>${esc(fill(S(l, 'homeAbout'), { site: CFG.siteName, n: TOOLS.length }))}</p></section>
</div>`;
  const schema = [{ '@context': 'https://schema.org', '@type': 'WebSite', name: CFG.siteName, url: url(l), inLanguage: l, potentialAction: undefined }];
  return layout(l, p, { title: fill(S(l, 'homeTitle'), { site: CFG.siteName }), desc: fill(S(l, 'homeDesc'), { n: TOOLS.length }), body, alt: '', schema });
}

function features(l) {
  const f = S(l, 'features');
  const ic = ['shield', 'zap', 'gift', 'phone'];
  return `<div class="feat">${f.map((x, i) => `<div>${svg(ic[i])}<span><b>${esc(x[0])}</b>${esc(x[1])}</span></div>`).join('')}</div>`;
}

function toolPage(l, t) {
  const p = t.id + '/', root = relRoot(pre(l) + p), c = catOf(t.cat);
  const [name, desc] = TN(l, t.id), cat = CN(l, t.cat);
  const v = { name, site: CFG.siteName, cat: cat[0] };
  const steps = S(l, 'steps_' + t.kind).map(s => `<li>${esc(fill(s, v))}</li>`).join('');
  const faq = S(l, 'faq_' + (t.kind === 'file' ? 'file' : 'other')).map(q => [fill(q[0], v), fill(q[1], v)]);
  const extra = I[l].faqx?.[t.id] || EN.faqx?.[t.id];
  if (extra) faq.unshift(...extra.map(q => [q[0], q[1]]));
  const related = TOOLS.filter(x => x.cat === t.cat && x.id !== t.id).slice(0, 6);
  const popular = TOOLS.filter(x => x.pop && x.id !== t.id && x.cat !== t.cat).slice(0, 7);
  const vendor = (t.vendor || []).map(v2 => `<script src="${root}assets/vendor/${v2}" defer></script>`).join('');
  const body = `<div class="wrap">
<nav class="crumbs" aria-label="breadcrumb"><a href="${root}${pre(l)}">${esc(S(l, 'home'))}</a><span>/</span><a href="${root}${pre(l)}category/${t.cat}/">${esc(cat[0])}</a><span>/</span><span>${esc(name)}</span></nav>
<div class="layout"><div>
<div class="thead"><span class="ic lg" style="--c:${c.color}">${svg(t.icon)}</span><div><h1>${esc(name)}</h1><p>${esc(desc)}</p></div></div>
<div class="tool" id="tool" data-engine="${t.engine}" data-opts='${esc(JSON.stringify(t.opts))}'><p class="muted">${esc(S(l, 'loading'))}</p><noscript>${esc(S(l, 'needJs'))}</noscript></div>
${adSlot('mid')}
<article class="content">
<h2>${esc(fill(S(l, 'howTo'), v))}</h2>
<ol class="steps">${steps}</ol>
<h2>${esc(fill(S(l, 'aboutTool'), v))}</h2>
<p>${esc(desc)} ${esc(fill(S(l, 'about_' + t.kind), v))}</p>
${features(l)}
<h2>${esc(S(l, 'faqTitle'))}</h2>
<div class="faq">${faq.map(q => `<details><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}</div>
</article>
${adSlot('bottom')}
<section class="sec"><div class="sec-h"><h2>${esc(fill(S(l, 'moreIn'), v))}</h2><a href="${root}${pre(l)}category/${t.cat}/">${esc(S(l, 'seeAll'))} →</a></div><div class="grid">${related.map(x => card(l, x, root)).join('')}</div></section>
</div>
<aside class="side">
<div class="box"><h3>${esc(S(l, 'popular'))}</h3><div class="minilist">${popular.map(x => `<a href="${root}${pre(l)}${x.id}/"><span class="ic" style="--c:${catOf(x.cat).color}">${svg(x.icon)}</span>${esc(TN(l, x.id)[0])}</a>`).join('')}</div></div>
${adSlot('side')}
</aside></div>
</div>`;
  const tail = `${vendor}<script src="${root}assets/engines/${t.engine}.js?v=${VER}" defer></script>`;
  const schema = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name, description: desc, url: url(l, p), applicationCategory: t.cat === 'calc' ? 'FinanceApplication' : t.cat === 'dev' ? 'DeveloperApplication' : t.cat === 'image' || t.cat === 'media' ? 'MultimediaApplication' : 'UtilitiesApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', inLanguage: l, isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: S(l, 'home'), item: url(l) }, { '@type': 'ListItem', position: 2, name: cat[0], item: url(l, `category/${t.cat}/`) }, { '@type': 'ListItem', position: 3, name, item: url(l, p) }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(q => ({ '@type': 'Question', name: q[0], acceptedAnswer: { '@type': 'Answer', text: q[1] } })) },
  ];
  return layout(l, p, { title: fill(S(l, 'toolTitle'), v), desc: fill(S(l, 'toolDesc'), { ...v, desc }), body, alt: p, schema, tail });
}

function catPage(l, c) {
  const p = `category/${c.id}/`, root = relRoot(pre(l) + p), cat = CN(l, c.id);
  const ts = TOOLS.filter(t => t.cat === c.id);
  const others = CATS.filter(x => x.id !== c.id).map(x => `<a class="chip" href="${root}${pre(l)}category/${x.id}/"><i style="--c:${x.color}"></i>${esc(CN(l, x.id)[0])}</a>`).join('');
  const body = `<div class="wrap">
<nav class="crumbs"><a href="${root}${pre(l)}">${esc(S(l, 'home'))}</a><span>/</span><span>${esc(cat[0])}</span></nav>
<div class="thead"><span class="ic lg" style="--c:${c.color}">${svg(c.icon)}</span><div><h1>${esc(cat[0])}</h1><p>${esc(cat[1])}</p></div></div>
<div class="grid">${ts.map(t => card(l, t, root)).join('')}</div>
${adSlot('mid')}
<div class="chips" style="flex-wrap:wrap;margin-top:34px">${others}</div>
</div>`;
  const schema = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: cat[0], description: cat[1], url: url(l, p), inLanguage: l }];
  return layout(l, p, { title: fill(S(l, 'catTitle'), { cat: cat[0], site: CFG.siteName }), desc: cat[1], body, alt: p, schema });
}

function staticPage(l, key) {
  const p = key + '/';
  const pg = I[l].pages?.[key] || EN.pages[key];
  const v = { site: CFG.siteName, email: CFG.contactEmail || '', url: SITE, date: CFG.policyDate || new Date().toISOString().slice(0, 10) };
  let html = fill(pg[1], v);
  if (key === 'contact' && CFG.contactEmail) html += `<p><a class="btn" href="mailto:${esc(CFG.contactEmail)}">${esc(CFG.contactEmail)}</a></p>`;
  const body = `<div class="wrap"><article class="page"><h1>${esc(fill(pg[0], v))}</h1>${html}</article></div>`;
  return layout(l, p, { title: fill(pg[0], v) + ' | ' + CFG.siteName, desc: fill(pg[0], v) + ' — ' + CFG.siteName, body, alt: p });
}

function notFound() {
  const l = DEF;
  const body = `<div class="wrap"><section class="hero"><h1>404</h1><p>${esc(S(l, 'notFound'))}</p><a class="btn big" href="${SITE}">${esc(S(l, 'home'))}</a></section><div class="grid">${TOOLS.filter(t => t.pop).map(t => card(l, t, SITE)).join('')}</div></div>`;
  return layout(l, '', { title: '404 | ' + CFG.siteName, desc: S(l, 'notFound'), body, noindex: true }).split('content="./"').join('content="' + SITE + '"').split('="./').join('="' + SITE);
}

// ---------- build ----------
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(path.join(HERE, 'static'), OUT);
const urls = [];
const add = (p) => urls.push(p);
for (const l of LANGS) {
  // client strings
  const ui = { ...EN.ui, ...(I[l].ui || {}) };
  const units = { ...EN.units, ...(I[l].units || {}) };
  for (const k in units) ui['u_' + k] = units[k];
  const idx = TOOLS.map(t => { const [n, d, k] = TN(l, t.id); return { n, d, k: (k || '') + ' ' + TN('en', t.id)[0] + ' ' + t.id.replace(/-/g, ' '), u: pre(l) + t.id + '/', i: t.icon, c: catOf(t.cat).color }; });
  const usedIcons = {}; TOOLS.forEach(t => usedIcons[t.icon] = ICONS[t.icon]);
  for (const k of ['upload', 'download', 'copy', 'trash', 'x', 'up', 'down', 'plus', 'play', 'pause', 'stop', 'rotate', 'flip', 'convert', 'braces', 'compress', 'dice', 'monitor', 'mic', 'sun', 'moon', 'check', 'search']) usedIcons[k] = ICONS[k];
  write(`assets/i18n/${l}.js`, `window.L=${JSON.stringify(ui)};window.IDX=${JSON.stringify(idx)};window.ICONS=${JSON.stringify(usedIcons)};`);

  write(pre(l) + 'index.html', homePage(l)); add([l, '']);
  for (const t of TOOLS) { write(pre(l) + t.id + '/index.html', toolPage(l, t)); add([l, t.id + '/']); }
  for (const c of CATS) { write(pre(l) + `category/${c.id}/index.html`, catPage(l, c)); add([l, `category/${c.id}/`]); }
  for (const k of ['about', 'privacy', 'terms', 'contact']) { write(pre(l) + k + '/index.html', staticPage(l, k)); if (l === l) add([l, k + '/']); }
}
write('404.html', notFound());

// sitemap with hreflang
const today = new Date().toISOString().slice(0, 10);
const seen = new Set();
let sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
for (const [l, p] of urls) {
  const u = url(l, p); if (seen.has(u)) continue; seen.add(u);
  sm += `<url><loc>${u}</loc><lastmod>${today}</lastmod>${LANGS.map(x => `<xhtml:link rel="alternate" hreflang="${x}" href="${url(x, p)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${url(DEF, p)}"/></url>\n`;
}
sm += '</urlset>\n';
write('sitemap.xml', sm);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
if (ADS) write('ads.txt', `google.com, ${CFG.adsenseClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);
if (CFG.customDomain) write('CNAME', CFG.customDomain + '\n');
write('.nojekyll', '');
console.log(`Built ${urls.length} pages in ${LANGS.length} languages, ${TOOLS.length} tools -> ${path.relative(process.cwd(), OUT) || OUT}`);

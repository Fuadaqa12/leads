// Screenshots + Gumroad cover for every built template:  node shots.js [slug]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const only = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const slugs = fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, 'site', 'index.html')) && (!only || d === only));
  for (const slug of slugs) {
    const out = path.join(DIST, slug, 'shots');
    fs.mkdirSync(out, { recursive: true });
    const url = 'file://' + path.join(DIST, slug, 'site', 'index.html');
    const reveal = () => { document.querySelectorAll('.reveal').forEach(el => el.classList.add('in')); document.querySelectorAll('.map').forEach(m => { m.innerHTML = '<div style="width:100%;height:100%;display:grid;place-items:center;background:repeating-linear-gradient(0deg,var(--line) 0 1px,transparent 1px 48px),repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px 48px),var(--bg2);color:var(--accent);font-weight:600">📍 Your location map</div>'; }); };

    // desktop: hero + full page
    const d = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await d.goto(url, { waitUntil: 'networkidle' });
    await d.evaluate(reveal); await d.addStyleTag({ content: '.reveal{transition:none!important}' });
    await d.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await d.waitForTimeout(2500); await d.evaluate(() => window.scrollTo(0, 0)); await d.waitForTimeout(400);
    await d.screenshot({ path: path.join(out, 'desktop-hero.png') });
    await d.screenshot({ path: path.join(out, 'desktop-full.png'), fullPage: true });
    // a few section shots for the gallery
    for (const sel of ['#services', '#menu', '#about', '#gallery', '#plans', '#contact', '#work', '#features']) {
      const el = await d.$(sel);
      if (el) {
        await el.scrollIntoViewIfNeeded();
        await d.waitForTimeout(150);
        await el.screenshot({ path: path.join(out, `section-${sel.slice(1)}.png`) });
      }
    }
    await d.close();

    // phone
    const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    await m.goto(url, { waitUntil: 'networkidle' });
    await m.evaluate(reveal); await m.addStyleTag({ content: '.reveal{transition:none!important}' });
    await m.waitForTimeout(300);
    await m.screenshot({ path: path.join(out, 'phone.png') });
    await m.close();

    // cover 1280x720: desktop frame + phone frame
    const b64 = f => fs.readFileSync(path.join(out, f)).toString('base64');
    const css = fs.readFileSync(path.join(DIST, slug, 'site', 'assets', 'css', 'style.css'), 'utf8');
    const pick = n => (css.match(new RegExp('--' + n + ':([^;]+);')) || [])[1];
    const bullets = JSON.parse(fs.readFileSync(path.join(DIST, slug, 'meta.json'), 'utf8')).bullets;
    const title = fs.readFileSync(path.join(DIST, slug, 'listing.md'), 'utf8').split('\n')[0].replace('# ', '');
    const [name, rest] = title.split(': ');
    const c = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    await c.setContent(`<html><body style="margin:0;width:1280px;height:720px;overflow:hidden;font-family:Inter,system-ui,sans-serif;
      background:radial-gradient(circle at 80% 20%, ${pick('accent2')}55, transparent 50%), linear-gradient(135deg, ${pick('bg2')}, ${pick('bg')});color:${pick('text')}">
      <div style="position:absolute;left:64px;top:84px;width:420px">
        <div style="font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:${pick('accent')};font-weight:700">HTML Website Template</div>
        <div style="font-size:84px;font-weight:800;line-height:1;margin:18px 0 14px">${name}</div>
        <div style="font-size:26px;line-height:1.3;opacity:.85">${rest.replace(' Website Template (HTML, Responsive)', '')}</div>
        <div style="margin-top:34px;display:grid;gap:10px;font-size:18px;opacity:.85">
          ${bullets.map(b => '<div>✓ ' + b + '</div>').join('')}</div>
      </div>
      <div style="position:absolute;left:500px;top:80px;width:700px;border-radius:14px;overflow:hidden;box-shadow:0 40px 80px -20px #0008;border:1px solid #fff2">
        <div style="height:28px;background:#1d1d1f;display:flex;gap:7px;align-items:center;padding-left:14px">
          <i style="width:11px;height:11px;border-radius:50%;background:#ff5f57"></i><i style="width:11px;height:11px;border-radius:50%;background:#febc2e"></i><i style="width:11px;height:11px;border-radius:50%;background:#28c840"></i></div>
        <img src="data:image/png;base64,${b64('desktop-hero.png')}" style="width:100%;display:block"></div>
      <div style="position:absolute;left:1065px;top:290px;width:180px;border-radius:30px;overflow:hidden;border:8px solid #111;box-shadow:0 40px 80px -20px #000a">
        <img src="data:image/png;base64,${b64('phone.png')}" style="width:100%;display:block"></div>
      </body></html>`);
    await c.waitForTimeout(300);
    await c.screenshot({ path: path.join(out, 'cover.png') });
    await c.close();
    console.log('shots:', slug);
  }
  await browser.close();
})();

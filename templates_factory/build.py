"""
Template factory: builds sellable website templates from niches.py.

  python3 build.py            -> dist/<slug>/site/ (the template), dist/<slug>/<slug>.zip,
                                 dist/<slug>/listing.md (title, description, tags, price)
  node shots.js               -> screenshots + Gumroad cover for every template

No third-party images: all artwork is generated SVG, fonts are Google Fonts (SIL OFL).
"""

import html
import os
import random
import shutil
import sys
import zipfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from demo_site import ICONS  # noqa: E402  (shared icon set, MIT-style line icons drawn by us)
from niches import NICHES, STYLES  # noqa: E402

ICONS = dict(ICONS)
ICONS["smile"] = '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>'
ICONS["menu"] = '<path d="M3 6h18M3 12h18M3 18h18"/>'
ICONS["mail"] = '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>'
ICONS["insta"] = '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>'
ICONS["fb"] = '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>'

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
VERSION = "1.0.0"
PRICE = 14
BUNDLE_PRICE = 39
e = html.escape


def svg(name, cls="i"):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


# ---------- generated artwork (placeholders the buyer replaces with own photos) ----------

def art(S, icon, seed, w=800, h=600, label=""):
    r = random.Random(seed)
    a, a2, bg, bg2 = S["accent"], S["accent2"], S["bg2"], S["card"]
    shapes = []
    for _ in range(5):
        cx, cy, rad = r.randint(0, w), r.randint(0, h), r.randint(w // 8, w // 2)
        shapes.append(f'<circle cx="{cx}" cy="{cy}" r="{rad}" fill="url(#g{seed})" opacity="{r.uniform(.10, .30):.2f}"/>')
    for _ in range(3):
        x, y = r.randint(0, w), r.randint(0, h)
        shapes.append(f'<circle cx="{x}" cy="{y}" r="{r.randint(30, 110)}" fill="none" stroke="{a2}" '
                      f'stroke-opacity=".35" stroke-width="1.5"/>')
    dots = "".join(f'<circle cx="{x}" cy="{y}" r="1.6" fill="{a}" opacity=".35"/>'
                   for x in range(40, w, 40) for y in range(40, h, 40) if r.random() < .18)
    s = min(w, h) * .32
    ix, iy = (w - s) / 2, (h - s) / 2
    lab = (f'<text x="{w/2}" y="{h-34}" text-anchor="middle" font-family="sans-serif" font-size="{max(14, w//40)}" '
           f'letter-spacing="3" fill="{S["muted"]}">{e(label.upper())}</text>') if label else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice">'
            f'<defs><linearGradient id="b{seed}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg2}"/>'
            f'<stop offset="1" stop-color="{bg}"/></linearGradient>'
            f'<radialGradient id="g{seed}"><stop offset="0" stop-color="{a2}"/><stop offset="1" stop-color="{a}" stop-opacity="0"/></radialGradient></defs>'
            f'<rect width="{w}" height="{h}" fill="url(#b{seed})"/>{"".join(shapes)}{dots}'
            f'<g transform="translate({ix:.0f} {iy:.0f}) scale({s/24:.2f})" fill="none" stroke="{a}" stroke-width="1.1" '
            f'stroke-linecap="round" stroke-linejoin="round" opacity=".9">{ICONS[icon]}</g>{lab}</svg>')


# ---------- CSS ----------

def css(S):
    up = "text-transform:uppercase;letter-spacing:.02em;" if S["upper"] else ""
    return f""":root{{
  --bg:{S['bg']};--bg2:{S['bg2']};--card:{S['card']};--line:{S['line']};--text:{S['text']};
  --muted:{S['muted']};--accent:{S['accent']};--accent2:{S['accent2']};--on:{S['on']};
  --display:'{S['display']}',Georgia,serif;--sans:'{S['sans']}',system-ui,-apple-system,sans-serif;
  --radius:18px;--max:1180px;
}}
*{{box-sizing:border-box;margin:0;padding:0}}
html{{scroll-behavior:smooth}}
body{{font-family:var(--sans);background:var(--bg);color:var(--text);line-height:1.65;font-size:16px;-webkit-font-smoothing:antialiased}}
img,svg{{display:block;max-width:100%}}
a{{color:inherit;text-decoration:none}}
.wrap{{max-width:var(--max);margin:0 auto;padding:0 24px}}
h1,h2,h3{{font-family:var(--display);font-weight:{S['dw']};line-height:1.1;{up}}}
h1{{font-size:clamp(40px,7vw,84px)}}
h2{{font-size:clamp(32px,4.4vw,54px);margin-bottom:14px}}
h3{{font-size:22px;margin-bottom:6px}}
.eyebrow{{display:inline-flex;align-items:center;gap:10px;font-size:13px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:16px}}
.eyebrow::before{{content:"";width:28px;height:1px;background:currentColor}}
.lead{{color:var(--muted);font-size:18px;max-width:620px}}
.i{{width:22px;height:22px}}
section{{padding:110px 0}}
.alt{{background:var(--bg2)}}
.head{{max-width:680px;margin-bottom:56px}}
.center{{text-align:center;margin-left:auto;margin-right:auto}}
.center .eyebrow{{justify-content:center}}
.center .lead{{margin:0 auto}}

/* buttons */
.btn{{display:inline-flex;align-items:center;gap:10px;padding:15px 28px;border-radius:999px;font-weight:600;font-size:15px;border:1px solid transparent;transition:.25s;cursor:pointer;font-family:var(--sans)}}
.btn .i{{width:18px;height:18px}}
.btn-primary{{background:var(--accent);color:var(--on)}}
.btn-primary:hover{{background:var(--accent2);transform:translateY(-2px)}}
.btn-ghost{{border-color:var(--line);color:var(--text)}}
.btn-ghost:hover{{border-color:var(--accent);color:var(--accent)}}

/* nav */
.nav{{position:fixed;inset:0 0 auto 0;z-index:50;transition:.3s}}
.nav.scrolled{{background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}}
.nav .wrap{{display:flex;align-items:center;justify-content:space-between;height:78px}}
.logo{{display:flex;align-items:center;gap:10px;font-family:var(--display);font-size:24px;font-weight:{S['dw']};{up}}}
.logo .mark{{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--on)}}
.logo .mark .i{{width:20px;height:20px}}
.links{{display:flex;gap:34px;font-size:15px}}
.links a{{color:var(--muted);transition:.2s}}
.links a:hover{{color:var(--text)}}
.burger{{display:none;background:none;border:0;color:var(--text);cursor:pointer}}
.burger .i{{width:28px;height:28px}}

/* hero */
.hero{{position:relative;min-height:100vh;display:flex;align-items:center;padding:140px 0 90px;overflow:hidden}}
.hero .lead{{margin:22px 0 36px}}
.hero .btns{{display:flex;gap:14px;flex-wrap:wrap}}
.hero-split .wrap{{display:grid;grid-template-columns:1.05fr .95fr;gap:64px;align-items:center}}
.hero-art{{position:relative;aspect-ratio:4/5;border-radius:220px 220px var(--radius) var(--radius);overflow:hidden;border:1px solid var(--line)}}
.hero-art svg{{width:100%;height:100%}}
.float{{position:absolute;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 18px;display:flex;gap:12px;align-items:center;box-shadow:0 20px 50px -20px #0005;font-size:14px}}
.float b{{display:block;font-size:20px;font-family:var(--display)}}
.float .i{{color:var(--accent)}}
.f1{{left:-28px;bottom:70px}} .f2{{right:-18px;top:60px}}
.hero-center{{text-align:center}}
.hero-center .bgart{{position:absolute;inset:0;opacity:.35}}
.hero-center .bgart svg{{width:100%;height:100%}}
.hero-center::after{{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 0,var(--bg) 75%)}}
.hero-center .wrap{{position:relative;z-index:2}}
.hero-center .lead{{margin:22px auto 36px}}
.hero-center .btns,.hero-center .eyebrow{{justify-content:center}}
.hero-editorial{{flex-direction:column;align-items:stretch;justify-content:center}}
.hero-editorial h1{{font-size:clamp(46px,9vw,124px);max-width:1000px}}
.hero-editorial .row{{display:flex;justify-content:space-between;align-items:flex-end;gap:40px;flex-wrap:wrap}}
.strip{{display:grid;grid-template-columns:2fr 1fr 1fr;gap:18px;margin-top:56px;height:280px}}
.strip div{{border-radius:var(--radius);overflow:hidden;border:1px solid var(--line)}}
.strip svg{{width:100%;height:100%}}

/* stats */
.stats{{border-block:1px solid var(--line);padding:42px 0}}
.stats .wrap{{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}}
.stat b{{display:block;font-family:var(--display);font-size:44px;color:var(--accent);line-height:1}}
.stat span{{color:var(--muted);font-size:14px}}

/* cards */
.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}}
.grid.g4{{grid-template-columns:repeat(4,1fr)}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:32px;transition:.3s;position:relative}}
.card:hover{{transform:translateY(-6px);border-color:var(--accent)}}
.card .ic{{width:54px;height:54px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);margin-bottom:22px}}
.card p{{color:var(--muted);font-size:15px}}
.price{{display:flex;justify-content:space-between;align-items:baseline;margin-top:22px;padding-top:18px;border-top:1px dashed var(--line);font-size:14px;color:var(--muted)}}
.price b{{font-family:var(--display);font-size:26px;color:var(--text)}}

/* menu */
.tabs{{display:flex;gap:10px;justify-content:center;margin-bottom:44px;flex-wrap:wrap}}
.tab{{padding:10px 24px;border-radius:999px;border:1px solid var(--line);background:none;color:var(--muted);cursor:pointer;font:inherit}}
.tab.on{{background:var(--accent);color:var(--on);border-color:var(--accent)}}
.menu-list{{display:none;grid-template-columns:1fr 1fr;gap:10px 60px;max-width:960px;margin:0 auto}}
.menu-list.on{{display:grid}}
.dish{{display:flex;gap:16px;align-items:baseline;padding:18px 0;border-bottom:1px solid var(--line)}}
.dish h3{{font-size:21px;margin:0}}
.dish p{{color:var(--muted);font-size:14px}}
.dish .dots{{flex:1;border-bottom:1px dotted var(--line);transform:translateY(-6px)}}
.dish b{{font-family:var(--display);font-size:22px;color:var(--accent)}}

/* about */
.about{{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}}
.about .pic{{border-radius:var(--radius);overflow:hidden;aspect-ratio:1;border:1px solid var(--line);position:relative}}
.about .pic svg{{width:100%;height:100%}}
.badge{{position:absolute;right:22px;bottom:22px;background:var(--accent);color:var(--on);border-radius:50%;width:120px;height:120px;display:grid;place-items:center;text-align:center;font-size:13px;line-height:1.2}}
.badge b{{display:block;font-family:var(--display);font-size:34px}}
.checks{{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:30px 0 36px}}
.checks li{{display:flex;gap:10px;align-items:center;font-size:15px}}
.checks .i{{color:var(--accent);width:20px;height:20px;flex:none}}

/* steps */
.steps{{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;counter-reset:s}}
.step{{padding:34px;border-radius:var(--radius);border:1px solid var(--line);position:relative}}
.step::before{{counter-increment:s;content:"0" counter(s);font-family:var(--display);font-size:56px;color:var(--accent);opacity:.35;display:block;line-height:1;margin-bottom:18px}}
.step p{{color:var(--muted)}}

/* gallery */
.gallery{{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:220px;gap:16px}}
.gallery div{{border-radius:var(--radius);overflow:hidden;border:1px solid var(--line)}}
.gallery div:nth-child(1){{grid-column:span 2;grid-row:span 2}}
.gallery div:nth-child(4),.gallery div:nth-child(6){{grid-column:span 2}}
.gallery svg{{width:100%;height:100%;transition:transform .6s}}
.gallery div:hover svg{{transform:scale(1.06)}}

/* plans */
.plans{{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:center}}
.plan{{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:40px 34px}}
.plan.hot{{border-color:var(--accent);box-shadow:0 30px 60px -30px color-mix(in srgb,var(--accent) 60%,transparent);padding:52px 34px}}
.plan .amt{{font-family:var(--display);font-size:52px;line-height:1;margin:14px 0 24px}}
.plan .amt small{{font-size:16px;color:var(--muted);font-family:var(--sans)}}
.plan ul{{list-style:none;margin-bottom:30px}}
.plan li{{display:flex;gap:10px;padding:8px 0;color:var(--muted);font-size:15px}}
.plan li .i{{color:var(--accent);width:18px;height:18px;flex:none;margin-top:3px}}
.plan .btn{{width:100%;justify-content:center}}

/* team */
.team{{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}}
.member .ph{{aspect-ratio:4/5;border-radius:var(--radius);overflow:hidden;border:1px solid var(--line);margin-bottom:18px}}
.member .ph svg{{width:100%;height:100%}}
.member p{{color:var(--muted);font-size:14px}}

/* reviews */
.reviews{{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}}
.review{{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:34px}}
.stars{{display:flex;gap:3px;color:var(--accent);margin-bottom:18px}}
.stars .i{{width:18px;height:18px;fill:currentColor}}
.review q{{font-family:var(--display);font-size:22px;line-height:1.4;display:block;margin-bottom:22px;quotes:none}}
.review span{{color:var(--muted);font-size:14px}}

/* faq */
.faq{{max-width:820px;margin:0 auto}}
.faq details{{border-bottom:1px solid var(--line);padding:24px 0}}
.faq summary{{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:20px;font-size:19px;font-weight:600}}
.faq summary::-webkit-details-marker{{display:none}}
.faq summary .i{{transition:.3s;color:var(--accent);flex:none}}
.faq details[open] summary .i{{transform:rotate(45deg)}}
.faq details p{{color:var(--muted);margin-top:12px;max-width:680px}}

/* contact */
.contact{{display:grid;grid-template-columns:1fr 1.1fr;gap:40px}}
.info{{display:grid;gap:16px;align-content:start}}
.info .row{{display:flex;gap:16px;padding:22px;border:1px solid var(--line);border-radius:var(--radius);background:var(--card)}}
.info .row .i{{color:var(--accent);flex:none;margin-top:3px}}
.info .row small{{display:block;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.12em}}
.hours div{{display:flex;justify-content:space-between;gap:20px}}
form{{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:38px;display:grid;gap:16px;grid-template-columns:1fr 1fr}}
form .full{{grid-column:1/-1}}
label{{font-size:13px;color:var(--muted);display:grid;gap:6px}}
input,select,textarea{{font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:13px 14px;width:100%}}
input:focus,select:focus,textarea:focus{{outline:none;border-color:var(--accent)}}
textarea{{min-height:110px;resize:vertical}}
.map{{margin-top:40px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--line);height:340px}}
.map iframe{{width:100%;height:100%;border:0;{"filter:invert(.9) hue-rotate(180deg) grayscale(.4);" if S['dark'] else ""}}}

/* cta + footer */
.cta{{text-align:center;padding:90px 24px;border-radius:28px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:var(--on)}}
.cta h2{{margin-bottom:12px}}
.cta p{{opacity:.85;margin-bottom:30px}}
.cta .btn{{background:var(--on);color:var(--accent)}}
footer{{padding:70px 0 34px;border-top:1px solid var(--line);margin-top:110px}}
footer .cols{{display:grid;grid-template-columns:2fr 1fr 1fr;gap:40px;margin-bottom:50px}}
footer p,footer a{{color:var(--muted);font-size:15px}}
footer h4{{font-size:14px;text-transform:uppercase;letter-spacing:.14em;margin-bottom:16px}}
footer .list{{display:grid;gap:10px}}
.social{{display:flex;gap:10px;margin-top:20px}}
.social a{{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center}}
.social a:hover{{border-color:var(--accent);color:var(--accent)}}
.social .i{{width:18px;height:18px}}
.copy{{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;font-size:13px;color:var(--muted);padding-top:26px;border-top:1px solid var(--line)}}
.fab{{position:fixed;right:22px;bottom:22px;z-index:40;width:58px;height:58px;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;box-shadow:0 14px 30px -10px #25d366aa}}
.fab .i{{width:28px;height:28px}}

/* reveal */
.reveal{{opacity:0;transform:translateY(30px);transition:opacity .8s,transform .8s}}
.reveal.in{{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){{.reveal{{opacity:1;transform:none}}html{{scroll-behavior:auto}}}}

/* responsive */
@media (max-width:980px){{
  section{{padding:80px 0}}
  .hero-split .wrap,.about,.contact{{grid-template-columns:1fr;gap:48px}}
  .hero-art{{max-width:440px;width:100%;margin:0 auto}}
  .stats .wrap{{grid-template-columns:repeat(2,1fr)}}
  .steps,.plans,.team,.reviews{{grid-template-columns:1fr}}
  .grid,.grid.g4{{grid-template-columns:1fr 1fr}}
  .plan.hot{{padding:40px 34px}}
  .gallery{{grid-template-columns:repeat(2,1fr);grid-auto-rows:170px}}
  .menu-list{{grid-template-columns:1fr}}
  footer .cols{{grid-template-columns:1fr 1fr}}
  footer .cols>div:first-child{{grid-column:1/-1}}
  .links{{position:fixed;inset:78px 0 auto 0;flex-direction:column;gap:0;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 24px 24px;display:none}}
  .links a{{padding:14px 0;border-bottom:1px solid var(--line);font-size:17px}}
  .links.open{{display:flex}}
  .burger{{display:block}}
  .nav .btn-primary{{display:none}}
}}
@media (max-width:600px){{
  .wrap{{padding:0 18px}}
  .strip{{grid-template-columns:1fr 1fr;height:200px}}
  .strip div:first-child{{grid-column:1/-1}}
  .checks,form,.grid,.grid.g4{{grid-template-columns:1fr}}
  form{{padding:26px}}
  .f1{{left:8px}} .f2{{right:8px}}
  .stat b{{font-size:34px}}
}}
"""


JS = r"""/* ============ EDIT YOUR CONTACT SETTINGS HERE ============ */
const CONFIG = {
  // Where booking requests go: "whatsapp" or "email"
  mode: "whatsapp",
  whatsapp: "15551234567",          // international format, digits only
  email: "hello@example.com",
};
/* ========================================================= */

// sticky nav
const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll); onScroll();

// mobile menu
const links = document.querySelector('.links');
document.querySelector('.burger').addEventListener('click', () => links.classList.toggle('open'));
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));

// reveal on scroll
const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// menu tabs
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab, .menu-list').forEach(x => x.classList.remove('on'));
  t.classList.add('on');
  document.getElementById(t.dataset.tab).classList.add('on');
}));

// booking form -> WhatsApp or e-mail
const form = document.getElementById('booking');
if (form) form.addEventListener('submit', ev => {
  ev.preventDefault();
  const d = new FormData(form);
  const lines = [...d.entries()].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const text = `New request from the website\n${lines.join('\n')}`;
  const url = CONFIG.mode === 'email'
    ? `mailto:${CONFIG.email}?subject=${encodeURIComponent('Website request')}&body=${encodeURIComponent(text)}`
    : `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
});

document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
"""


# ---------- HTML ----------

def page(N):
    S = STYLES[N["style"]]
    cur = N["currency"]
    brand = e(N["brand"])
    img = lambda name: f'<img src="assets/img/{name}.svg" alt="" style="width:100%;height:100%;object-fit:cover">'
    nav_items = [("services", "Services" if not N["menu"] else "About")]
    if N["menu"]:
        nav_items = [("menu", "Menu"), ("about", "About")]
    else:
        nav_items = [("services", "Services"), ("about", "About")]
    if N["plans"]:
        nav_items.append(("plans", "Plans"))
    nav_items += ([("team", "Team")] if N["team"] else []) + [("faq", "FAQ"), ("contact", "Contact")]
    if N.get("gallery_title"):
        nav_items.insert(1, ("gallery", "Work"))
    links = "".join(f'<a href="#{i}">{t}</a>' for i, t in nav_items)

    # hero
    eyebrow = f'<span class="eyebrow">{e(N["kind"])}</span>'
    btns = (f'<div class="btns"><a class="btn btn-primary" href="#contact">{e(N["cta"])} {svg("arrow")}</a>'
            f'<a class="btn btn-ghost" href="#{"menu" if N["menu"] else "services"}">{e(N["cta2"])}</a></div>')
    h1 = f'<h1>{e(N["headline"])}</h1><p class="lead">{e(N["sub"])}</p>'
    fl = N.get("floats") or [("star", N["stats"][-1][0] if "rating" in N["stats"][-1][1].lower() else "4.9", "Rated by clients"),
                             ("calendar", "Online", "Booking 24/7")]
    if N["hero"] == "split":
        hero = (f'<header class="hero hero-split"><div class="wrap"><div class="reveal">{eyebrow}{h1}{btns}</div>'
                f'<div class="reveal" style="position:relative"><div class="hero-art">{img("hero")}</div>'
                f'<div class="float f1">{svg(fl[0][0])}<div><b>{e(fl[0][1])}</b>{e(fl[0][2])}</div></div>'
                f'<div class="float f2">{svg(fl[1][0])}<div><b>{e(fl[1][1])}</b>{e(fl[1][2])}</div></div></div></div></header>')
    elif N["hero"] == "center":
        hero = (f'<header class="hero hero-center"><div class="bgart">{img("hero")}</div>'
                f'<div class="wrap reveal">{eyebrow}{h1}{btns}</div></header>')
    else:
        hero = (f'<header class="hero hero-editorial"><div class="wrap reveal">{eyebrow}<h1>{e(N["headline"])}</h1>'
                f'<div class="row"><p class="lead">{e(N["sub"])}</p>{btns}</div>'
                f'<div class="strip"><div>{img("hero")}</div><div>{img("g2")}</div><div>{img("g3")}</div></div></div></header>')

    stats = "".join(f'<div class="stat reveal"><b>{e(a)}</b><span>{e(b)}</span></div>' for a, b in N["stats"])

    # services
    cards = []
    for s in N["services"]:
        ic, t, d = s[:3]
        pr = ""
        if len(s) > 3:
            val = s[3]
            shown = f"{cur}{val}" if val.replace(",", "").replace(".", "").isdigit() else val
            if val.startswith("From"):
                shown = f"<small>from</small> {cur}{val[5:]}"
            pr = f'<div class="price"><span>Price</span><b>{shown}</b></div>'
        cards.append(f'<div class="card reveal"><div class="ic">{svg(ic)}</div><h3>{e(t)}</h3><p>{e(d)}</p>{pr}</div>')
    services = (f'<section id="services"><div class="wrap"><div class="head reveal"><span class="eyebrow">{e(N["services_title"])}</span>'
                f'<h2>{e(N.get("services_h2", "Everything you need, done properly"))}</h2><p class="lead">{e(N.get("services_lead", "Clear prices, no hidden extras. Replace these with your own services in a minute."))}</p></div>'
                f'<div class="grid{" g4" if len(cards) == 4 else ""}">{"".join(cards)}</div></div></section>')

    menu = ""
    if N["menu"]:
        tabs = "".join(f'<button class="tab{" on" if i == 0 else ""}" data-tab="m{i}">{e(c)}</button>' for i, (c, _) in enumerate(N["menu"]))
        lists = "".join(
            f'<div class="menu-list{" on" if i == 0 else ""}" id="m{i}">' +
            "".join(f'<div class="dish"><div><h3>{e(n)}</h3><p>{e(d)}</p></div><span class="dots"></span><b>{cur}{p}</b></div>' for n, d, p in items) +
            "</div>" for i, (_, items) in enumerate(N["menu"]))
        menu = (f'<section id="menu" class="alt"><div class="wrap"><div class="head center reveal"><span class="eyebrow">Our menu</span>'
                f'<h2>Made fresh, every day</h2></div><div class="tabs">{tabs}</div>{lists}</div></section>')

    checks = "".join(f'<li>{svg("check")}{e(c)}</li>' for c in N["checks"])
    about = (f'<section id="about" class="{"" if N["menu"] else "alt"}"><div class="wrap about"><div class="pic reveal">{img("about")}'
             f'<div class="badge"><div><b>{e(N["stats"][0][0])}</b>{e(N["stats"][0][1])}</div></div></div>'
             f'<div class="reveal"><span class="eyebrow">About us</span><h2>{e(N["about_title"])}</h2><p class="lead">{e(N["about"])}</p>'
             f'<ul class="checks">{checks}</ul><a class="btn btn-primary" href="#contact">{e(N["cta"])} {svg("arrow")}</a></div></div></section>')

    steps = ""
    if N["steps"]:
        steps = (f'<section><div class="wrap"><div class="head center reveal"><span class="eyebrow">How it works</span><h2>Three simple steps</h2></div>'
                 f'<div class="steps">' + "".join(f'<div class="step reveal"><h3>{e(t)}</h3><p>{e(d)}</p></div>' for t, d in N["steps"]) + '</div></div></section>')

    gallery = (f'<section id="gallery" class="{"alt" if N["steps"] else ""}"><div class="wrap"><div class="head reveal"><span class="eyebrow">{e(N.get("gallery_eyebrow", "Gallery"))}</span><h2>{e(N.get("gallery_title", "A look inside"))}</h2></div>'
               f'<div class="gallery">' + "".join(f'<div class="reveal">{img(f"g{i}")}</div>' for i in range(1, 7)) + '</div></div></section>')

    plans = ""
    if N["plans"]:
        pc = []
        for i, (t, p, feats) in enumerate(N["plans"]):
            li = "".join(f'<li>{svg("check")}{e(f)}</li>' for f in feats)
            hot = i == 1
            pc.append(f'<div class="plan reveal{" hot" if hot else ""}"><span class="eyebrow">{e(t)}</span><div class="amt">{cur}{p}<small> / month</small></div>'
                      f'<ul>{li}</ul><a class="btn {"btn-primary" if hot else "btn-ghost"}" href="#contact">Choose {e(t)}</a></div>')
        plans = (f'<section id="plans"><div class="wrap"><div class="head center reveal"><span class="eyebrow">Membership</span><h2>Simple monthly plans</h2>'
                 f'<p class="lead">Save on regular care. Cancel any time.</p></div><div class="plans">{"".join(pc)}</div></div></section>')

    team = "" if not N["team"] else (f'<section id="team" class="{"alt" if N["plans"] else ""}"><div class="wrap"><div class="head reveal"><span class="eyebrow">Our team</span><h2>The people behind it</h2></div>'
            f'<div class="team">' + "".join(f'<div class="member reveal"><div class="ph">{img(f"t{i}")}</div><h3>{e(n)}</h3><p>{e(r)}</p></div>' for i, (n, r) in enumerate(N["team"], 1)) +
            '</div></div></section>')

    stars = "".join(svg("star") for _ in range(5))
    reviews = (f'<section><div class="wrap"><div class="head center reveal"><span class="eyebrow">Reviews</span><h2>What clients say</h2></div><div class="reviews">' +
               "".join(f'<div class="review reveal"><div class="stars">{stars}</div><q>{e(q)}</q><span>{e(a)}</span></div>' for q, a in N["reviews"]) +
               '</div></div></section>')

    faq = (f'<section id="faq" class="alt"><div class="wrap"><div class="head center reveal"><span class="eyebrow">FAQ</span><h2>Good questions</h2></div><div class="faq">' +
           "".join(f'<details class="reveal"><summary>{e(q)}{svg("plus")}</summary><p>{e(a)}</p></details>' for q, a in N["faq"]) +
           '</div></div></section>')

    hours = "".join(f'<div><span>{e(d)}</span><span>{e(h)}</span></div>' for d, h in N["hours"])
    opts = "".join(f'<option>{e(s)}</option>' for s in N["service_names"])
    labels = N.get("labels", {})
    if N["form_kind"] == "table":
        extra = ('<label>Guests<select name="Guests"><option>2</option><option>3</option><option>4</option><option>5-8</option><option>9+</option></select></label>')
    else:
        extra = '<label>Time<input type="time" name="Time"></label>'
    if N["form_kind"] == "project":
        extra = '<label>Budget<select name="Budget"><option>Under $2k</option><option>$2k – $5k</option><option>$5k – $10k</option><option>$10k+</option></select></label>'
    contact = (f'<section id="contact"><div class="wrap"><div class="head reveal"><span class="eyebrow">Contact</span><h2>{e(N["cta"])}</h2>'
               f'<p class="lead">{e(N.get("contact_lead", "Send a request and we will confirm within the hour."))}</p></div><div class="contact">'
               f'<div class="info reveal"><div class="row">{svg("pin")}<div><small>Address</small>221 Market Street, Springfield</div></div>'
               f'<div class="row">{svg("phone")}<div><small>Phone</small><a href="tel:+15551234567">+1 (555) 123-4567</a></div></div>'
               f'<div class="row">{svg("mail")}<div><small>E-mail</small><a href="mailto:hello@example.com">hello@example.com</a></div></div>'
               f'<div class="row">{svg("clock")}<div style="flex:1"><small>{e(labels.get("hours", "Opening hours"))}</small><div class="hours">{hours}</div></div></div></div>'
               f'<form id="booking" class="reveal"><label>Name<input name="Name" required placeholder="Your name"></label>'
               f'<label>Phone<input name="Phone" type="tel" required placeholder="+1 555 000 0000"></label>'
               f'<label>{e(labels.get("service", "Occasion" if N["form_kind"] == "table" else "Service"))}<select name="Service">{opts}</select></label>'
               f'{"" if N["form_kind"] == "project" else '<label>Date<input type="date" name="Date"></label>'}{extra}<label class="full">Message<textarea name="Message" placeholder="Anything we should know?"></textarea></label>'
               f'<button class="btn btn-primary full" type="submit">Send request {svg("arrow")}</button></form></div>'
               f'<div class="map reveal"><iframe title="Map" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=-0.135%2C51.505%2C-0.115%2C51.515&amp;layer=mapnik"></iframe></div></div></section>')

    cta = (f'<div class="wrap reveal"><div class="cta"><h2>Ready when you are</h2><p>{e(N["sub"])}</p>'
           f'<a class="btn" href="#contact">{e(N["cta"])} {svg("arrow")}</a></div></div>')

    footer = (f'<footer><div class="wrap"><div class="cols"><div><a class="logo" href="#"><span class="mark">{svg(N["icon"])}</span>{brand}</a>'
              f'<p style="margin-top:16px;max-width:340px">{e(N["sub"])}</p><div class="social"><a href="#" aria-label="Instagram">{svg("insta")}</a>'
              f'<a href="#" aria-label="Facebook">{svg("fb")}</a><a href="#" aria-label="WhatsApp">{svg("wa")}</a></div></div>'
              f'<div><h4>Explore</h4><div class="list">{links}</div></div>'
              f'<div><h4>Visit</h4><div class="list"><p>221 Market Street<br>Springfield</p><a href="tel:+15551234567">+1 (555) 123-4567</a><a href="mailto:hello@example.com">hello@example.com</a></div></div></div>'
              f'<div class="copy"><span>© <span data-year></span> {brand}. All rights reserved.</span><span>Made with care</span></div></div></footer>')

    fonts = "family=" + S["display"].replace(" ", "+") + ":wght@400;500;600;700&family=" + S["sans"].replace(" ", "+") + ":wght@400;500;600;700"
    ld = ('{"@context":"https://schema.org","@type":"LocalBusiness","name":"%s","telephone":"+15551234567",'
          '"address":{"@type":"PostalAddress","streetAddress":"221 Market Street","addressLocality":"Springfield"}}' % N["brand"].replace('"', ''))
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{brand} | {e(N["kind"])}</title>
<meta name="description" content="{e(N["sub"])}">
<meta property="og:title" content="{brand}">
<meta property="og:description" content="{e(N["sub"])}">
<meta name="theme-color" content="{S['bg']}">
<link rel="icon" href="assets/img/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?{fonts}&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
<script type="application/ld+json">{ld}</script>
</head>
<body>
<!-- ===== NAVIGATION ===== -->
<nav class="nav"><div class="wrap"><a class="logo" href="#"><span class="mark">{svg(N["icon"])}</span>{brand}</a>
<div class="links">{links}</div><a class="btn btn-primary" href="#contact">{e(N["cta"])}</a>
<button class="burger" aria-label="Menu">{svg("menu")}</button></div></nav>

<!-- ===== HERO ===== -->
{hero}
<!-- ===== STATS ===== -->
<div class="stats"><div class="wrap">{stats}</div></div>
<!-- ===== MENU / SERVICES ===== -->
{menu}
{services}
<!-- ===== ABOUT ===== -->
{about}
{steps}
<!-- ===== GALLERY ===== -->
{gallery}
{plans}
<!-- ===== TEAM ===== -->
{team}
<!-- ===== REVIEWS ===== -->
{reviews}
<!-- ===== FAQ ===== -->
{faq}
<!-- ===== CONTACT & BOOKING ===== -->
{contact}
{cta}
<!-- ===== FOOTER ===== -->
{footer}
{'<a class="fab" href="https://wa.me/15551234567" aria-label="WhatsApp" target="_blank" rel="noopener">' + svg("wa") + '</a>' if N.get("fab", True) else ""}
<script src="assets/js/main.js"></script>
</body>
</html>
"""


README = """# {product} | {kind} Website Template  (v{ver})

Thank you for your purchase! This is a fast, modern, fully responsive one-page website
for a {kind_l}. Plain HTML + CSS + a little JavaScript: no frameworks, no build step.

## What's inside
- `index.html`: the whole website (sections are marked with comments)
- `assets/css/style.css`: all styles. Colors and fonts are at the very top (`:root`)
- `assets/js/main.js`: mobile menu, animations, booking form
- `assets/img/`: placeholder artwork (SVG). Replace with your own photos

## Edit in 5 minutes
1. Open `index.html` in any text editor (VS Code, Notepad++, even Notepad).
2. Replace the business name, texts, prices, address and phone.
3. Booking form: open `assets/js/main.js` and set your WhatsApp number or e-mail in `CONFIG`
   at the top. Requests arrive straight in WhatsApp (or your mail app), no server needed.
4. Colors: change `--accent` and `--accent2` at the top of `style.css`.
5. Photos: put your images into `assets/img/` and change the `src` of the `<img>` tags,
   e.g. `assets/img/hero.svg` -> `assets/img/hero.jpg`.
6. Map: on openstreetmap.org (or Google Maps) find your address, click Share -> Embed,
   and paste the link into the `<iframe>` in the contact section.

## Publish for free
- **Netlify Drop**: go to app.netlify.com/drop and drag this folder onto the page. Done.
- **GitHub Pages**, **Cloudflare Pages** or any normal web hosting also work: upload the files.

## Features
- Responsive: phone, tablet, desktop
- Sticky navigation + mobile menu
- Scroll animations (respect "reduced motion")
- Services with prices{menu_line}{plans_line}
- Gallery, team, reviews, FAQ accordion
- Booking form -> WhatsApp or e-mail
- Floating WhatsApp button
- SEO meta tags + schema.org LocalBusiness
- Clean, commented, easy-to-edit code

## Credits
- Fonts: {display} and {sans} from Google Fonts (SIL Open Font License)
- Icons and artwork: original, included under this template's license
- No third-party photos are included

## Support
Questions? Reply to your purchase e-mail and we'll help.
"""

LICENSE = """{product} Website Template: License

By purchasing this template you get a non-exclusive license to:
- use it to build websites for yourself or for your clients (one end product per license
  for a client; unlimited personal projects),
- modify it in any way.

You may NOT:
- resell, redistribute or share the template files (modified or not) as a template, theme
  or stock item,
- claim the original template as your own work for sale on marketplaces.

The template is provided "as is", without warranty of any kind.
"""


def listing(N):
    feats = ["Fully responsive (phone, tablet, desktop)", N.get("form_feature", "Booking form that sends requests to WhatsApp or e-mail"),
             "Services with prices" + (", tabbed menu" if N["menu"] else "") + (", membership plans" if N["plans"] else ""),
             "Gallery, team, reviews and FAQ sections", "Smooth scroll animations, sticky header, mobile menu",
             "SEO-ready: meta tags + schema.org markup", "Plain HTML/CSS/JS: no frameworks, no build step",
             "Free hosting guide (Netlify Drop, 1 minute)", "Commercial license: use it for your client projects"]
    title = f"{N['product']}: {N['kind']} Website Template (HTML, Responsive)"
    desc = (f"**{title}**\n\n"
            f"A modern, fast one-page website for a {N['kind'].lower()}. Edit the texts, add your photos, "
            f"set your WhatsApp number and you are online today.\n\n"
            "**What you get**\n" + "\n".join(f"- {f}" for f in feats) +
            "\n\n**Easy to edit.** Everything is in one well-commented `index.html`. Colors and fonts live "
            "in a few lines at the top of the stylesheet. A step-by-step README is included.\n\n"
            "**Note:** the demo uses placeholder artwork. Replace it with your own photos (instructions included).\n\n"
            f"**Files:** index.html, CSS, JS, SVG artwork, README, license. Version {VERSION}.")
    return title, desc


def build_one(N):
    S = STYLES[N["style"]]
    out = os.path.join(DIST, N["slug"])
    site = os.path.join(out, "site")
    if os.path.exists(site):
        shutil.rmtree(site)
    for d in ("assets/css", "assets/js", "assets/img"):
        os.makedirs(os.path.join(site, d), exist_ok=True)
    w = lambda p, s: open(os.path.join(site, p), "w", encoding="utf-8").write(s)
    w("index.html", page(N))
    w("assets/css/style.css", css(S))
    w("assets/js/main.js", JS)
    base = sum(map(ord, N["slug"]))
    icons_pool = [N["icon"]] + [s[0] for s in N["services"]]
    w("assets/img/hero.svg", art(S, N["icon"], base, 900, 1100))
    w("assets/img/about.svg", art(S, icons_pool[1], base + 1, 900, 900, "your photo"))
    for i in range(1, 7):
        w(f"assets/img/g{i}.svg", art(S, icons_pool[i % len(icons_pool)], base + 10 + i, 900, 700))
    for i in range(1, 4):
        w(f"assets/img/t{i}.svg", art(S, "users", base + 30 + i, 800, 1000, "team photo"))
    w("assets/img/favicon.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="12" fill="{S["accent"]}"/>'
      f'<g transform="translate(5 5) scale(.58)" fill="none" stroke="{S["on"]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{ICONS[N["icon"]]}</g></svg>')
    w("README.md", README.format(product=N["product"], kind=N["kind"], kind_l=N["kind"].lower(), ver=VERSION,
                                 menu_line=", tabbed menu" if N["menu"] else "", plans_line=", pricing plans" if N["plans"] else "",
                                 display=S["display"], sans=S["sans"]))
    w("LICENSE.txt", LICENSE.format(product=N["product"]))
    import json
    json.dump({"bullets": N.get("bullets", ["Responsive, mobile-first", "Booking to WhatsApp / e-mail", "No code skills needed"])},
              open(os.path.join(out, "meta.json"), "w"))

    zpath = os.path.join(out, f"{N['slug']}-website-template.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(site):
            for f in files:
                full = os.path.join(root, f)
                z.write(full, os.path.join(N["slug"], os.path.relpath(full, site)))

    title, desc = listing(N)
    with open(os.path.join(out, "listing.md"), "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\nPrice: ${PRICE}\n\nTags: {', '.join(N['tags'])}\n\n---\n\n{desc}\n")
    return title


def main():
    os.makedirs(DIST, exist_ok=True)
    for N in NICHES:
        print("built:", build_one(N))
    # bundle
    bz = os.path.join(DIST, "bundle-all-templates.zip")
    with zipfile.ZipFile(bz, "w", zipfile.ZIP_DEFLATED) as z:
        for N in NICHES:
            site = os.path.join(DIST, N["slug"], "site")
            for root, _, files in os.walk(site):
                for f in files:
                    full = os.path.join(root, f)
                    z.write(full, os.path.join(N["slug"], os.path.relpath(full, site)))
    print("bundle:", bz)


if __name__ == "__main__":
    main()

"""
SEO-сборка главной страницы Fuad.studio.

Что делает (запускать после любой правки docs/index.html):
  python seo_build.py
  1) Вписывает тексты прямо в HTML (раньше их вставлял только JavaScript — Google видел пустую страницу).
  2) Делает отдельные страницы /ru/ и /en/ (чтобы находили по запросам «сайт для бизнеса баку» и т.п.).
  3) Заголовки, описания, hreflang, canonical, разметка для Google (услуга + частые вопросы).
  4) sitemap.xml
Источник текстов — объект T внутри docs/index.html.
"""
import html
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "docs")
BASE = "https://fuadaqa12.github.io/leads/"
PHONE = "+994555032748"
LANGS = ["az", "ru", "en"]
URL = {"az": BASE, "ru": BASE + "ru/", "en": BASE + "en/"}

META = {
    "az": dict(
        desc="Bakıda biznes üçün sayt sifarişi: 50 AZN-dən, 1–3 günə hazır. Kafe, salon, bərbərxana, avtoyuma, klinika üçün "
             "mobil sayt — Google xəritə, WhatsApp-a sifariş, AZ/RU/EN. Əvvəlcə pulsuz nümunə.",
        og="Biznesiniz üçün sayt 1–3 günə, 50 AZN-dən. Əvvəlcə pulsuz nümunə — sonra qərar.",
        kw="sayt sifarişi, sayt hazırlanması, Bakıda sayt, biznes üçün sayt, ucuz sayt, landing səhifə, veb sayt düzəltmək",
        locale="az_AZ"),
    "ru": dict(
        desc="Создание сайтов в Баку от 50 AZN за 1–3 дня. Сайт для кафе, салона красоты, барбершопа, автомойки, клиники: "
             "Google Карта, заказы в WhatsApp, AZ/RU/EN. Сначала бесплатный пример.",
        og="Сайт для вашего бизнеса за 1–3 дня, от 50 AZN. Сначала бесплатный пример — потом решение.",
        kw="создание сайтов Баку, сайт для бизнеса Баку, заказать сайт Баку, сделать сайт Азербайджан, лендинг Баку, недорогой сайт",
        locale="ru_RU"),
    "en": dict(
        desc="Website design in Baku from 50 AZN, ready in 1–3 days. Mobile-first sites for cafés, salons, barbershops, car washes "
             "and clinics: Google Maps, WhatsApp orders, AZ/RU/EN. Free preview first.",
        og="A website for your business in 1–3 days, from 50 AZN. Free preview first.",
        kw="website design Baku, web designer Azerbaijan, business website Baku, landing page Baku",
        locale="en_US"),
}


def js_object_to_json(src):
    """Объект T из JS (ключи без кавычек) -> JSON."""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == '"':
            j = i + 1
            while src[j] != '"':
                j += 2 if src[j] == "\\" else 1
            out.append(src[i:j + 1]); i = j + 1
        elif c.isalpha() or c == "_":
            j = i
            while j < n and (src[j].isalnum() or src[j] == "_"):
                j += 1
            out.append('"' + src[i:j] + '"'); i = j
        else:
            out.append(c); i += 1
    txt = re.sub(r",(\s*[}\]])", r"\1", "".join(out))
    return json.loads(txt)


def load_T(s):
    a = s.index("var T={") + len("var T=")
    b = s.index("}};", a) + 2
    return js_object_to_json(s[a:b])


def strip_tags(x):
    return html.unescape(re.sub(r"<[^>]+>", "", x))


def fill(s, d):
    """Вписывает тексты в элементы data-i. Повторный запуск безопасен (маркер <!--/i-->)."""
    def rep(m):
        open_tag, key = m.group(1), m.group(2)
        if key not in d:
            return m.group(0)
        v = d[key] if "data-html" in open_tag else html.escape(d[key], quote=False)
        return f"{open_tag}{v}<!--/i-->"
    s = re.sub(r'(<[a-z0-9]+\b[^>]*\bdata-i="([a-z0-9_]+)"[^>]*>)(?:.*?<!--/i-->)?', rep, s, flags=re.S)
    track = "".join(f"<span>{html.escape(x)}</span>" for x in d["mq"] * 2)
    s = re.sub(r'(<div class="track" id="track">).*?(</div>)', lambda m: m.group(1) + track + m.group(2), s, flags=re.S)
    return s


def head_block(lang, d, T):
    m = META[lang]
    alt = "".join(f'<link rel="alternate" hreflang="{l}" href="{URL[l]}">\n' for l in LANGS)
    alt += f'<link rel="alternate" hreflang="x-default" href="{URL["az"]}">\n'
    service = {
        "@context": "https://schema.org", "@type": "ProfessionalService",
        "name": "Fuad Studio", "alternateName": "Fuad.studio",
        "description": m["desc"], "url": URL[lang], "telephone": PHONE,
        "image": BASE + "assets/og.jpg", "priceRange": "50+ AZN",
        "address": {"@type": "PostalAddress", "addressLocality": "Bakı", "addressCountry": "AZ"},
        "areaServed": [{"@type": "City", "name": "Baku"}, {"@type": "Country", "name": "Azerbaijan"}],
        "availableLanguage": ["az", "ru", "en"],
        "sameAs": ["https://t.me/fuadddddddddddddddddd"],
        "makesOffer": {"@type": "Offer", "price": "50", "priceCurrency": "AZN",
                       "itemOffered": {"@type": "Service", "name": strip_tags(d["p1_n"]),
                                       "serviceType": "Web design"}},
    }
    faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": strip_tags(d[f"q{i}"]),
         "acceptedAnswer": {"@type": "Answer", "text": strip_tags(d[f"a{i}"])}}
        for i in range(1, 10) if f"q{i}" in d]}
    ld = lambda o: '<script type="application/ld+json">' + json.dumps(o, ensure_ascii=False) + "</script>\n"
    return (
        "<!--seo-->\n"
        f'<title>{html.escape(d["title"])}</title>\n'
        f'<meta name="description" content="{html.escape(m["desc"])}">\n'
        f'<meta name="keywords" content="{html.escape(m["kw"])}">\n'
        f'<link rel="canonical" href="{URL[lang]}">\n{alt}'
        f'<meta property="og:title" content="{html.escape(d["title"])}">\n'
        f'<meta property="og:description" content="{html.escape(m["og"])}">\n'
        '<meta property="og:type" content="website">\n'
        f'<meta property="og:url" content="{URL[lang]}">\n'
        f'<meta property="og:locale" content="{m["locale"]}">\n'
        '<meta property="og:site_name" content="Fuad Studio">\n'
        f'<meta property="og:image" content="{BASE}assets/og.jpg">\n'
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n'
        '<meta name="twitter:card" content="summary_large_image">\n'
        + ld(service) + ld(faq) + "<!--/seo-->\n")


def build(src, lang, T):
    d = T[lang]
    s = src
    # старые/предыдущие SEO-теги убираем, вставляем свежие
    s = re.sub(r"<!--seo-->.*?<!--/seo-->\n", "", s, flags=re.S)
    s = re.sub(r'<title>.*?</title>\n', "", s, count=1)
    s = re.sub(r'<meta (name="description"|property="og:[a-z]+")[^>]*>\n', "", s)
    s = s.replace('<meta name="theme-color"', head_block(lang, d, T) + '<meta name="theme-color"', 1)
    s = re.sub(r'<html lang="[a-z]+"[^>]*>',
               f'<html lang="{lang}"' + (f' data-page-lang="{lang}"' if lang != "az" else "") + ">", s, count=1)
    s = fill(s, d)
    if lang != "az":
        s = re.sub(r'(href|src)="(sites/|assets/)', r'\1="../\2', s)
    return s


def main():
    p = os.path.join(DOCS, "index.html")
    src = open(p, encoding="utf-8").read()
    T = load_T(src)
    for lang in LANGS:
        out = p if lang == "az" else os.path.join(DOCS, lang, "index.html")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            f.write(build(src, lang, T))
        print("ok", out)
    urls = [URL[l] for l in LANGS] + [BASE + "sites/kafe-baku-9553/"]
    sm = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    open(os.path.join(DOCS, "sitemap.xml"), "w", encoding="utf-8").write(sm)
    print("ok sitemap.xml")


if __name__ == "__main__":
    main()

"""
Генератор демо-сайта для одного лида: дизайн по типу бизнеса, AZ/RU, реальные данные из Google
(адрес, часы работы, рейтинг, отзывы, фото), прайс с примерными ценами, заказ/запись в WhatsApp.
"""

import html
import json
import re
import urllib.parse
from datetime import datetime

from demo_kinds import KINDS, STYLES, pick_kind

ICONS = {
    "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    "star": '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    "truck": '<path d="M1 4h14v12H1z"/><path d="M15 9h4l3 3v4h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    "sparkle": '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="M19 3v4M17 5h4"/>',
    "heart": '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    "chat": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "award": '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9L7 23l5-3 5 3-1.2-9.1"/>',
    "leaf": '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
    "tool": '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    "pin": '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    "phone": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    "zap": '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
    "users": '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    "check": '<path d="M20 6L9 17l-5-5"/>',
    "tag": '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    "cup": '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><path d="M6 1v3M10 1v3M14 1v3"/>',
    "scissors": '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>',
    "car": '<path d="M5 17H3v-5l2.5-5h13l2.5 5v5h-2"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5M3 12h18"/>',
    "camera": '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    "droplet": '<path d="M12 2.7l5.7 5.6a8 8 0 1 1-11.4 0z"/>',
    "book": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    "home": '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    "smartphone": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    "activity": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "arrow": '<path d="M5 12h14M13 5l7 7-7 7"/>',
    "wa": '<path d="M3 21l1.6-4.8A8.5 8.5 0 1 1 7.9 19.6z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.8-.9-.8.8c-1-.4-2-1.4-2.4-2.4l.8-.8-.9-1.8L9 9.5"/>',
}


def svg(name, cls=""):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


def T(az, ru):
    """Текст на двух языках: показывается нужный через CSS."""
    return f'<span class="az">{az}</span><span class="ru">{ru}</span>'


def price_txt(p, frm):
    if not p:
        return T("pulsuz", "бесплатно")
    v = f"{p:g}"
    return T(f"{v} AZN-dən", f"от {v} AZN") if frm else f"{v} AZN"


DAYS_AZ = ["B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş.", "B."]
DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


AMEN = {
    "card": ("tag", "Kartla ödəniş", "Оплата картой"),
    "parking": ("car", "Parkinq", "Парковка"),
    "delivery": ("truck", "Çatdırılma", "Доставка"),
    "takeout": ("cup", "Özünlə götür", "Навынос"),
    "terrace": ("leaf", "Açıq terras", "Летняя терраса"),
    "kids": ("heart", "Uşaqlar üçün uyğun", "Можно с детьми"),
    "reserve": ("calendar", "Bron mümkündür", "Есть бронь"),
    "breakfast": ("clock", "Səhər yeməyi", "Завтраки"),
    "wheelchair": ("users", "Əlçatan giriş", "Доступная среда"),
}

# районы Баку: Google отдаёт их по-русски, для AZ-версии переводим
DISTRICTS = {"сабаил": "Səbail", "насими": "Nəsimi", "ясамал": "Yasamal", "нариман": "Nərimanov",
             "низами": "Nizami", "хатаи": "Xətai", "бинагади": "Binəqədi", "сабунчи": "Sabunçu",
             "сураханы": "Suraxanı", "хазар": "Xəzər", "гарадаг": "Qaradağ", "пираллахи": "Pirallahı",
             "сумгаит": "Sumqayıt", "хырдалан": "Xırdalan"}


def district_az(ru):
    low = (ru or "").lower()
    for k, v in DISTRICTS.items():
        if k in low:
            return v
    return ru


def clean_address(addr):
    a = re.sub(r",?\s*(Азербайджан|Azerbaijan|Azərbaycan)\s*$", "", addr or "").strip()
    a = re.sub(r"\s\d{4}(?=,|$)", "", a)  # почтовый индекс «Bakı 1052»
    a = re.sub(r"^[0-9A-Z]{4,8}\+[0-9A-Z]{2,3},?\s*", "", a)  # plus-code «CQ9V+GQ8, Баку»
    return a


def initials(name):
    words = [w for w in re.split(r"[\s\-|&/]+", name) if w and w[0].isalnum()]
    return "".join(w[0] for w in words[:2]).upper() or "★"


def render_demo(lead):
    e = html.escape
    kind_name = lead.get("kind") or pick_kind(lead.get("query"), lead.get("category"))
    K = KINDS[kind_name]
    S = dict(STYLES[K["style"]])
    for k in ("accent", "accent2", "on"):
        if k in K:
            S[k] = K[k]
    n = e(lead["name"])
    wa = lead.get("wa") or ""
    phone = lead.get("phone") or ""
    photos = lead.get("photos") or []      # [{"f": "p1.jpg", "by": "Автор"}]
    reviews = lead.get("rev") or []
    hours = lead.get("hours")              # 7 элементов: [[open_min, close_min], ...] или []
    loc = lead.get("loc")
    addr = clean_address(lead.get("address", ""))
    district = lead.get("district") or ""
    near = lead.get("near") or ""
    if addr.lower() in ("баку", "bakı", "baku", ""):
        addr = ""
    if addr:
        addr_html = e(addr)
    elif district or near:
        da, dr = district_az(district), district
        az_parts = ([f"{e(da)} r-nu"] if da else []) + ([f"{e(near)} yaxınlığında"] if near else [])
        ru_parts = ([f"р-н {e(dr)}"] if dr else []) + ([f"рядом с {e(near)}"] if near else [])
        addr_html = T(", ".join(az_parts), ", ".join(ru_parts))
    else:
        addr_html = ""
    az, ru = K["az"], K["ru"]
    order = K["mode"] == "order"

    # ---- карта ----
    if loc:
        mq = f'{loc[0]},{loc[1]}'
    else:
        mq = f'{lead["name"]}, {lead.get("address", "")}'
    map_src = "https://www.google.com/maps?q=" + urllib.parse.quote(mq) + "&z=16&output=embed"
    maps_link = lead.get("maps") or ("https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote(mq))

    # ---- hero ----
    hero_img = photos[0]["f"] if photos else ""
    rating = lead.get("rating")
    stats = []
    if rating:
        stats.append(f'<div><b>{rating:g}<i>★</i></b><span>{T("Google reytinqi", "рейтинг Google")}</span></div>')
    if lead.get("reviews"):
        stats.append(f'<div><b>{lead["reviews"]}</b><span>{T("rəy", "отзывов")}</span></div>')
    if hours:
        stats.append(f'<div><b id="todayH">—</b><span id="openNow">{T("bu gün", "сегодня")}</span></div>')
    eyebrow = T(e(az["cat"]) + " · " + e(district_az(district) or "Bakı"), e(ru["cat"]) + " · " + e(district or "Баку"))

    wa_href = f"https://wa.me/{wa}" if wa else (f"tel:{e(phone)}" if phone else "#contacts")
    primary = (f'<a class="btn btn-a" href="#{"menu" if order else "book"}">{T(az["cta"], ru["cta"])} {svg("arrow")}</a>')
    second = (f'<a class="btn btn-g" href="{wa_href}" target="_blank" rel="noopener">{svg("wa" if wa else "phone")}'
              f'{T("WhatsApp", "WhatsApp") if wa else T("Zəng et", "Позвонить")}</a>')

    # ---- преимущества ----
    feats = "".join(
        f'<div class="f">{svg(ic, "ic")}<h3>{T(e(ta), e(tr))}</h3><p>{T(e(da), e(dr))}</p></div>'
        for ic, ta, tr, da, dr in K["feats"])

    # ---- прайс/меню ----
    tabs, panes = [], []
    for i, ((ta, tr), items) in enumerate(K["menu"]):
        tabs.append(f'<button class="tab{" on" if i == 0 else ""}" data-t="{i}">{T(e(ta), e(tr))}</button>')
        rows = []
        for it in items:
            ia, ir, p = it[0], it[1], it[2]
            frm = len(it) > 3 and it[3]
            add = (f'<button class="add" data-n="{e(ir)}" data-na="{e(ia)}" data-p="{p:g}" aria-label="+">{svg("plus")}</button>'
                   if order else "")
            rows.append(f'<div class="it"><div class="row"><h4>{T(e(ia), e(ir))}</h4><span class="dots"></span>'
                        f'<span class="pr">{price_txt(p, frm)}</span></div>{add}</div>')
        panes.append(f'<div class="pane{" on" if i == 0 else ""}" data-p="{i}">{"".join(rows)}</div>')
    services_opts = "".join(f'<option value="{e(it[1])}" data-az="{e(it[0])}">{e(it[1])}</option>'
                            for _, items in K["menu"] for it in items)

    # ---- о нас ----
    about_extra = ""
    if lead.get("about"):
        about_extra = f'<p class="quote">“{e(lead["about"])}”</p>'
    about_img = photos[1]["f"] if len(photos) > 1 else (photos[0]["f"] if photos else "")
    amen = [AMEN[a] for a in (lead.get("amen") or []) if a in AMEN]
    if len(amen) >= 3:
        checks = [svg(ic) + T(ta, tr) for ic, ta, tr in amen[:6]]
    else:
        checks = [svg("check") + T(e(f[3]), e(f[4])) for f in K["feats"]]
    about_media = (f'<figure class="ab-img"><img src="{e(about_img)}" alt="{n}" loading="lazy"></figure>' if about_img else
                   f'<div class="ab-img mono"><span>{e(initials(lead["name"]))}</span>{svg(K["icon"], "big")}</div>')

    # ---- галерея ----
    gallery = ""
    if len(photos) >= 3:
        figs = "".join(f'<figure><img src="{e(p["f"])}" alt="{n}" loading="lazy"></figure>' for p in photos[:6])
        credit = ", ".join(sorted({e(p["by"]) for p in photos if p.get("by")}))
        gallery = f"""<section id="gallery"><div class="wrap">
<p class="eyebrow">{T("Qalereya", "Галерея")}</p><h2>{T("Bizdə necədir", "Как у нас")}</h2>
<div class="gal g{min(len(photos), 6)}">{figs}</div>
<p class="credit">{T("Foto: Google Maps", "Фото: Google Maps")}{" · " + credit if credit else ""}</p>
</div></section>"""

    # ---- отзывы ----
    rev_html = ""
    if reviews:
        cards = "".join(
            f'<figure class="rv"><div class="stars">{"★" * int(r.get("r") or 5)}<i>{"★" * (5 - int(r.get("r") or 5))}</i></div>'
            f'<blockquote>{e(r["t"])}</blockquote><figcaption><b>{e(r["a"])}</b>'
            f'{"<span>" + e(r["w"]) + "</span>" if r.get("w") else ""}</figcaption></figure>'
            for r in reviews[:3])
        rev_html = f"""<section id="reviews"><div class="wrap">
<div class="rv-head"><div><p class="eyebrow">{T("Rəylər", "Отзывы")}</p><h2>{T("Qonaqlarımız deyir", "Что говорят клиенты")}</h2></div>
<div class="big-rate"><b>{(rating or 5):g}</b><div><div class="stars">★★★★★</div><span>{lead.get("reviews") or ""} {T("rəy Google-da", "отзывов в Google")}</span></div></div></div>
<div class="rvs">{cards}</div></div></section>"""

    # ---- часы ----
    hours_rows = ""
    if hours:
        for i in range(7):
            h = hours[i]
            if not h:
                val = T("bağlı", "выходной")
            elif h[0] == 0 and h[1] >= 1440:
                val = "24/7" if all(x and x[0] == 0 and x[1] >= 1440 for x in hours) else T("24 saat", "круглосуточно")
            else:
                val = f"{h[0] // 60:02d}:{h[0] % 60:02d} – {(h[1] // 60) % 24:02d}:{h[1] % 60:02d}"
            hours_rows += f'<li data-d="{i}"><span>{T(DAYS_AZ[i], DAYS_RU[i])}</span><b>{val}</b></li>'
        hours_rows = f'<ul class="hours">{hours_rows}</ul>'

    contact_lines = ""
    if addr_html:
        contact_lines += f'<a class="cl" href="{e(maps_link)}" target="_blank" rel="noopener">{svg("pin")}<span>{addr_html}</span></a>'
    else:
        contact_lines += f'<a class="cl" href="{e(maps_link)}" target="_blank" rel="noopener">{svg("pin")}<span>{T("Xəritədə bax", "Открыть на карте")}</span></a>'
    if phone:
        contact_lines += f'<a class="cl" href="tel:{e(phone.replace(" ", ""))}">{svg("phone")}<span>{e(phone)}</span></a>'
    if wa:
        contact_lines += f'<a class="cl" href="https://wa.me/{wa}" target="_blank" rel="noopener">{svg("wa")}<span>WhatsApp</span></a>'

    # ---- форма (запись / бронь) ----
    if order:
        form_title = T("Masa bron et", "Забронировать столик")
        form_fields = f"""<label>{T("Tarix", "Дата")}<input type="date" name="d" required></label>
<label>{T("Saat", "Время")}<input type="time" name="t" value="19:00" required></label>
<label>{T("Qonaq sayı", "Гостей")}<input type="number" name="g" min="1" max="60" value="2"></label>"""
    else:
        form_title = T(az["cta"], ru["cta"])
        form_fields = f"""<label class="wide">{T("Xidmət", "Услуга")}<select name="s">{services_opts}</select></label>
<label>{T("Tarix", "Дата")}<input type="date" name="d" required></label>
<label>{T("Saat", "Время")}<input type="time" name="t" value="11:00" required></label>"""

    cart = ""
    if order:
        cart = f"""<div class="cart" id="cart"><div><b id="cartN">0</b> {T("məhsul", "поз.")} · <b id="cartS">0</b> AZN</div>
<a class="btn btn-a" id="cartGo" href="#" target="_blank" rel="noopener">{svg("wa")}{T("Sifarişi göndər", "Отправить заказ")}</a></div>"""

    data = {"wa": wa, "phone": phone, "name": lead["name"], "hours": hours or [], "order": order}

    fonts = sorted({S["display"], S["sans"]})
    fam = "&".join("family=" + f.replace(" ", "+") + ":wght@400;500;600;700" for f in fonts)
    upper = "text-transform:uppercase;letter-spacing:.01em;" if S["upper"] else ""
    year = datetime.now().year
    hero_bg = (f'<div class="hero-bg" style="background-image:url(\'{e(hero_img)}\')"></div>' if hero_img
               else f'<div class="hero-bg none">{svg(K["icon"], "ghost")}</div>')
    hcard = ""
    if not hero_img:
        rate_line = (f'<div class="hc-r"><span class="stars">{"★" * round(rating)}</span><b>{rating:g}</b>'
                     f'<small>{lead.get("reviews") or 0} {T("rəy", "отзывов")}</small></div>') if rating else ""
        hc_rows = ""
        if hours:
            hc_rows += f'<li>{svg("clock")}<span id="hcH">—</span></li>'
        if addr_html:
            hc_rows += f'<li>{svg("pin")}<span>{addr_html}</span></li>'
        if phone:
            hc_rows += f'<li>{svg("phone")}<span>{e(phone)}</span></li>'
        hcard = f"""<aside class="hcard"><div class="hc-top"><i>{e(initials(lead["name"]))}</i><div><b>{n}</b>
<small>{T(e(az["cat"]), e(ru["cat"]))}</small></div></div>{rate_line}<ul>{hc_rows}</ul>
<a class="btn btn-a" href="{wa_href}" target="_blank" rel="noopener">{svg("wa" if wa else "phone")}{T("Yazın, cavab veririk", "Напишите, ответим") if wa else T("Zəng edin", "Позвоните")}</a></aside>"""

    return f"""<!doctype html>
<html lang="az" data-l="az">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{n} · {e(az["cat"])}</title>
<meta name="robots" content="noindex">
<meta name="description" content="{n}: {e(ru["tag"])}">
<meta name="theme-color" content="{S["bg"]}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?{fam}&display=swap" rel="stylesheet">
<style>
:root{{--bg:{S["bg"]};--bg2:{S["bg2"]};--card:{S["card"]};--line:{S["line"]};--text:{S["text"]};--muted:{S["muted"]};
--a:{S["accent"]};--a2:{S["accent2"]};--on:{S["on"]};--wa:#25d366;--r:18px;
--disp:"{S["display"]}",Georgia,serif;--sans:"{S["sans"]}",system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
*{{box-sizing:border-box}}html{{scroll-behavior:smooth;scroll-padding-top:76px}}
body{{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 var(--sans);-webkit-font-smoothing:antialiased;overflow-x:hidden}}
img{{max-width:100%;display:block}}a{{color:inherit;text-decoration:none}}
[data-l=az] .ru,[data-l=ru] .az{{display:none}}
.wrap{{max-width:1140px;margin:0 auto;padding:0 20px}}
h1,h2,h3,h4{{font-family:var(--disp);font-weight:{S["dw"]};line-height:1.08;margin:0;{upper}}}
h2{{font-size:clamp(32px,5vw,52px);margin:10px 0 14px}}
.eyebrow{{font:700 12px/1 var(--sans);letter-spacing:.22em;text-transform:uppercase;color:var(--a);margin:0}}
.lead{{color:var(--muted);max-width:620px;font-size:17px;margin:0}}
section{{padding:88px 0}}
.btn{{display:inline-flex;align-items:center;gap:10px;padding:15px 24px;border-radius:40px;font:700 15px/1 var(--sans);border:0;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s}}
.btn:hover{{transform:translateY(-2px)}}.btn svg{{width:18px;height:18px}}
.btn-a{{background:var(--a);color:var(--on);box-shadow:0 12px 30px -12px var(--a)}}
.btn-g{{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(6px)}}
/* nav */
nav{{position:fixed;inset:0 0 auto;z-index:50;transition:background .3s,border-color .3s;border-bottom:1px solid transparent}}
nav.s{{background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(14px);border-color:var(--line)}}
nav .wrap{{display:flex;align-items:center;gap:16px;height:68px}}
.logo{{display:flex;align-items:center;gap:10px;font:700 17px/1.1 var(--sans);color:#fff;min-width:0}}
nav.s .logo{{color:var(--text)}}
.logo i{{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--a);color:var(--on);font:700 15px var(--disp);font-style:normal}}
.logo span{{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:42vw}}
.links{{display:flex;gap:26px;margin-left:auto;font-size:14px;font-weight:600}}
.links a{{color:rgba(255,255,255,.8)}}nav.s .links a{{color:var(--muted)}}.links a:hover{{color:var(--a)}}
.lang{{display:flex;border:1px solid rgba(255,255,255,.3);border-radius:30px;padding:3px;margin-left:auto}}
.links+.lang{{margin-left:0}}nav.s .lang{{border-color:var(--line)}}
.lang button{{border:0;background:none;color:rgba(255,255,255,.85);font:700 12px var(--sans);padding:7px 11px;border-radius:30px;cursor:pointer}}
nav.s .lang button{{color:var(--muted)}}.lang button.on{{background:var(--a);color:var(--on)!important}}
@media(max-width:860px){{.links{{display:none}}}}
/* hero */
.hero{{position:relative;min-height:92svh;display:flex;align-items:flex-end;padding:130px 0 64px;color:#fff;overflow:hidden;background:#111}}
.hero-bg{{position:absolute;inset:0;background-size:cover;background-position:center;transform:scale(1.04);animation:zoom 18s ease-out both}}
@keyframes zoom{{to{{transform:scale(1)}}}}
.hero::after{{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.25) 35%,rgba(0,0,0,.82) 100%)}}
.hero-bg.none{{background:radial-gradient(900px 600px at 85% 15%,color-mix(in srgb,var(--a) 55%,transparent),transparent 60%),radial-gradient(700px 500px at 0% 100%,color-mix(in srgb,var(--a2) 35%,transparent),transparent 60%),#12100f;animation:none;transform:none}}
.ghost{{position:absolute;right:-60px;top:50%;width:min(70vw,560px);height:auto;transform:translateY(-50%);color:#fff;opacity:.08;stroke-width:.8}}
.hero .wrap{{position:relative;z-index:2;width:100%}}
.hero.nophoto{{align-items:center}}.hero.nophoto::after{{display:none}}
.hero.nophoto .wrap{{display:grid;grid-template-columns:1.25fr .75fr;gap:48px;align-items:center}}
.hcard{{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(18px);border-radius:28px;padding:26px;transform:rotate(1.5deg);box-shadow:0 40px 80px -30px rgba(0,0,0,.7);animation:float 6s ease-in-out infinite}}
@keyframes float{{50%{{transform:rotate(1.5deg) translateY(-10px)}}}}
.hc-top{{display:flex;gap:14px;align-items:center}}.hc-top i{{flex:none;width:56px;height:56px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,var(--a),var(--a2));color:var(--on);font:700 20px var(--disp);font-style:normal}}
.hc-top b{{display:block;font-size:18px;line-height:1.2}}.hc-top small{{color:rgba(255,255,255,.65)}}
.hc-r{{display:flex;align-items:center;gap:10px;margin:20px 0 6px;padding:14px 16px;border-radius:16px;background:rgba(0,0,0,.25)}}
.hc-r b{{font:600 26px/1 var(--disp)}}.hc-r small{{color:rgba(255,255,255,.65);margin-left:auto}}
.hcard ul{{list-style:none;padding:0;margin:10px 0 20px;display:grid;gap:12px;font-size:14px;color:rgba(255,255,255,.85)}}
.hcard li{{display:flex;gap:10px;align-items:flex-start}}.hcard li svg{{flex:none;width:18px;height:18px;color:var(--a2);margin-top:2px}}
.hcard .btn{{width:100%;justify-content:center}}
@media(max-width:900px){{.hero.nophoto .wrap{{grid-template-columns:1fr}}.hcard{{display:none}}}}
.hero .eyebrow{{color:var(--a2)}}
.hero h1{{font-size:clamp(42px,8.5vw,96px);margin:16px 0 16px;max-width:15ch;text-wrap:balance;letter-spacing:-.01em}}
.hero p.sub{{font-size:clamp(17px,2.2vw,20px);max-width:560px;margin:0 0 30px;color:rgba(255,255,255,.85)}}
.ctas{{display:flex;flex-wrap:wrap;gap:12px}}
.stats{{display:flex;flex-wrap:wrap;gap:14px 38px;margin-top:44px;padding-top:24px;border-top:1px solid rgba(255,255,255,.2);max-width:620px}}
.stats b{{display:block;font:600 28px/1.1 var(--disp)}}.stats b i{{color:#ffc94a;font-style:normal;font-size:.8em;margin-left:3px}}
.stats span{{font-size:13px;color:rgba(255,255,255,.7)}}
/* features */
.feat{{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:40px}}
.f{{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:28px;transition:transform .3s,border-color .3s}}
.f:hover{{transform:translateY(-4px);border-color:var(--a)}}
.f .ic{{width:48px;height:48px;padding:11px;border-radius:14px;background:color-mix(in srgb,var(--a) 14%,transparent);color:var(--a);margin-bottom:18px}}
.f h3{{font-size:22px;margin-bottom:6px}}.f p{{margin:0;color:var(--muted);font-size:15px}}
@media(max-width:820px){{.feat{{grid-template-columns:1fr}}}}
/* menu */
#menu{{background:var(--bg2)}}
.mh{{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}}
.note{{display:inline-flex;gap:8px;align-items:center;font-size:13px;color:var(--muted);background:var(--card);border:1px dashed var(--line);padding:8px 14px;border-radius:30px}}
.note svg{{width:16px;height:16px;color:var(--a)}}
.tabs{{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px;margin:30px 0 18px;scrollbar-width:none}}.tabs::-webkit-scrollbar{{display:none}}
.tab{{flex:none;padding:11px 20px;border-radius:30px;border:1px solid var(--line);background:var(--card);color:var(--muted);font:600 14px var(--sans);cursor:pointer}}
.tab.on{{background:var(--a);color:var(--on);border-color:var(--a)}}
.pane{{display:none;grid-template-columns:1fr 1fr;gap:0 48px}}.pane.on{{display:grid}}
.it{{display:flex;align-items:center;gap:14px;padding:18px 0;border-bottom:1px dashed var(--line);animation:fade .4s both}}
@keyframes fade{{from{{opacity:0;transform:translateY(6px)}}}}
.it .row{{flex:1;display:flex;align-items:baseline;gap:10px;min-width:0}}
.it h4{{font:600 18px/1.25 var(--sans);text-transform:none}}
.it .dots{{flex:1;border-bottom:1px dotted var(--muted);opacity:.4;min-width:16px;transform:translateY(-4px)}}
.it .pr{{font-weight:700;color:var(--a);white-space:nowrap}}
.add{{flex:none;width:36px;height:36px;border-radius:50%;border:1px solid var(--a);background:none;color:var(--a);cursor:pointer;display:grid;place-items:center;transition:.2s}}
.add svg{{width:18px;height:18px}}.add:hover,.add.ok{{background:var(--a);color:var(--on)}}
@media(max-width:760px){{.pane{{grid-template-columns:1fr}}}}
/* about */
.about{{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}}
.ab-img{{margin:0;border-radius:24px;overflow:hidden;aspect-ratio:4/5;background:var(--card);border:1px solid var(--line)}}
.ab-img img{{width:100%;height:100%;object-fit:cover}}
.ab-img.mono{{display:grid;place-items:center;position:relative;background:linear-gradient(135deg,var(--a),var(--a2));color:var(--on)}}
.ab-img.mono span{{font:700 clamp(80px,14vw,160px)/1 var(--disp);position:relative;z-index:1}}
.ab-img .big{{position:absolute;right:8%;bottom:8%;width:34%;opacity:.25;stroke-width:1.2}}
.about p{{color:var(--muted);font-size:17px}}.quote{{font-style:italic;border-left:3px solid var(--a);padding-left:16px}}
.checks{{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:12px}}
.checks li{{display:flex;gap:12px;align-items:center;font-weight:600}}
.checks svg{{flex:none;width:30px;height:30px;padding:6px;border-radius:50%;background:var(--a);color:var(--on)}}
@media(max-width:820px){{.about{{grid-template-columns:1fr;gap:32px}}.ab-img{{aspect-ratio:4/3}}}}
/* gallery */
#gallery{{background:var(--bg2)}}
.gal{{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:220px;gap:12px;margin-top:34px}}
.gal figure{{margin:0;border-radius:16px;overflow:hidden}}.gal img{{width:100%;height:100%;object-fit:cover;transition:transform .5s}}
.gal figure:hover img{{transform:scale(1.05)}}
.gal figure:first-child{{grid-column:span 2;grid-row:span 2}}
.g3{{grid-template-columns:2fr 1fr}}.g3 figure:first-child{{grid-column:auto}}
.credit{{font-size:12px;color:var(--muted);margin:14px 0 0}}
@media(max-width:760px){{.gal{{grid-template-columns:1fr 1fr;grid-auto-rows:150px}}.g3{{grid-template-columns:1fr 1fr}}.g3 figure:first-child{{grid-column:span 2}}}}
/* reviews */
.rv-head{{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}}
.big-rate{{display:flex;align-items:center;gap:14px}}.big-rate b{{font:600 56px/1 var(--disp)}}.big-rate span{{color:var(--muted);font-size:14px}}
.stars{{color:#f5b301;letter-spacing:2px}}.stars i{{color:var(--line);font-style:normal}}
.rvs{{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:36px}}
.rv{{margin:0;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:26px;display:flex;flex-direction:column;gap:14px}}
.rv blockquote{{margin:0;flex:1;font-size:15px;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}}
.rv figcaption{{font-size:14px}}.rv figcaption span{{display:block;color:var(--muted);font-size:13px}}
@media(max-width:900px){{.rvs{{grid-template-columns:1fr}}}}
/* booking */
#book{{background:var(--bg2)}}
.bk{{display:grid;grid-template-columns:1fr 1.1fr;gap:48px;align-items:center}}
form{{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:28px;display:grid;grid-template-columns:1fr 1fr;gap:14px}}
label{{display:grid;gap:6px;font-size:13px;font-weight:600;color:var(--muted)}}label.wide{{grid-column:1/-1}}
input,select{{width:100%;font:500 16px var(--sans);padding:13px 14px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--text)}}
input:focus,select:focus{{outline:2px solid var(--a);border-color:transparent}}
form .btn{{grid-column:1/-1;justify-content:center;background:var(--wa);color:#04210d}}
@media(max-width:820px){{.bk{{grid-template-columns:1fr}}}}
.bk>*,form>*{{min-width:0}}input,select{{min-width:0}}
@media(max-width:420px){{form{{grid-template-columns:1fr;padding:22px}}}}
/* contacts */
.ct{{display:grid;grid-template-columns:1fr 1.3fr;gap:36px;margin-top:36px}}
.cl{{display:flex;gap:14px;align-items:center;padding:16px 0;border-bottom:1px solid var(--line);font-weight:600}}
.cl svg{{flex:none;width:22px;height:22px;color:var(--a)}}
.hours{{list-style:none;padding:0;margin:22px 0 0;background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}}
.hours li{{display:flex;justify-content:space-between;padding:11px 18px;font-size:15px;border-bottom:1px solid var(--line)}}
.hours li:last-child{{border:0}}.hours li span{{color:var(--muted)}}
.hours li.today{{background:color-mix(in srgb,var(--a) 12%,transparent)}}.hours li.today b,.hours li.today span{{color:var(--a)}}
.map{{border-radius:var(--r);overflow:hidden;border:1px solid var(--line);min-height:380px}}.map iframe{{width:100%;height:100%;min-height:380px;border:0;display:block}}
@media(max-width:820px){{.ct{{grid-template-columns:1fr}}}}
footer{{border-top:1px solid var(--line);padding:30px 0 110px;color:var(--muted);font-size:14px}}
footer .wrap{{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}}
/* demo badge, wa, cart */
.demo{{position:fixed;left:12px;bottom:12px;z-index:60;background:rgba(15,15,15,.86);backdrop-filter:blur(8px);color:#ddd;font-size:12px;padding:8px 13px;border-radius:30px;border:1px solid rgba(255,255,255,.12);max-width:calc(100vw - 96px)}}
.demo b{{color:#ffc94a}}
.fab{{position:fixed;right:16px;bottom:16px;z-index:60;width:58px;height:58px;border-radius:50%;background:var(--wa);color:#fff;display:grid;place-items:center;box-shadow:0 10px 30px -8px rgba(37,211,102,.7)}}
.fab svg{{width:28px;height:28px}}
.cart{{position:fixed;left:50%;bottom:16px;z-index:70;transform:translate(-50%,150%);transition:transform .35s,opacity .35s;opacity:0;pointer-events:none;display:flex;align-items:center;gap:16px;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:40px;padding:8px 8px 8px 22px;box-shadow:0 20px 50px -15px rgba(0,0,0,.5);white-space:nowrap}}
.cart.on{{transform:translate(-50%,0);opacity:1;pointer-events:auto}}.cart .btn{{padding:12px 18px}}
body.has-cart .fab,body.has-cart .demo{{opacity:0;pointer-events:none}}
.rev{{opacity:0;transform:translateY(24px);transition:opacity .7s,transform .7s}}.rev.in{{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){{.rev{{opacity:1;transform:none}}.hero-bg{{animation:none}}}}
</style>
</head>
<body>
<nav id="nav"><div class="wrap">
<a class="logo" href="#top"><i>{e(initials(lead["name"]))}</i><span>{n}</span></a>
<div class="links"><a href="#menu">{T(e(az["list"].split(" ")[0]), e(ru["list"].split(" ")[0]))}</a><a href="#about">{T("Haqqımızda", "О нас")}</a>{'<a href="#reviews">' + T("Rəylər", "Отзывы") + '</a>' if reviews else ''}<a href="#contacts">{T("Əlaqə", "Контакты")}</a></div>
<div class="lang"><button data-l="az">AZ</button><button data-l="ru">RU</button></div>
</div></nav>

<header class="hero{" nophoto" if not hero_img else ""}" id="top">{hero_bg}
<div class="wrap"><div class="hl">
<p class="eyebrow">{eyebrow}</p>
<h1>{n}</h1>
<p class="sub">{T(e(az["tag"]), e(ru["tag"]))}</p>
<div class="ctas">{primary}{second}</div>
{'<div class="stats">' + "".join(stats) + '</div>' if stats else ''}
</div>{hcard}</div></header>

<section><div class="wrap">
<p class="eyebrow rev">{T("Niyə biz", "Почему мы")}</p>
<h2 class="rev">{T("Sizin üçün vacib olanlar", "То, что важно для вас")}</h2>
<div class="feat">{feats}</div>
</div></section>

<section id="menu"><div class="wrap">
<div class="mh"><div><p class="eyebrow">{T(e(az["list"]), e(ru["list"]))}</p><h2>{T(e(az["list"]), e(ru["list"]))}</h2></div>
<span class="note">{svg("tag")}{T("Qiymətlər nümunədir, sizin qiymətlərlə əvəz olunacaq", "Цены примерные, заменим на ваши")}</span></div>
<div class="tabs">{"".join(tabs)}</div>
{"".join(panes)}
</div></section>

<section id="about"><div class="wrap about">
{about_media}
<div class="rev"><p class="eyebrow">{T("Haqqımızda", "О нас")}</p>
<h2>{n}</h2>
<p>{T(e(az["about"].format(n=lead["name"])), e(ru["about"].format(n=lead["name"])))}</p>
{about_extra}
<ul class="checks">{"".join(f"<li>{c}</li>" for c in checks)}</ul>
</div></div></section>

{gallery}
{rev_html}

<section id="book"><div class="wrap bk">
<div class="rev"><p class="eyebrow">{T("Onlayn", "Онлайн")}</p><h2>{form_title}</h2>
<p class="lead">{T("Formu doldurun, mesaj WhatsApp-da hazır açılacaq. Bir toxunuşla göndərin.", "Заполните форму, и сообщение откроется в WhatsApp уже готовым. Отправьте в одно касание.")}</p></div>
<form id="f">{form_fields}
<label class="wide">{T("Adınız", "Ваше имя")}<input name="n" required data-az="Adınız" data-ru="Ваше имя" placeholder="Adınız"></label>
<button class="btn" type="submit">{svg("wa")}{T("WhatsApp-a göndər", "Отправить в WhatsApp")}</button>
</form></div></section>

<section id="contacts"><div class="wrap">
<p class="eyebrow">{T("Əlaqə", "Контакты")}</p><h2>{T("Bizi tapın", "Как нас найти")}</h2>
<div class="ct"><div>{contact_lines}{hours_rows}</div>
<div class="map"><iframe loading="lazy" src="{e(map_src)}" title="map"></iframe></div></div>
</div></section>

<footer><div class="wrap"><span>© {year} {n}</span><span>{T("Sayt demo versiyadır", "Сайт в демо-режиме")}</span></div></footer>

<div class="demo"><b>DEMO</b> · {T("saytın demo versiyası", "демо-версия сайта")}</div>
{'<a class="fab" href="https://wa.me/' + wa + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + svg("wa") + '</a>' if wa else ''}
{cart}

<script>
const D={json.dumps(data, ensure_ascii=False).replace("</", "<\\/")};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let L='az';try{{L=localStorage.getItem('demoLang')||'az'}}catch(e){{}}
function setL(l){{L=l;document.documentElement.dataset.l=l;document.documentElement.lang=l;
 $$('.lang button').forEach(b=>b.classList.toggle('on',b.dataset.l==l));
 $$('[data-'+l+']').forEach(x=>{{if(x.tagName=='OPTION')x.textContent=x.dataset[l]||x.value;else x.placeholder=x.dataset[l]}});
 $$('option').forEach(o=>o.textContent=l=='az'?(o.dataset.az||o.value):o.value);
 try{{localStorage.setItem('demoLang',l)}}catch(e){{}}}}
$$('.lang button').forEach(b=>b.onclick=()=>setL(b.dataset.l));setL(L);
const nav=$('#nav');const onS=()=>nav.classList.toggle('s',scrollY>40);addEventListener('scroll',onS,{{passive:true}});onS();
$$('.tab').forEach(t=>t.onclick=()=>{{$$('.tab').forEach(x=>x.classList.toggle('on',x==t));$$('.pane').forEach(p=>p.classList.toggle('on',p.dataset.p==t.dataset.t))}});
const io=new IntersectionObserver(es=>es.forEach(x=>{{if(x.isIntersecting){{x.target.classList.add('in');io.unobserve(x.target)}}}}),{{threshold:.15}});
$$('.rev,.f,.rv').forEach(x=>{{x.classList.add('rev');io.observe(x)}});
function wa(text){{return D.wa?'https://wa.me/'+D.wa+'?text='+encodeURIComponent(text):'tel:'+D.phone}}
// часы работы и «сейчас открыто» по времени Баку
if(D.hours.length){{
 const now=new Date(new Date().toLocaleString('en-US',{{timeZone:'Asia/Baku'}}));
 const d=(now.getDay()+6)%7,m=now.getHours()*60+now.getMinutes(),h=D.hours[d];
 const li=$('.hours li[data-d="'+d+'"]');if(li)li.classList.add('today');
 const p=x=>String(Math.floor(x/60)%24).padStart(2,'0')+':'+String(x%60).padStart(2,'0');
 const t=$('#todayH'),o=$('#openNow'),hc=$('#hcH');
 if(hc){{const op=h&&m>=h[0]&&m<h[1];hc.innerHTML=(h?(h[0]==0&&h[1]>=1440?'24/7':p(h[0])+'–'+p(h[1])):'')+(op?' · <span class="az">indi açıqdır</span><span class="ru">сейчас открыто</span>':(h?' · <span class="az">bu gün</span><span class="ru">сегодня</span>':'<span class="az">bu gün bağlı</span><span class="ru">сегодня выходной</span>'))}}
 if(t){{if(!h){{t.innerHTML='<span class="az">bağlı</span><span class="ru">выходной</span>'}}
  else if(h[0]==0&&h[1]>=1440){{t.textContent='24/7'}}else t.textContent=p(h[0])+'–'+p(h[1]);
  const open=h&&m>=h[0]&&m<h[1];
  o.innerHTML=open?'<span class="az">indi açıqdır</span><span class="ru">сейчас открыто</span>':'<span class="az">bu gün</span><span class="ru">сегодня</span>'}}
}}
// запись / бронь
$('#f').onsubmit=ev=>{{ev.preventDefault();const f=new FormData(ev.target);const g=k=>f.get(k)||'';
 let msg;
 if(D.order)msg=(L=='az'?'Salam! Masa bron etmək istəyirəm.\\nTarix: '+g('d')+' '+g('t')+'\\nQonaq: '+g('g')+'\\nAd: ':'Здравствуйте! Хочу забронировать столик.\\nДата: '+g('d')+' '+g('t')+'\\nГостей: '+g('g')+'\\nИмя: ')+g('n');
 else{{const s=ev.target.s,sv=L=='az'?(s.selectedOptions[0].dataset.az||s.value):s.value;
  msg=(L=='az'?'Salam! Qeydiyyat istəyirəm.\\nXidmət: '+sv+'\\nTarix: '+g('d')+' '+g('t')+'\\nAd: ':'Здравствуйте! Хочу записаться.\\nУслуга: '+sv+'\\nДата: '+g('d')+' '+g('t')+'\\nИмя: ')+g('n')}}
 open(wa(msg),'_blank')}};
const di=$('input[type=date]');if(di){{const t=new Date();di.min=t.toISOString().slice(0,10);di.value=di.min}}
// корзина
if(D.order){{const cart={{}};const c=$('#cart');
 function draw(){{const it=Object.values(cart);const n=it.reduce((a,x)=>a+x.q,0),s=it.reduce((a,x)=>a+x.q*x.p,0);
  $('#cartN').textContent=n;$('#cartS').textContent=Math.round(s*100)/100;c.classList.toggle('on',n>0);document.body.classList.toggle('has-cart',n>0);
  const lines=it.map(x=>'• '+(L=='az'?x.na:x.n)+' × '+x.q).join('\\n');
  $('#cartGo').href=wa((L=='az'?'Salam! Sifariş vermək istəyirəm:\\n':'Здравствуйте! Хочу заказать:\\n')+lines)}}
 $$('.add').forEach(b=>b.onclick=()=>{{const k=b.dataset.n;cart[k]=cart[k]||{{n:k,na:b.dataset.na,p:+b.dataset.p,q:0}};cart[k].q++;b.classList.add('ok');setTimeout(()=>b.classList.remove('ok'),500);draw()}});
 $$('.lang button').forEach(b=>b.addEventListener('click',draw))}}
</script>
</body>
</html>"""

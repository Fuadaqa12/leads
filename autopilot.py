#!/usr/bin/env python3
"""
Автопилот: каждый запуск
  1) ищет НОВЫЕ бизнесы без сайта (кого уже находил, пропускает),
  2) делает каждому лёгкий демо-сайт в docs/sites/<имя>/,
  3) обновляет очередь docs/<очередь>.html: бизнес + демо + кнопка WhatsApp с готовым текстом.

Отправку жмёшь сам (одна кнопка на человека). Автоотправка незнакомым = бан номера в WhatsApp.

Запуск:  python autopilot.py
Настройки: config.json
"""

import hashlib
import html
import json
import os
import re
import shutil
import sys
from datetime import datetime

import find_clients as fc
from demo_site import render_demo

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "docs")            # эта папка публикуется на GitHub Pages
DATA = os.path.join(HERE, "data", "leads.json")
CONFIG = os.path.join(HERE, "config.json")

TRANSLIT = str.maketrans({
    "ə": "e", "ğ": "g", "ı": "i", "ö": "o", "ü": "u", "ş": "s", "ç": "c", "İ": "i",
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
    "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sh",
    "ы": "y", "э": "e", "ю": "yu", "я": "ya", "ь": "", "ъ": "",
})


def make_slug(name, place_id):
    s = name.lower().translate(TRANSLIT)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40] or "biznes"
    return f"{s}-{hashlib.md5(place_id.encode()).hexdigest()[:4]}"


# ---------- данные для демо-сайта ----------

def _hours(p):
    """periods из Google -> 7 дней (Пн..Вс): [открытие_мин, закрытие_мин] или [] если выходной."""
    oh = p.get("regularOpeningHours") or {}
    periods = oh.get("periods") or []
    if not periods:
        return None
    if len(periods) == 1 and "close" not in periods[0]:
        return [[0, 1440]] * 7  # круглосуточно
    days = [[] for _ in range(7)]
    for per in periods:
        o, c = per.get("open"), per.get("close")
        if not o or not c:
            continue
        d = (o["day"] + 6) % 7  # Google: 0 = воскресенье
        om = o.get("hour", 0) * 60 + o.get("minute", 0)
        cm = c.get("hour", 0) * 60 + c.get("minute", 0) + ((c["day"] - o["day"]) % 7) * 1440
        if cm <= om:
            cm += 1440
        if days[d]:
            days[d] = [min(days[d][0], om), max(days[d][1], cm)]
        else:
            days[d] = [om, cm]
    return days


def _district(p):
    for c in p.get("addressComponents") or []:
        t = c.get("types") or []
        if "sublocality_level_1" in t or "sublocality" in t or "neighborhood" in t:
            return c.get("longText", "")
    return ""


def _reviews(p):
    out = []
    for r in p.get("reviews") or []:
        txt = ((r.get("originalText") or {}).get("text") or (r.get("text") or {}).get("text") or "").strip()
        if len(txt) < 30 or (r.get("rating") or 0) < 4:
            continue
        if len(txt) > 320:
            txt = txt[:300].rsplit(" ", 1)[0] + "…"
        author = ((r.get("authorAttribution") or {}).get("displayName") or "").split(" ")[0]
        out.append({"a": author or "Google", "r": r.get("rating", 5), "t": txt,
                    "w": r.get("relativePublishTimeDescription", "")})
    out.sort(key=lambda x: (-x["r"], -len(x["t"])))
    return out[:3]


NEAR_TYPES = ("shopping_mall", "subway_station", "transit_station", "tourist_attraction", "park",
              "university", "lodging", "supermarket", "school", "hospital")


def _near(p):
    lms = ((p.get("addressDescriptor") or {}).get("landmarks") or [])
    lms = [l for l in lms if (l.get("straightLineDistanceMeters") or 999) < 500]
    for l in lms:
        if any(t in NEAR_TYPES for t in l.get("types") or []):
            return l["displayName"]["text"]
    return lms[0]["displayName"]["text"] if lms else ""


def _amenities(p):
    a = []
    pay = p.get("paymentOptions") or {}
    if pay.get("acceptsCreditCards") or pay.get("acceptsDebitCards") or pay.get("acceptsNfc"):
        a.append("card")
    if any(p.get("parkingOptions", {}).values()):
        a.append("parking")
    for key, name in (("delivery", "delivery"), ("takeout", "takeout"), ("outdoorSeating", "terrace"),
                      ("goodForChildren", "kids"), ("reservable", "reserve"), ("servesBreakfast", "breakfast")):
        if p.get(key):
            a.append(name)
    acc = p.get("accessibilityOptions") or {}
    if acc.get("wheelchairAccessibleEntrance"):
        a.append("wheelchair")
    return a


def enrich(lead, p, api_key, budget):
    """Дополняет лида данными Google (часы, отзывы, фото...). budget = {"photos": сколько ещё можно скачать}."""
    if p.get("location"):
        lead["loc"] = [round(p["location"]["latitude"], 6), round(p["location"]["longitude"], 6)]
    h = _hours(p)
    if h:
        lead["hours"] = h
    if p.get("formattedAddress") and len(p["formattedAddress"]) > len(lead.get("address", "")):
        lead["address"] = p["formattedAddress"]
    lead["district"] = _district(p) or lead.get("district", "")
    lead["near"] = _near(p) or lead.get("near", "")
    lead["amen"] = _amenities(p)
    rv = _reviews(p)
    if rv:
        lead["rev"] = rv
    about = (p.get("editorialSummary") or {}).get("text")
    if about:
        lead["about"] = about
    lead["enriched"] = True
    if lead.get("photos") is None and p.get("photos"):
        want = min(PHOTOS_PER_LEAD, len(p["photos"]), budget.get("photos", 0))
        d = os.path.join(DOCS, "sites", lead["slug"])
        os.makedirs(d, exist_ok=True)
        got = []
        for i, ph in enumerate(p["photos"][:want]):
            fn = f"p{i + 1}.jpg"
            if fc.download_photo(api_key, ph["name"], os.path.join(d, fn)):
                by = ", ".join(a.get("displayName", "") for a in ph.get("authorAttributions") or [])
                got.append({"f": fn, "by": by})
            budget["photos"] -= 1
        if want:
            lead["photos"] = got


def write_demo(lead):
    if lead.get("custom_site"):  # сайт сделан вручную (напр. Cafe Baku) — не трогаем
        return
    d = os.path.join(DOCS, "sites", lead["slug"])
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
        f.write(render_demo(lead))


def in_azerbaijan(addr):
    return any(w in (addr or "") for w in COUNTRY_WORDS)


# ---------- сообщения ----------

def make_messages(lead, demo_url):
    if lead.get("msg"):  # своё сообщение для особого клиента (оба языка)
        return lead["msg"], lead["msg"]
    n = lead["name"]
    az = (f"Salam! «{n}» üçün pulsuz kiçik sayt hazırladım, baxın: {demo_url}\n"
          f"Bu sadə demo versiyadır. Bəyənsəniz, tam saytı edərik: öz domeniniz, Google-da görünmə, "
          f"WhatsApp düyməsi. Qiymət {PRICE}. Maraqlıdır?")
    ru = (f"Здравствуйте! Сделал бесплатно небольшой сайт для «{n}», посмотрите: {demo_url}\n"
          f"Это лёгкая демо-версия. Если понравится, сделаем полноценный сайт: свой домен, видимость в Google, "
          f"кнопка WhatsApp. Цена {PRICE}. Интересно?")
    return az, ru


# ---------- очередь (дашборд) ----------

def render_queue(leads, base_url):
    items = []
    for l in sorted(leads.values(), key=lambda l: (bool(l["wa"]), l["reviews"] or 0, l["added"]), reverse=True):
        demo = base_url + "sites/" + l["slug"] + "/"
        az, ru = make_messages(l, demo)
        items.append({"id": l["id"], "n": l["name"], "c": l["category"], "a": l["address"],
                      "r": l["rating"], "rv": l["reviews"] or 0, "s": l["site"], "p": l["phone"],
                      "wa": l["wa"], "d": demo, "m": l["maps"], "az": az, "ru": ru})
    data = json.dumps(items, ensure_ascii=False).replace("</", "<\\/")
    return """<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Очередь клиентов</title><style>
*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;background:#f2f2f2;color:#222}
.w{max-width:520px;margin:auto;padding:16px}
.top{display:flex;justify-content:space-between;align-items:center;font-size:15px}
.bar{height:8px;background:#ddd;border-radius:4px;margin:8px 0 16px;overflow:hidden}.bar i{display:block;height:100%;background:#25d366}
.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 8px #0001}
h1{font-size:24px;margin:0 0 6px}.muted{color:#666;font-size:14px;margin:4px 0}
.msg{background:#f7f7f7;border-radius:10px;padding:12px;font-size:14px;white-space:pre-wrap;margin:14px 0}
.send{display:block;width:100%;padding:18px;border:0;border-radius:14px;background:#25d366;color:#fff;font-size:20px;font-weight:700;text-align:center;text-decoration:none}
.row{display:flex;gap:8px;margin-top:10px}.row>*{flex:1;padding:12px;border-radius:10px;border:0;background:#e8e8e8;color:#222;font-size:15px;text-align:center;text-decoration:none}
.lang button{border:0;padding:6px 12px;border-radius:8px;background:#e8e8e8}.lang .on{background:#222;color:#fff}
.warn{background:#fff3cd;color:#664d03;padding:12px;border-radius:10px;margin-bottom:12px;font-size:14px}
.call{background:#1565c0!important;color:#fff!important}
</style></head><body><div class="w">
<div class="top"><span>Сегодня: <b id="t">0</b> / 25</span><span class="lang"><button id="laz">AZ</button> <button id="lru">RU</button></span></div>
<div class="bar"><i id="b"></i></div>
<div id="app"></div>
<p class="muted" style="text-align:center;margin-top:16px">Осталось в очереди: <b id="left">0</b> · <a href="#" id="undo">вернуть последнего</a></p>
</div>
<script>
const L=__DATA__,LIM=25,day=new Date().toISOString().slice(0,10);
let st={sent:{},lang:'az',last:[]};try{st=Object.assign(st,JSON.parse(localStorage.getItem('q1')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('q1',JSON.stringify(st))}catch(e){}};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function done(id,how){st.sent[id]=how+':'+day;st.last.push(id);save();setTimeout(draw,300)}
function draw(){
 const today=Object.values(st.sent).filter(v=>v==='sent:'+day).length;
 document.getElementById('t').textContent=today;document.getElementById('b').style.width=Math.min(100,today/LIM*100)+'%';
 document.getElementById('laz').className=st.lang=='az'?'on':'';document.getElementById('lru').className=st.lang=='ru'?'on':'';
 const q=L.filter(x=>!st.sent[x.id]);document.getElementById('left').textContent=q.length;
 const app=document.getElementById('app');
 if(!q.length){app.innerHTML='<div class="card"><h1>Очередь пуста 🎉</h1><p class="muted">Новые бизнесы появятся завтра утром.</p></div>';return}
 const x=q[0],m=st.lang=='az'?x.az:x.ru;
 const warn=today>=LIM?'<div class="warn">Сегодня уже '+today+'. Больше 25 в день не надо, иначе WhatsApp может забанить номер. Продолжи завтра.</div>':'';
 const btn=x.wa?'<a class="send" id="go" target="_blank" href="https://wa.me/'+x.wa+'?text='+encodeURIComponent(m)+'">Отправить в WhatsApp</a>'
   :'<a class="send call" id="go" href="tel:'+esc(x.p)+'">Нет WhatsApp, позвонить</a>';
 app.innerHTML=warn+'<div class="card"><h1>'+esc(x.n)+'</h1><p class="muted">'+esc(x.c)+' · '+(x.r?esc(x.r)+'★ ('+x.rv+')':'без рейтинга')+' · сайт: '+esc(x.s)+'</p><p class="muted">'+esc(x.a)+'</p>'
  +'<div class="msg">'+esc(m)+'</div>'+btn
  +'<div class="row"><a href="'+esc(x.d)+'" target="_blank">Демо</a><a href="'+esc(x.m)+'" target="_blank">Карта</a><button id="skip">Пропустить</button></div></div>';
 document.getElementById('go').onclick=()=>done(x.id,'sent');
 document.getElementById('skip').onclick=()=>done(x.id,'skip');
}
document.getElementById('laz').onclick=()=>{st.lang='az';save();draw()};
document.getElementById('lru').onclick=()=>{st.lang='ru';save();draw()};
document.getElementById('undo').onclick=e=>{e.preventDefault();const id=st.last.pop();if(id){delete st.sent[id];save();draw()}};
draw();
</script></body></html>""".replace("__DATA__", data)


# ---------- главное ----------

def load_json(path, default):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def site_base_url(cfg):
    if cfg.get("site_url"):
        return cfg["site_url"].rstrip("/") + "/"
    repo = os.environ.get("GITHUB_REPOSITORY")  # в GitHub Actions: "user/repo"
    if repo:
        owner, name = repo.split("/")
        return f"https://{owner.lower()}.github.io/{name}/"
    return ""  # локально: ссылки относительно папки docs (клиенту такую не отправишь)


def backfill(leads, api_key, limit, budget, refetch_photos=False):
    """Подтягивает фото/часы/отзывы старым лидам (лучшие первыми). Возвращает число запросов."""
    order = sorted(leads.values(), key=lambda l: (bool(l["wa"]), l["reviews"] or 0), reverse=True)
    done = 0
    for lead in order:
        if done >= limit:
            break
        if lead.get("custom_site"):
            continue
        need = not lead.get("enriched") or (refetch_photos and "photos" not in lead)
        if not need:
            continue
        try:
            p = fc.get_details(api_key, lead["id"])
        except fc.DailyQuota as e:
            print(" ", e, "- остальных догоню в следующие дни")
            break
        done += 1
        if p:
            enrich(lead, p, api_key, budget)
            write_demo(lead)
    return done


def rebuild(db, cfg, details_limit):
    """Перегенерирует все демо. Старым лидам подтягивает данные из Google (не больше details_limit запросов)."""
    leads = db["leads"]
    done = 0
    if details_limit:
        budget = {"photos": cfg.get("photo_budget_rebuild", 600)}
        done = backfill(leads, fc.load_api_key(), details_limit, budget, refetch_photos=True)
    for lead in leads.values():
        write_demo(lead)
    print(f"Перегенерировано: {len(leads)} демо, запросов подробностей: {done}")


def main():
    global PRICE, PHOTOS_PER_LEAD
    cfg = load_json(CONFIG, {})
    PRICE = cfg.get("price", "50 AZN")
    PHOTOS_PER_LEAD = cfg.get("photos_per_lead", 4)
    db = load_json(DATA, {"leads": {}, "cursor": 0})
    leads = db["leads"]

    # чистка: лиды не из Азербайджана (кроме вручную добавленных с личным сообщением)
    for lid in [k for k, l in leads.items() if not in_azerbaijan(l["address"]) and not l.get("msg")]:
        print("Убираю (не Азербайджан):", leads[lid]["name"], "·", leads[lid]["address"])
        shutil.rmtree(os.path.join(DOCS, "sites", leads[lid]["slug"]), ignore_errors=True)
        del leads[lid]

    if "--rebuild" in sys.argv:
        i = sys.argv.index("--rebuild")
        limit = int(sys.argv[i + 1]) if len(sys.argv) > i + 1 and sys.argv[i + 1].isdigit() else 0
        rebuild(db, cfg, limit)
        save_json(DATA, db)
        write_queue(cfg, leads)
        return

    # каждый день берём следующие N пар «город + категория», по кругу
    hunt = "--hunt" in sys.argv  # большой разовый поиск: все категории, больше страниц (для автописем)
    cats = cfg.get("categories", fc.DEFAULT_CATEGORIES) + (cfg.get("hunt_extra_categories", []) if hunt else [])
    pairs = [(c, k) for c in cfg.get("cities", ["Bakı"]) for k in cats]
    nearby = "--nearby" in sys.argv  # поиск по точкам карты Баку (другой лимит Google)
    if nearby:
        grid = [(round(40.34 + i * 0.045, 3), round(49.76 + j * 0.06, 3)) for i in range(4) for j in range(5)]
        types = list(NEARBY_TYPES)
        pairs = [(pt, t) for t in types for pt in grid]
        start = db.get("nearby_cursor", 0) % len(pairs)
        todo, pages = pairs[start:] + pairs[:start], 1
        hunt, hunt_max = True, cfg.get("hunt_max_searches", 80)
    elif hunt:  # идём по кругу с места, где остановились в прошлый раз
        start = db.get("hunt_cursor", 0) % len(pairs)
        todo, pages = pairs[start:] + pairs[:start], cfg.get("hunt_pages", 3)
        hunt_max = cfg.get("hunt_max_searches", 80)
    else:
        n = min(cfg.get("searches_per_run", 10), len(pairs))
        start = db["cursor"] % len(pairs)
        todo = [pairs[(start + i) % len(pairs)] for i in range(n)]
        db["cursor"] = start + n
        pages = cfg.get("pages", 1)

    api_key = fc.load_api_key()
    base = site_base_url(cfg)
    today = datetime.now().strftime("%Y-%m-%d")
    budget = {"photos": cfg.get("photo_budget_per_run", 40)}
    new = 0
    for city, cat in todo:
        if fc.QUOTA_HIT or (hunt and fc.SEARCHES + pages > hunt_max):
            break
        if nearby:
            db["nearby_cursor"] = db.get("nearby_cursor", 0) + 1
            found = fc.find_nearby(api_key, city[0], city[1], cat, cfg.get("lang", "ru"))
            city, cat = "Bakı", NEARBY_TYPES[cat]
        else:
            if hunt:
                db["hunt_cursor"] = db.get("hunt_cursor", 0) + 1
            found = fc.find_places(api_key, city, [cat], pages, cfg.get("lang", "ru"))
        for p in found:
            if p["id"] in leads or p.get("businessStatus") not in (None, "OPERATIONAL"):
                continue
            site, label = fc.classify_site(p.get("websiteUri"))
            if site == "есть":
                continue
            addr = p.get("formattedAddress", "")
            if addr and not in_azerbaijan(addr):
                continue  # Google иногда отдаёт места из других стран (напр. «Кафе Баку» в Казахстане)
            name = (p.get("displayName") or {}).get("text", "")
            lead = {
                "id": p["id"], "name": name, "slug": make_slug(name, p["id"]),
                "query": cat, "city": city,
                "category": (p.get("primaryTypeDisplayName") or {}).get("text") or cat,
                "phone": p.get("internationalPhoneNumber") or p.get("nationalPhoneNumber", ""),
                "wa": fc.whatsapp_number(p.get("internationalPhoneNumber"), p.get("nationalPhoneNumber")),
                "address": p.get("formattedAddress", ""), "rating": p.get("rating", ""),
                "reviews": p.get("userRatingCount", 0), "maps": p.get("googleMapsUri", ""),
                "site": label or "нет", "site_url": p.get("websiteUri", ""), "added": today,
            }
            leads[lead["id"]] = lead
            enrich(lead, p, api_key, budget)
            write_demo(lead)
            new += 1

    # заодно понемногу дообогащаем старых лидов (лимит Google на Place Details в день невелик)
    filled = 0 if hunt else backfill(leads, api_key, cfg.get("backfill_per_run", 40), budget)

    save_json(DATA, db)
    write_queue(cfg, leads)
    print(f"\nНовых бизнесов: {new}. Дообогащено старых: {filled}. Всего в базе: {len(leads)}.")


def write_queue(cfg, leads):
    base = site_base_url(cfg)
    os.makedirs(DOCS, exist_ok=True)
    queue_name = cfg.get("queue_file", "ochered.html")
    with open(os.path.join(DOCS, queue_name), "w", encoding="utf-8") as f:
        f.write(render_queue(leads, base))
    open(os.path.join(DOCS, ".nojekyll"), "w").close()
    print(f"Очередь: {os.path.join(DOCS, queue_name)}")
    if base.startswith("http"):
        print(f"Онлайн: {base}{queue_name}")


PRICE = "50 AZN"
PHOTOS_PER_LEAD = 4
NEARBY_TYPES = {
    "beauty_salon": "салон красоты", "barber_shop": "барбершоп", "nail_salon": "маникюр",
    "hair_salon": "салон красоты", "car_repair": "автосервис", "car_wash": "автомойка", "dentist": "стоматология",
    "cafe": "кафе", "bakery": "пекарня", "gym": "фитнес клуб", "florist": "цветочный магазин",
    "veterinary_care": "ветеринарная клиника", "spa": "салон красоты", "restaurant": "кафе",
}
COUNTRY_WORDS = ("Азербайджан", "Azerbaijan", "Azərbaycan")

if __name__ == "__main__":
    main()

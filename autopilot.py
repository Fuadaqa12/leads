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
import urllib.parse
from datetime import datetime

import find_clients as fc

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "docs")            # эта папка публикуется на GitHub Pages
DATA = os.path.join(HERE, "data", "leads.json")
CONFIG = os.path.join(HERE, "config.json")

# ---------- темы демо-сайтов по типу бизнеса ----------

THEMES = {
    "beauty": {
        "keys": ["салон", "барбер", "маникюр", "beauty", "barber", "nail", "spa", "gözəllik"],
        "color": "#c2185b", "icon": "💇",
        "az": {"tag": "Gözəlliyiniz bizim işimizdir", "services": ["Saç kəsimi və düzümü", "Manikür və pedikür", "Boyama", "Qaş və kirpik"]},
        "ru": {"tag": "Ваша красота — наша работа", "services": ["Стрижки и укладки", "Маникюр и педикюр", "Окрашивание", "Брови и ресницы"]},
    },
    "auto": {
        "keys": ["авто", "шином", "мойк", "car", "auto", "tire"],
        "color": "#1565c0", "icon": "🚗",
        "az": {"tag": "Avtomobiliniz etibarlı əllərdə", "services": ["Diaqnostika", "Mühərrik təmiri", "Təkər xidməti", "Yağ dəyişmə"]},
        "ru": {"tag": "Ваш автомобиль в надёжных руках", "services": ["Диагностика", "Ремонт двигателя", "Шиномонтаж", "Замена масла"]},
    },
    "food": {
        "keys": ["кафе", "пекар", "кондит", "доставк", "ресторан", "cafe", "bakery", "restaurant", "food"],
        "color": "#e65100", "icon": "🍽️",
        "az": {"tag": "Dadlı yemək, isti münasibət", "services": ["Səhər yeməyi", "Nahar menyusu", "Şirniyyat və desertlər", "Çatdırılma"]},
        "ru": {"tag": "Вкусная еда и тёплая атмосфера", "services": ["Завтраки", "Бизнес-ланч", "Десерты и выпечка", "Доставка"]},
    },
    "health": {
        "keys": ["стомат", "ветерин", "клиник", "dental", "clinic", "vet"],
        "color": "#00897b", "icon": "🩺",
        "az": {"tag": "Sağlamlığınız üçün peşəkar qayğı", "services": ["Müayinə və məsləhət", "Müalicə", "Profilaktika", "Onlayn qeydiyyat"]},
        "ru": {"tag": "Профессиональная забота о здоровье", "services": ["Осмотр и консультация", "Лечение", "Профилактика", "Онлайн-запись"]},
    },
    "default": {
        "keys": [],
        "color": "#37474f", "icon": "⭐",
        "az": {"tag": "Keyfiyyətli xidmət, sərfəli qiymət", "services": ["Peşəkar xidmət", "Sürətli icra", "Sərfəli qiymətlər", "Zəmanət"]},
        "ru": {"tag": "Качественный сервис по доступной цене", "services": ["Профессиональный подход", "Быстрое выполнение", "Доступные цены", "Гарантия"]},
    },
}


def pick_theme(text):
    t = (text or "").lower()
    for name, th in THEMES.items():
        if any(k in t for k in th["keys"]):
            return th
    return THEMES["default"]


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


# ---------- демо-сайт ----------

def render_demo(lead):
    e = html.escape
    th = pick_theme(lead["query"] + " " + lead["category"])
    wa = lead["wa"]
    maps_q = urllib.parse.quote(f'{lead["name"]}, {lead["address"]}')
    rating = f'⭐ {lead["rating"]} · {lead["reviews"]}' if lead["rating"] else ""

    def block(lang):
        d = th[lang]
        L = {
            "az": {"banner": "Bu saytın sadə demo versiyasıdır. Tam versiyanı da edə bilərik: öz domen, qalereya, onlayn qeydiyyat.",
                   "call": "Zəng et", "write": "WhatsApp-a yaz", "serv": "Xidmətlər", "contacts": "Əlaqə",
                   "addr": "Ünvan", "phone": "Telefon", "reviews": "rəy Google-da"},
            "ru": {"banner": "Это лёгкая демо-версия сайта. Можем сделать полноценный: свой домен, галерея, онлайн-запись.",
                   "call": "Позвонить", "write": "Написать в WhatsApp", "serv": "Услуги", "contacts": "Контакты",
                   "addr": "Адрес", "phone": "Телефон", "reviews": "отзывов в Google"},
        }[lang]
        services = "".join(f"<div class='card'>{th['icon']} {e(s)}</div>" for s in d["services"])
        wa_btn = f"<a class='btn' href='https://wa.me/{wa}'>{L['write']}</a>" if wa else ""
        call_btn = f"<a class='btn ghost' href='tel:{e(lead['phone'])}'>{L['call']}</a>" if lead["phone"] else ""
        return f"""<div class="lang" data-lang="{lang}">
<div class="banner">{L['banner']}</div>
<header><div class="wrap">
<div class="icon">{th['icon']}</div>
<h1>{e(lead['name'])}</h1>
<p class="tag">{e(d['tag'])}</p>
<p class="rate">{e(rating)} {L['reviews'] if rating else ''}</p>
<div class="btns">{wa_btn}{call_btn}</div>
</div></header>
<section class="wrap"><h2>{L['serv']}</h2><div class="grid">{services}</div></section>
<section class="wrap"><h2>{L['contacts']}</h2>
<p><b>{L['addr']}:</b> {e(lead['address'])}</p>
<p><b>{L['phone']}:</b> {e(lead['phone'])}</p>
<iframe loading="lazy" src="https://www.google.com/maps?q={maps_q}&output=embed"></iframe>
</section></div>"""

    return f"""<!doctype html><html lang="az"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(lead['name'])}</title><meta name="robots" content="noindex">
<style>
:root{{--c:{th['color']}}}*{{box-sizing:border-box}}
body{{margin:0;font-family:system-ui,-apple-system,sans-serif;color:#222;background:#fafafa}}
.wrap{{max-width:900px;margin:0 auto;padding:24px 16px}}
.banner{{background:#fff3cd;color:#664d03;text-align:center;padding:10px 16px;font-size:14px}}
header{{background:var(--c);color:#fff;text-align:center}}header .wrap{{padding:56px 16px}}
.icon{{font-size:56px}}h1{{font-size:clamp(28px,6vw,44px);margin:8px 0}}.tag{{font-size:18px;opacity:.9}}.rate{{opacity:.85}}
.btns{{margin-top:20px}}.btn{{display:inline-block;margin:6px;padding:12px 22px;border-radius:30px;background:#25d366;color:#fff;text-decoration:none;font-weight:600}}
.btn.ghost{{background:transparent;border:2px solid #fff}}
h2{{color:var(--c)}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}}
.card{{background:#fff;padding:18px;border-radius:12px;box-shadow:0 1px 4px #0001}}
iframe{{width:100%;height:300px;border:0;border-radius:12px}}
.sw{{position:fixed;top:64px;right:12px;z-index:9}}.sw button{{border:0;padding:6px 10px;border-radius:6px;cursor:pointer}}
.lang{{display:none}}.lang.on{{display:block}}
footer{{text-align:center;color:#888;font-size:13px;padding:24px}}
</style></head><body>
<div class="sw"><button onclick="sw('az')">AZ</button> <button onclick="sw('ru')">RU</button></div>
{block('az')}{block('ru')}
<footer>© {datetime.now().year} {e(lead['name'])}</footer>
<script>function sw(l){{document.querySelectorAll('.lang').forEach(x=>x.classList.toggle('on',x.dataset.lang==l))}}sw('az')</script>
</body></html>"""


# ---------- сообщения ----------

def make_messages(lead, demo_url):
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


def main():
    global PRICE
    cfg = load_json(CONFIG, {})
    PRICE = cfg.get("price", "50 AZN")
    db = load_json(DATA, {"leads": {}, "cursor": 0})
    leads = db["leads"]

    # каждый день берём следующие N пар «город + категория», по кругу
    pairs = [(c, k) for c in cfg.get("cities", ["Bakı"]) for k in cfg.get("categories", fc.DEFAULT_CATEGORIES)]
    n = min(cfg.get("searches_per_run", 10), len(pairs))
    start = db["cursor"] % len(pairs)
    todo = [pairs[(start + i) % len(pairs)] for i in range(n)]
    db["cursor"] = start + n

    api_key = fc.load_api_key()
    base = site_base_url(cfg)
    today = datetime.now().strftime("%Y-%m-%d")
    new = 0
    for city, cat in todo:
        for p in fc.find_places(api_key, city, [cat], cfg.get("pages", 1), cfg.get("lang", "ru")):
            if p["id"] in leads or p.get("businessStatus") not in (None, "OPERATIONAL"):
                continue
            site, label = fc.classify_site(p.get("websiteUri"))
            if site == "есть":
                continue
            name = (p.get("displayName") or {}).get("text", "")
            lead = {
                "id": p["id"], "name": name, "slug": make_slug(name, p["id"]),
                "query": cat, "city": city,
                "category": (p.get("primaryTypeDisplayName") or {}).get("text") or cat,
                "phone": p.get("internationalPhoneNumber") or p.get("nationalPhoneNumber", ""),
                "wa": fc.whatsapp_number(p.get("internationalPhoneNumber"), p.get("nationalPhoneNumber")),
                "address": p.get("formattedAddress", ""), "rating": p.get("rating", ""),
                "reviews": p.get("userRatingCount", 0), "maps": p.get("googleMapsUri", ""),
                "site": label or "нет", "added": today,
            }
            leads[lead["id"]] = lead
            d = os.path.join(DOCS, "sites", lead["slug"])
            os.makedirs(d, exist_ok=True)
            with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as f:
                f.write(render_demo(lead))
            new += 1

    save_json(DATA, db)
    os.makedirs(DOCS, exist_ok=True)
    queue_name = cfg.get("queue_file", "ochered.html")
    with open(os.path.join(DOCS, queue_name), "w", encoding="utf-8") as f:
        f.write(render_queue(leads, base))
    open(os.path.join(DOCS, ".nojekyll"), "w").close()
    print(f"\nНовых бизнесов: {new}. Всего в базе: {len(leads)}.")
    print(f"Очередь: {os.path.join(DOCS, queue_name)}")
    if base.startswith("http"):
        print(f"Онлайн: {base}{queue_name}")


PRICE = "50 AZN"

if __name__ == "__main__":
    main()

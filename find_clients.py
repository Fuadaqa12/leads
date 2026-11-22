#!/usr/bin/env python3
"""
Поиск клиентов: малый бизнес без сайта (или только с Instagram) через официальный Google Places API.

Запуск:
    python find_clients.py                       # Баку, стандартный список категорий
    python find_clients.py --city "Sumqayıt"     # другой город
    python find_clients.py --categories "барбершоп,автосервис" --pages 3

Результат: папка results/ с файлами leads.csv (для Excel) и leads.html (открыть в браузере,
там кнопки WhatsApp с готовым текстом). Сообщения НЕ отправляются автоматически.

Нужен только Python 3.8+, ничего устанавливать не надо.
"""

import argparse
import csv
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

API_URL = "https://places.googleapis.com/v1/places:searchText"
FIELDS = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
    "places.googleMapsUri",
    "places.primaryTypeDisplayName",
    "places.businessStatus",
    # для красивого демо-сайта: координаты, часы, фото, отзывы, описание
    "places.location",
    "places.regularOpeningHours",
    "places.photos",
    "places.reviews",
    "places.editorialSummary",
    "places.addressComponents",
    "places.addressDescriptor",
    "places.paymentOptions",
    "places.parkingOptions",
    "places.accessibilityOptions",
    "places.delivery",
    "places.takeout",
    "places.outdoorSeating",
    "places.goodForChildren",
    "places.reservable",
    "places.servesBreakfast",
    "nextPageToken",
])

DETAILS_FIELDS = ",".join(f.split(".", 1)[1] for f in FIELDS.split(",") if f.startswith("places."))

# Прямоугольник вокруг Азербайджана: Google иногда отдаёт «Кафе Баку» из Казахстана и т.п.
AZ_BOX = {"rectangle": {"low": {"latitude": 38.3, "longitude": 44.7},
                        "high": {"latitude": 41.95, "longitude": 50.9}}}

DEFAULT_CATEGORIES = [
    "салон красоты", "барбершоп", "маникюр", "автосервис", "шиномонтаж", "автомойка",
    "стоматология", "кафе", "пекарня", "кондитерская", "фитнес клуб", "цветочный магазин",
    "химчистка", "ремонт телефонов", "мебель на заказ", "ветеринарная клиника",
    "фотостудия", "курсы английского", "ремонт квартир", "доставка еды",
]

# Если "сайт" в Google — это просто соцсеть или ссылка-визитка, считаем, что сайта нет.
WEAK_SITE_DOMAINS = {
    "instagram.com": "Instagram", "facebook.com": "Facebook", "fb.com": "Facebook",
    "wa.me": "WhatsApp", "whatsapp.com": "WhatsApp", "tiktok.com": "TikTok",
    "linktr.ee": "Linktree", "taplink.cc": "Taplink", "taplink.at": "Taplink",
    "t.me": "Telegram", "business.site": "старая Google-визитка", "youtube.com": "YouTube",
}

# Мобильные коды Азербайджана (на них есть WhatsApp). 12 = городской Баку.
AZ_MOBILE_CODES = ("50", "51", "55", "60", "70", "77", "99", "10")


# ---------- ключ API ----------

def load_api_key():
    key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    if key:
        return key
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "api_key.txt")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            key = f.read().strip()
        if key and "ВСТАВЬ" not in key:
            return key
    sys.exit(
        "Нет ключа Google API.\n"
        "Создай файл api_key.txt рядом со скриптом и вставь туда ключ (одной строкой).\n"
        "Как получить ключ — в файле КАК_ЗАПУСТИТЬ.md"
    )


# ---------- запросы к Google ----------

def search_text(api_key, query, language, page_token=None):
    body = {"textQuery": query, "languageCode": language, "pageSize": 20,
            "locationRestriction": AZ_BOX}
    if page_token:
        body["pageToken"] = page_token
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": FIELDS,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        sys.exit(f"Ошибка Google API ({e.code}):\n{detail}\n\n"
                 "Чаще всего: не включён 'Places API (New)' или не привязана карта к Billing.")


class DailyQuota(Exception):
    pass


def get_details(api_key, place_id, language="ru"):
    """Подробности одного места (для старых лидов, у которых нет фото/часов/отзывов)."""
    url = f"https://places.googleapis.com/v1/places/{place_id}?languageCode={language}"
    req = urllib.request.Request(url, headers={"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": DETAILS_FIELDS})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            if e.code == 429 and "per day" in body:
                raise DailyQuota("дневной лимит Place Details исчерпан")
            if e.code == 429 and attempt < 4:  # лимит запросов в минуту — ждём и повторяем
                time.sleep(15 * (attempt + 1))
                continue
            print(f"  details {place_id}: ошибка {e.code}")
            return None


def download_photo(api_key, photo_name, path, max_w=1200):
    """Скачивает фото места (Places Photo API) и ужимает в JPEG. True, если получилось."""
    url = (f"https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx={max_w}&key="
           + urllib.parse.quote(api_key))
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            raw = resp.read()
    except Exception as e:  # noqa: BLE001
        print(f"  фото не скачалось: {e}")
        return False
    try:  # Pillow необязателен: если есть — пережимаем, чтобы репозиторий не пух
        import io
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        im.thumbnail((max_w, max_w))
        im.save(path, "JPEG", quality=72, optimize=True, progressive=True)
    except Exception:  # noqa: BLE001
        with open(path, "wb") as f:
            f.write(raw)
    return True


def find_places(api_key, city, categories, pages, language):
    seen = {}
    for cat in categories:
        query = f"{cat} {city}"
        token = None
        for page in range(pages):
            data = search_text(api_key, query, language, token)
            places = data.get("places", [])
            for p in places:
                if p.get("id") and p["id"] not in seen:
                    p["_category_query"] = cat
                    seen[p["id"]] = p
            print(f"  {query!r}, стр. {page + 1}: {len(places)} мест")
            token = data.get("nextPageToken")
            if not token:
                break
            time.sleep(2)  # токен следующей страницы активируется не сразу
    return list(seen.values())


# ---------- обработка ----------

def classify_site(url):
    """Возвращает (статус, пояснение): нет / только соцсеть / есть."""
    if not url:
        return "нет", ""
    host = urllib.parse.urlparse(url).netloc.lower()
    host = host[4:] if host.startswith("www.") else host
    for dom, label in WEAK_SITE_DOMAINS.items():
        if host == dom or host.endswith("." + dom):
            return "только соцсеть", label
    return "есть", host


def whatsapp_number(intl_phone, national_phone):
    digits = re.sub(r"\D", "", intl_phone or "")
    if not digits:
        nd = re.sub(r"\D", "", national_phone or "")
        if nd.startswith("0") and len(nd) == 10:  # 050 123 45 67
            digits = "994" + nd[1:]
    if digits.startswith("994") and len(digits) == 12 and digits[3:5] in AZ_MOBILE_CODES:
        return digits
    if digits and not digits.startswith("994") and len(digits) >= 10:
        return digits  # зарубежный номер — пусть решает сам WhatsApp
    return ""


def make_messages(name, category, rating, reviews, site_status, site_label):
    if rating and reviews:
        stars_ru = f"У вас рейтинг {rating}★, отзывов: {reviews}. Это отлично. "
        stars_az = f"{rating}★ reytinqiniz və {reviews} rəyiniz var, bu əladır. "
    else:
        stars_ru = stars_az = ""

    if site_status == "только соцсеть":
        problem_ru = f"Но в Google вместо сайта стоит только {site_label}."
        problem_az = f"Amma Google-da sayt əvəzinə yalnız {site_label} var."
    else:
        problem_ru = "Но своего сайта у вас нет."
        problem_az = "Amma öz saytınız yoxdur."

    ru = (f"Здравствуйте! Нашёл «{name}» в Google Картах. {stars_ru}"
          f"{problem_ru} Люди, которые ищут {category} в Google, чаще идут к тем, у кого сайт есть.\n"
          f"Могу бесплатно сделать вам пример сайта: посмотрите и решите. "
          f"Если понравится, запущу под ключ за 50 AZN, с кнопкой WhatsApp и картой. Показать?")
    az = (f"Salam! «{name}»-i Google Xəritədə tapdım. {stars_az}"
          f"{problem_az} Google-da axtaran müştərilər adətən saytı olanlara gedir.\n"
          f"Sizə pulsuz nümunə sayt hazırlaya bilərəm: baxarsınız, sonra qərar verərsiniz. "
          f"Xoşunuza gəlsə, 50 AZN-ə tam hazır edərəm, WhatsApp düyməsi və xəritə ilə. Göstərim?")
    return ru, az


def build_rows(places, include_with_site):
    rows = []
    for p in places:
        if p.get("businessStatus") not in (None, "OPERATIONAL"):
            continue
        site_status, site_label = classify_site(p.get("websiteUri"))
        if site_status == "есть" and not include_with_site:
            continue
        name = (p.get("displayName") or {}).get("text", "")
        category = (p.get("primaryTypeDisplayName") or {}).get("text") or p.get("_category_query", "")
        rating = p.get("rating", "")
        reviews = p.get("userRatingCount", 0)
        wa = whatsapp_number(p.get("internationalPhoneNumber"), p.get("nationalPhoneNumber"))
        msg_ru, msg_az = make_messages(name, p.get("_category_query", category), rating, reviews,
                                       site_status, site_label)
        rows.append({
            "Название": name,
            "Категория": category,
            "Телефон": p.get("internationalPhoneNumber") or p.get("nationalPhoneNumber", ""),
            "WhatsApp": "да" if wa else "нет (городской/нет номера)",
            "Адрес": p.get("formattedAddress", ""),
            "Рейтинг": rating,
            "Отзывов": reviews,
            "Сайт": site_status,
            "Что вместо сайта": site_label,
            "Google Maps": p.get("googleMapsUri", ""),
            "WhatsApp ссылка (AZ)": f"https://wa.me/{wa}?text={urllib.parse.quote(msg_az)}" if wa else "",
            "WhatsApp ссылка (RU)": f"https://wa.me/{wa}?text={urllib.parse.quote(msg_ru)}" if wa else "",
            "Сообщение AZ": msg_az,
            "Сообщение RU": msg_ru,
            "Статус": "",  # заполняешь сам: написал / ответил / клиент / отказ
        })
    # сначала те, у кого есть WhatsApp и больше отзывов (живой бизнес, легче продать)
    rows.sort(key=lambda r: (r["WhatsApp"] != "да", -(r["Отзывов"] or 0)))
    return rows


# ---------- сохранение ----------

def save_csv(rows, path):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:  # utf-8-sig — чтобы Excel не ломал кириллицу
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), delimiter=";")
        w.writeheader()
        w.writerows(rows)


def save_html(rows, path, title):
    e = html.escape
    trs = []
    for i, r in enumerate(rows, 1):
        btns = ""
        if r["WhatsApp ссылка (AZ)"]:
            btns = (f'<a class="b wa" href="{e(r["WhatsApp ссылка (AZ)"])}" target="_blank">WhatsApp AZ</a>'
                    f'<a class="b wa" href="{e(r["WhatsApp ссылка (RU)"])}" target="_blank">WhatsApp RU</a>')
        trs.append(f"""<tr>
<td>{i}</td>
<td><b>{e(r["Название"])}</b><br><small>{e(r["Категория"])}</small><br><small>{e(r["Адрес"])}</small></td>
<td>{e(str(r["Рейтинг"]))}★<br><small>{e(str(r["Отзывов"]))} отз.</small></td>
<td>{e(r["Сайт"])}<br><small>{e(r["Что вместо сайта"])}</small></td>
<td>{e(r["Телефон"])}<br>{btns}<a class="b" href="{e(r["Google Maps"])}" target="_blank">Карта</a></td>
<td><details><summary>текст</summary><p>{e(r["Сообщение AZ"])}</p><p>{e(r["Сообщение RU"])}</p></details></td>
<td><input type="checkbox" title="написал"></td>
</tr>""")
    page = f"""<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title>
<style>
body{{font-family:system-ui,sans-serif;margin:16px;background:#fff;color:#222}}
table{{border-collapse:collapse;width:100%}}td,th{{border-bottom:1px solid #ddd;padding:8px;vertical-align:top;font-size:14px}}
th{{text-align:left;background:#f4f4f4;position:sticky;top:0}}small{{color:#666}}
.b{{display:inline-block;margin:4px 4px 0 0;padding:4px 8px;border-radius:6px;background:#eee;color:#222;text-decoration:none;font-size:13px}}
.wa{{background:#25d366;color:#fff}}p{{white-space:pre-wrap;max-width:420px}}
</style></head><body>
<h2>{e(title)}</h2>
<p>Нажми «WhatsApp», проверь текст и отправь сам. Пиши не больше 20–30 новым людям в день, иначе WhatsApp может забанить номер.</p>
<table><tr><th>#</th><th>Бизнес</th><th>Рейтинг</th><th>Сайт</th><th>Контакты</th><th>Сообщение</th><th>✓</th></tr>
{''.join(trs)}
</table></body></html>"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(page)


def main():
    ap = argparse.ArgumentParser(description="Найти бизнесы без сайта через Google Places API")
    ap.add_argument("--city", default="Bakı", help="город (по умолчанию Bakı)")
    ap.add_argument("--categories", help="категории через запятую (по умолчанию — встроенный список)")
    ap.add_argument("--pages", type=int, default=1, choices=[1, 2, 3],
                    help="страниц по 20 мест на каждую категорию (1–3)")
    ap.add_argument("--lang", default="ru", help="язык ответа Google: ru / az / en")
    ap.add_argument("--all", action="store_true", help="показывать и тех, у кого сайт уже есть")
    args = ap.parse_args()

    api_key = load_api_key()
    cats = [c.strip() for c in args.categories.split(",")] if args.categories else DEFAULT_CATEGORIES
    print(f"Ищу в городе {args.city}: {len(cats)} категорий, до {args.pages * 20} мест в каждой "
          f"(примерно {len(cats) * args.pages} запросов к API)\n")

    places = find_places(api_key, args.city, cats, args.pages, args.lang)
    rows = build_rows(places, args.all)
    print(f"\nВсего найдено мест: {len(places)}. Подходящих (без нормального сайта): {len(rows)}")
    if not rows:
        print("Никого не нашёл. Попробуй другие категории или --pages 3.")
        return

    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "results")
    os.makedirs(out, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    slug = re.sub(r"\W+", "_", args.city.lower())
    csv_path = os.path.join(out, f"leads_{slug}_{stamp}.csv")
    html_path = os.path.join(out, f"leads_{slug}_{stamp}.html")
    save_csv(rows, csv_path)
    save_html(rows, html_path, f"Клиенты: {args.city} ({len(rows)})")
    print(f"Готово:\n  {csv_path}\n  {html_path}  <- открой в браузере")


if __name__ == "__main__":
    main()

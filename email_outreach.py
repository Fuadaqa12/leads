#!/usr/bin/env python3
"""
Автописьма лидам: одно короткое личное письмо со ссылкой на демо-сайт раз в 30-45 минут.

  python email_outreach.py find [N]   # поискать email у N лидов (Instagram / Facebook / Taplink из Google)
  python email_outreach.py send       # отправить одно письмо, если пора (иначе ничего не делает)
  python email_outreach.py preview    # показать, какое письмо уйдёт следующим (ничего не отправляет)

Без секрета GMAIL_APP_PASSWORD отправка выключена: скрипт просто выходит.
Одному адресу пишем максимум один раз (адреса хранятся в data/emails.json).
Свои адреса можно добавить вручную в data/emails_manual.csv (place_id или имя бизнеса;email).
"""

import csv
import html
import json
import os
import random
import re
import smtplib
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

HERE = os.path.dirname(os.path.abspath(__file__))
LEADS = os.path.join(HERE, "data", "leads.json")
STATE = os.path.join(HERE, "data", "emails.json")
MANUAL = os.path.join(HERE, "data", "emails_manual.csv")
CONFIG = os.path.join(HERE, "config.json")
DOCS = os.path.join(HERE, "docs")
BAKU = timezone(timedelta(hours=4))

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}")
BAD_EMAIL_PARTS = ("example.", "sentry", "wixpress", "noreply", "no-reply", "@instagram.", "@facebook.",
                   "@fb.", "@meta.", "@taplink.", "@linktr.ee", "@tiktok.", "@google.", "domain.", "email.com",
                   "yourmail", "@2x", "@3x")
BAD_EMAIL_ENDINGS = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".js", ".css")


# ---------- общие ----------

def load_json(path, default):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def load_state():
    st = load_json(STATE, {})
    st.setdefault("found", {})   # place_id -> {"email", "src"} или {"email": "", "checked": дата}
    st.setdefault("sent", {})    # email -> {"id", "name", "at"}
    st.setdefault("next_at", "")
    return st


def cfg():
    c = load_json(CONFIG, {})
    e = c.get("email", {})
    return {
        "price": c.get("price", "50 AZN"),
        "site_url": (c.get("site_url") or "https://fuadaqa12.github.io/leads/").rstrip("/") + "/",
        "from": e.get("from", "core.ai.care@gmail.com"),
        "from_name": e.get("from_name", "Fuad"),
        "min_gap": e.get("min_gap_minutes", 30),
        "max_gap": e.get("max_gap_minutes", 45),
        "per_day": e.get("per_day", 20),
        "hours": e.get("send_hours_baku", [9, 23]),
        "find_per_run": e.get("find_per_run", 4),
    }


# ---------- поиск email ----------

def clean_emails(text):
    text = html.unescape(urllib.parse.unquote(text or ""))
    out = []
    for m in EMAIL_RE.findall(text):
        e = m.strip(".").lower()
        if any(b in e for b in BAD_EMAIL_PARTS) or e.endswith(BAD_EMAIL_ENDINGS):
            continue
        if e not in out:
            out.append(e)
    return out


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ru,az;q=0.9,en;q=0.8"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(600_000).decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print(f"    {url}: {e}")
        return ""


def site_url_from_google(lead):
    """Ссылку, которую бизнес указал в Google (Instagram/Taplink...), берём из Places Details (одно поле)."""
    key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    if not key:
        p = os.path.join(HERE, "api_key.txt")
        key = open(p, encoding="utf-8").read().strip() if os.path.exists(p) else ""
    if not key:
        return None
    req = urllib.request.Request(f"https://places.googleapis.com/v1/places/{lead['id']}",
                                 headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": "websiteUri"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode()).get("websiteUri", "")
    except Exception as e:  # noqa: BLE001
        print(f"    Google details {lead['name']}: {e}")
        return None


def emails_from_page(url):
    """Публичная страница (Taplink, Linktree, Facebook, Instagram...): ищем mailto и адреса в тексте/описании."""
    page = fetch(url)
    if not page:
        return []
    found = clean_emails(" ".join(re.findall(r'mailto:([^"\'?>\s]+)', page, re.I)))
    for e in clean_emails(page):
        if e not in found:
            found.append(e)
    return found


def find(limit):
    leads = load_json(LEADS, {"leads": {}})["leads"]
    st = load_state()
    today = datetime.now(BAKU).strftime("%Y-%m-%d")
    # сначала те, у кого в Google есть хоть какая-то ссылка (соцсеть / визитка): там бывает почта
    todo = [l for l in leads.values() if l["id"] not in st["found"] and l.get("site", "нет") != "нет"]
    todo.sort(key=lambda l: (bool(l.get("wa")), l.get("reviews") or 0), reverse=True)
    got = 0
    for lead in todo[:limit]:
        url = lead.get("site_url")
        if url is None or url == "":
            url = site_url_from_google(lead)
            if url is None:
                print("  Нет ключа Google или ошибка: пропускаю поиск")
                break
            lead["site_url"] = url
        emails = emails_from_page(url) if url else []
        if emails:
            st["found"][lead["id"]] = {"email": emails[0], "src": url, "all": emails[:3]}
            got += 1
            print(f"  ✓ {lead['name']}: {emails[0]} ({url})")
        else:
            st["found"][lead["id"]] = {"email": "", "src": url, "checked": today}
            print(f"  · {lead['name']}: почты нет ({url})")
    # остальные (без ссылок в Google) помечаем, чтобы не крутить их каждый раз
    for l in leads.values():
        if l["id"] not in st["found"] and l.get("site", "нет") == "нет":
            st["found"][l["id"]] = {"email": "", "src": "", "checked": today}
    save_json(STATE, st)
    total = sum(1 for v in st["found"].values() if v.get("email"))
    print(f"Найдено новых адресов: {got}. Всего адресов: {total}. Осталось проверить: {max(0, len(todo) - limit)}")


def manual_emails(leads):
    """data/emails_manual.csv: «place_id или название;email» — адреса, которые Fuad нашёл сам."""
    out = {}
    if not os.path.exists(MANUAL):
        return out
    by_name = {l["name"].strip().lower(): l["id"] for l in leads.values()}
    with open(MANUAL, encoding="utf-8") as f:
        for row in csv.reader(f, delimiter=";"):
            if len(row) < 2 or row[0].startswith("#"):
                continue
            key, email = row[0].strip(), row[1].strip().lower()
            pid = key if key in leads else by_name.get(key.lower())
            if pid and EMAIL_RE.fullmatch(email):
                out[pid] = email
    return out


# ---------- письмо ----------

def demo_url(c, lead):
    return c["site_url"] + "sites/" + lead["slug"] + "/"


def compose(c, lead):
    n = lead["name"].strip()
    url = demo_url(c, lead)
    if lead.get("msg"):  # своё сообщение для особого клиента
        body = lead["msg"]
        subject = f"Сайт для «{n}»"
    else:
        body = (
            f"Salam! «{n}» üçün pulsuz kiçik sayt hazırladım, baxın: {url}\n"
            f"Bu sadə demo versiyadır. Bəyənsəniz, tam saytı edərik: öz domeniniz, Google-da görünmə, "
            f"WhatsApp düyməsi. Qiymət {c['price']}. Maraqlıdır?\n\n"
            f"Здравствуйте! Сделал бесплатно небольшой сайт для «{n}», ссылка выше. "
            f"Это лёгкая демо-версия. Если понравится, сделаем полноценный сайт: свой домен, видимость в Google, "
            f"кнопка WhatsApp. Цена {c['price']}. Интересно?"
        )
        subject = f"«{n}» üçün sayt / сайт для «{n}»"
    body += (f"\n\nFuad\n\n"
             f"Maraqlı deyilsə, sadəcə «yox» yazın, bir daha yazmaram.\n"
             f"Если неинтересно, ответьте «нет», больше писать не буду.")
    return subject, body


def candidates(st, leads):
    found = {pid: v["email"] for pid, v in st["found"].items() if v.get("email")}
    found.update(manual_emails(leads))
    sent = set(st["sent"])
    out, seen = [], set()
    for pid, email in found.items():
        lead = leads.get(pid)
        if not lead or email in sent or email in seen:
            continue
        if not os.path.exists(os.path.join(DOCS, "sites", lead["slug"], "index.html")):
            continue  # нет демо — нечего показывать
        seen.add(email)
        out.append((lead, email))
    out.sort(key=lambda x: (x[0].get("reviews") or 0), reverse=True)
    return out


def send():
    pwd = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "").strip()
    if not pwd:
        print("GMAIL_APP_PASSWORD не задан: отправка выключена.")
        return
    c = cfg()
    st = load_state()
    now = datetime.now(BAKU)
    if not (c["hours"][0] <= now.hour < c["hours"][1]):
        print(f"Сейчас {now:%H:%M} по Баку, вне окна {c['hours'][0]}:00–{c['hours'][1]}:00.")
        return
    if st["next_at"] and now < datetime.fromisoformat(st["next_at"]):
        print(f"Рано: следующее письмо после {st['next_at']}.")
        return
    today = now.strftime("%Y-%m-%d")
    sent_today = sum(1 for v in st["sent"].values() if v.get("at", "").startswith(today))
    if sent_today >= c["per_day"]:
        print(f"Сегодня уже {sent_today} писем, лимит {c['per_day']}.")
        return
    leads = load_json(LEADS, {"leads": {}})["leads"]
    queue = candidates(st, leads)
    if not queue:
        print("Некому писать: нет новых адресов. Поиск продолжится в следующих запусках.")
        return
    lead, to = queue[0]
    subject, body = compose(c, lead)
    msg = EmailMessage()
    msg["From"] = formataddr((c["from_name"], c["from"]))
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=False)
    msg["Message-ID"] = make_msgid(domain="gmail.com")
    msg["List-Unsubscribe"] = f"<mailto:{c['from']}?subject=unsubscribe>"
    msg.set_content(body)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=30) as s:
        s.login(c["from"], pwd)
        s.send_message(msg)
    st["sent"][to] = {"id": lead["id"], "name": lead["name"], "at": now.isoformat(timespec="minutes")}
    gap = random.randint(c["min_gap"], c["max_gap"])
    st["next_at"] = (now + timedelta(minutes=gap)).isoformat(timespec="minutes")
    save_json(STATE, st)
    print(f"Отправлено: {lead['name']} <{to}>. Сегодня: {sent_today + 1}. Следующее через {gap} мин. "
          f"В очереди ещё: {len(queue) - 1}")


def preview():
    c = cfg()
    st = load_state()
    leads = load_json(LEADS, {"leads": {}})["leads"]
    q = candidates(st, leads)
    print(f"Адресов в очереди: {len(q)}")
    if q:
        lead, to = q[0]
        subject, body = compose(c, lead)
        print(f"Кому: {to}\nТема: {subject}\n\n{body}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "send"
    if cmd == "find":
        find(int(sys.argv[2]) if len(sys.argv) > 2 else cfg()["find_per_run"])
    elif cmd == "preview":
        preview()
    else:
        send()

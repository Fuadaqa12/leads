// Еженедельный розыгрыш Telegram-подарка от создателя: топ-1 общего рейтинга.
// Первый розыгрыш 1 декабря 2026 в 20:00 по Баку, дальше каждый вторник в то же время.
import * as store from './store.js';

const FIRST = Date.UTC(2026, 11, 1, 16, 0, 0); // 20:00 Asia/Baku (UTC+4)
const WEEK = 7 * 24 * 3600 * 1000;

export function nextDraw(now = Date.now()) {
  if (now < FIRST) return FIRST;
  return FIRST + Math.ceil((now - FIRST) / WEEK) * WEEK;
}
// последний розыгрыш, время которого уже наступило (или 0)
function dueDraw(now) {
  if (now < FIRST) return 0;
  return FIRST + Math.floor((now - FIRST) / WEEK) * WEEK;
}
const dayKey = (t) => new Date(t + 4 * 3600 * 1000).toISOString().slice(0, 10);
const g = () => (store.meta.giveaway ||= { winners: [] });

// кто сейчас забирает подарок: топ-1 без создателя (он сам дарит)
export function leader(arena) {
  const x = arena.top().find(x => !x.p.creator && x.pct > 0);
  return x ? { id: x.p.id, name: x.p.name || 'Гонщик', pct: +x.pct.toFixed(1) } : null;
}

export function info(arena, now = Date.now()) {
  const w = g().winners;
  return { next: nextDraw(now), first: FIRST, leader: leader(arena), last: w[w.length - 1] || null, winners: w.slice(-5).reverse() };
}

// вызывается раз в минуту; возвращает победителя, если розыгрыш только что прошёл
export function check(arena, now = Date.now()) {
  const due = dueDraw(now);
  if (!due) return null;
  const key = dayKey(due);
  const st = g();
  if (st.winners.some(w => w.week === key) || st.skipped === key) return null;
  // если сервер лежал больше суток во время розыгрыша, не разыгрываем задним числом
  if (now - due > 24 * 3600 * 1000) { st.skipped = key; store.save(); return null; }
  const l = leader(arena);
  if (!l) { st.skipped = key; store.save(); return { week: key, none: true }; }
  const win = { week: key, ...l, at: now };
  st.winners.push(win);
  if (st.winners.length > 60) st.winners.shift();
  const p = store.findPlayer(l.id);
  if (p) store.giveMedal(p, 'gift:' + key, `🎁 Подарок от создателя, неделя ${key}`);
  store.save();
  return win;
}

export const fmtDate = (t) => {
  const d = new Date(t + 4 * 3600 * 1000);
  const M = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

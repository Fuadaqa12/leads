// Задания дня: три одинаковых для всех (чтобы с друзьями было с кем сравнить), меняются в полночь по Баку.
// Выполнил все три — медаль.
import * as store from './store.js';

export const POOL = [
  { id: 'gain5', text: 'Захвати 5% Говсан за день в онлайне', goal: 5, kind: 'gain', fmt: (n) => n.toFixed(1) + '%' },
  { id: 'gain10', text: 'Захвати 10% Говсан за день в онлайне', goal: 10, kind: 'gain', fmt: (n) => n.toFixed(1) + '%' },
  { id: 'kill3', text: 'Разбей 3 машины', goal: 3, kind: 'kill' },
  { id: 'kill5', text: 'Разбей 5 машин', goal: 5, kind: 'kill' },
  { id: 'power3', text: 'Подбери 3 бонуса на дорогах', goal: 3, kind: 'power' },
  { id: 'loop2', text: 'Захвати 2% одним кругом', goal: 1, kind: 'loop2' },
  { id: 'duel1', text: 'Выиграй дуэль', goal: 1, kind: 'duelwin' },
  { id: 'duelplay', text: 'Сыграй дуэль с другом', goal: 1, kind: 'duel' },
  { id: 'solo15', text: 'Захвати 15% в соло-гонке', goal: 1, kind: 'solo15' },
];

const today = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
function seedPick(date) {
  let h = 0; for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ids = POOL.map(q => q.id), out = [];
  // берём три задания разных видов
  while (out.length < 3) {
    h = (h * 1103515245 + 12345) >>> 0;
    const q = POOL[h % POOL.length];
    if (!out.some(x => x.kind === q.kind)) out.push(q);
  }
  return out;
}
export function todays() { return seedPick(today()); }

function state(p) {
  const d = today();
  if (p.q?.d !== d) p.q = { d, n: {}, done: [] };
  return p.q;
}

// продвинуть задания игрока; возвращает тексты только что выполненных
export function bump(p, kind, amount = 1) {
  const st = state(p), got = [];
  for (const q of todays()) {
    if (q.kind !== kind || st.done.includes(q.id)) continue;
    st.n[q.id] = (st.n[q.id] || 0) + amount;
    if (st.n[q.id] >= q.goal) { st.done.push(q.id); got.push('✅ Задание: ' + q.text); }
  }
  if (got.length && st.done.length === 3 && store.giveMedal(p, 'quests:' + st.d, `📋 Все задания дня ${st.d}`)) got.push('🏅 Все задания дня выполнены! +1 медаль');
  store.save(p);
  return got;
}

export function view(p) {
  const st = state(p);
  return todays().map(q => ({ text: q.text, done: st.done.includes(q.id), n: Math.min(q.goal, st.n[q.id] || 0), goal: q.goal, label: q.fmt ? `${q.fmt(Math.min(q.goal, st.n[q.id] || 0))} / ${q.fmt(q.goal)}` : `${Math.min(q.goal, st.n[q.id] || 0)}/${q.goal}` }));
}

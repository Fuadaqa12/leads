// Хранилище игроков: всё в памяти, а изменения сбрасываются в хранилище Durable Object
let db = { players: {}, chats: {}, meta: {} };
const dirtyPlayers = new Set();
let dirtyRest = false;

// Загрузка из storage (вызывается один раз при старте объекта)
export async function load(storage) {
  const all = await storage.list({ prefix: 'p:' });
  for (const [, v] of all) db.players[v.id] = v;
  db.chats = (await storage.get('chats')) || {};
  db.meta = (await storage.get('meta')) || {};
  meta = db.meta;
}
export async function flush(storage) {
  const batch = {};
  for (const id of dirtyPlayers) if (db.players[id]) batch['p:' + id] = db.players[id];
  dirtyPlayers.clear();
  if (dirtyRest) { batch.chats = db.chats; batch.meta = db.meta; dirtyRest = false; }
  const keys = Object.keys(batch);
  for (let i = 0; i < keys.length; i += 100) {
    const part = {};
    for (const k of keys.slice(i, i + 100)) part[k] = batch[k];
    await storage.put(part);
  }
}
export function save(p) { if (p && p.id) dirtyPlayers.add(p.id); else dirtyRest = true; }

// звание зависит от доли района, которой ты владеешь сейчас
export const TITLES = [
  [0, '🚶 Пешеход'], [1, '🛵 Курьер'], [3, '🚕 Таксист'], [7, '🏎 Гонщик'],
  [12, '🏘 Хозяин квартала'], [20, '👑 Король Говсан'], [35, '🐉 Легенда Говсан'],
];
export function titleFor(p, pct = 0) {
  if (p.creator) return '👑 Создатель Говсан';
  let t = TITLES[0][1];
  for (const [min, name] of TITLES) if (pct >= min) t = name;
  return t;
}

export const EGGS = {
  fish: { name: 'Свежая рыба', hint: 'Проедь мимо самой известной рыбной лавки Говсан' },
  parking: { name: 'Вы припарковались здесь', hint: 'Найди место, где Гугл запомнил твою тачку' },
  fuad_word: { name: 'Слово силы F-U-A-D', hint: 'Собери на дорогах четыре светящиеся буквы' },
  boss: { name: 'Встреча с Пиратом', hint: 'Перережь след или поглоти Пирата Fuadaqa12' },
  not_fuad: { name: 'Это точно был не Фуад', hint: 'Разбей одну подозрительную машину' },
  flag: { name: 'Чёрный флаг', hint: 'Логотип игры любит, когда по нему много тыкают' },
  pirate_cmd: { name: 'Пиратский кодекс', hint: 'Спроси у бота про пирата' },
  legend: { name: 'Легенда о Fuadaqa12', hint: 'Спроси у бота про создателя' },
};

export function getPlayer(user) {
  const id = String(user.id);
  let p = db.players[id];
  if (!p) {
    p = db.players[id] = {
      id, name: '', username: '', medals: 0, medalList: [], eggs: [], color: '',
      kills: 0, deaths: 0, bossKills: 0, soloBest: 0, created: Date.now(),
    };
  }
  if (user.first_name || user.name) p.name = (user.first_name || user.name).slice(0, 24);
  if (user.username !== undefined) p.username = user.username || '';
  p.creator = /^fuadaqa12$/i.test(p.username || '');
  save(p);
  return p;
}
export function findPlayer(id) { return db.players[String(id)] || null; }
export function allPlayers() { return Object.values(db.players); }

// Медаль выдаётся один раз за ключ. Возвращает true, если медаль новая.
export function giveMedal(p, key, label) {
  if (p.medalList.some(m => m.k === key)) return false;
  p.medalList.push({ k: key, l: label, t: Date.now() });
  p.medals = p.medalList.length;
  save(p);
  return true;
}
export function giveEgg(p, egg) {
  if (!EGGS[egg] || p.eggs.includes(egg)) return false;
  p.eggs.push(egg);
  giveMedal(p, 'egg:' + egg, '🥚 ' + EGGS[egg].name);
  return true;
}

export function rememberChat(chat) {
  if (!chat || chat.type === 'private') return;
  const c = db.chats[chat.id] ||= { id: chat.id, title: chat.title, announce: true };
  c.title = chat.title; save();
}
export function chats() { return Object.values(db.chats); }
export function chat(id) { return db.chats[id]; }
export let meta = db.meta;

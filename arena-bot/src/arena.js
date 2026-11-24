// Онлайн-режим «Захват Говсан»: одна карта на всех, территория сохраняется навсегда
import { createGame, addCar, removeCar, setInput, step, clearOwner, gridToRLE, gridFromRLE, runs, cellAt, N, pct } from '../public/grid.js';
import * as store from './store.js';

const TICK = 1 / 30;
const BOSS_EVERY = +process.env.BOSS_EVERY || 420; // секунд онлайна между появлениями Пирата
const BOSS_STAY = 120;
const BOT_NAMES = ['Не Fuad (точно)', 'Таксист Рамиз', 'Дядя на Жигулях', 'Мопед Самира', 'Курьер Вольт', 'Сосед с BMW'];
const BOT_COLORS = ['#9ca3af', '#b45309', '#0f766e', '#7c2d12', '#334155', '#a16207'];
export const PALETTE = ['#ff3b30', '#0a84ff', '#30d158', '#bf5af2', '#ff9f0a', '#ff375f', '#64d2ff', '#5e5ce6', '#ac8e68', '#66d4cf', '#ff6b35', '#a3e635', '#e879f9', '#f472b6'];
export const FUAD_COLOR = '#ffd60a';

export class Arena {
  constructor({ onAnnounce } = {}) {
    const m = store.meta;
    m.ownerTable ||= [''];                       // индекс -> 'p:<id>' или 'bot:<имя>'
    const owners = gridFromRLE(m.grid || '');
    // боты и пират не держат землю, пока никого нет
    for (let i = 0; i < N; i++) if ((m.ownerTable[owners[i]] || '').startsWith('bot:')) owners[i] = 0;
    this.g = createGame({ owners });
    this.clients = new Map(); // ws -> { p, car }
    this.byCar = new Map();
    this.onAnnounce = onAnnounce || (() => {});
    this.tickN = 0; this.timer = null;
    this.bossClock = BOSS_EVERY * 0.6; this.boss = null;
    this.paints = []; this.gridDirty = false;
  }

  ownerIdx(key) {
    const t = store.meta.ownerTable;
    let i = t.indexOf(key);
    if (i < 0) { i = t.length; t.push(key); store.save(); }
    return i;
  }
  ownerKey(i) { return store.meta.ownerTable[i] || ''; }
  // кто есть кто на карте (для цветов и подписей), включая тех, кто не в сети
  people() {
    const out = {};
    for (const [o] of this.g.counts) {
      const key = this.ownerKey(o);
      if (key.startsWith('p:')) { const p = store.findPlayer(key.slice(2)); if (p) out[o] = [p.creator ? '👑 Fuad' : p.name, colorOf(p)]; }
    }
    for (const c of this.g.cars.values()) out[c.owner] = [c.name, c.color];
    return out;
  }
  pctOf(p) { const i = store.meta.ownerTable.indexOf('p:' + p.id); return i > 0 ? pct(this.g, i) : 0; }
  humans() { return this.clients.size; }

  loop() {
    if (this.humans() > 0 && !this.timer) this.timer = setInterval(() => this.tick(), TICK * 1000);
    if (this.humans() === 0 && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  join(ws, user) {
    const p = store.getPlayer(user);
    for (const [oldWs, c] of this.clients) if (c.p.id === p.id) { try { oldWs.close(4000, 'opened elsewhere'); } catch { /* */ } this.leave(oldWs); }
    ensureColor(p);
    const owner = this.ownerIdx('p:' + p.id);
    const car = addCar(this.g, { owner, name: p.creator ? '👑 Fuad' : p.name || 'Гонщик', color: colorOf(p), uid: p.id });
    // собранные буквы F-U-A-D помним между заходами; кто уже собрал слово, тому буквы не нужны
    car.letters = new Set(p.eggs.includes('fuad_word') ? ['F', 'U', 'A', 'D'] : p.letters || []);
    const c = { ws, p, car };
    this.clients.set(ws, c); this.byCar.set(car.id, c);
    this.flushEvents();
    this.send(ws, {
      t: 'welcome', id: car.id, owner, grid: gridToRLE(this.g.owners), people: this.people(),
      trails: [...this.g.cars.values()].map(x => [x.id, x.trail]), me: this.profile(p),
    });
    this.broadcast({ t: 'people', people: this.people() });
    if (p.creator) this.broadcast({ t: 'toast', text: '👑 В Говсан заехал сам Создатель! Берегите районы!', big: true });
    this.syncBots();
    this.loop();
    return c;
  }

  leave(ws) {
    const c = this.clients.get(ws);
    if (!c) return;
    this.clients.delete(ws); this.byCar.delete(c.car.id);
    removeCar(this.g, c.car.id);
    this.syncBots();
    this.loop();
  }

  input(ws, msg) { const c = this.clients.get(ws); if (c) setInput(c.car, msg.a); }

  profile(p) {
    const list = this.top();
    return { pct: +this.pctOf(p).toFixed(2), medals: p.medals, title: store.titleFor(p, this.pctOf(p)), rank: (list.findIndex(x => x.p.id === p.id) + 1) || list.length + 1, eggs: p.eggs.length };
  }

  top() {
    return store.allPlayers().map(p => ({ p, pct: this.pctOf(p) }))
      .filter(x => x.pct > 0 || x.p.medals > 0)
      .sort((a, b) => b.pct - a.pct || b.p.medals - a.p.medals);
  }

  syncBots() {
    const h = this.humans();
    const want = h === 0 ? 0 : Math.max(0, 3 - h);
    const bots = [...this.g.cars.values()].filter(c => c.isBot && !c.isBoss);
    for (let i = bots.length; i < want; i++) {
      const used = new Set(bots.map(b => b.botName));
      const name = BOT_NAMES.find(n => !used.has(n));
      const k = BOT_NAMES.indexOf(name);
      const car = addCar(this.g, { owner: this.ownerIdx('bot:' + name), name: '🤖 ' + name, color: BOT_COLORS[k], isBot: true });
      car.botName = name;
      bots.push(car);
    }
    while (bots.length > want) { const b = bots.pop(); removeCar(this.g, b.id); clearOwner(this.g, b.owner); }
    if (h === 0 && this.boss) { removeCar(this.g, this.boss.id); clearOwner(this.g, this.boss.owner); this.boss = null; }
    this.flushEvents();
    this.broadcast({ t: 'people', people: this.people() });
  }

  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch { /* закрыт */ } }
  broadcast(obj) { const s = JSON.stringify(obj); for (const ws of this.clients.keys()) { try { ws.send(s); } catch { /* закрыт */ } } }
  toCar(car, obj) { const c = this.byCar.get(car?.id); if (c) this.send(c.ws, obj); }
  meUpdate(c) { this.send(c.ws, { t: 'me', me: this.profile(c.p) }); }

  tick() {
    if (this.humans() === 0) return;
    step(this.g, TICK);
    this.bossTick();
    this.flushEvents();
    if (++this.tickN % 2 === 0) {
      const cars = [...this.g.cars.values()].map(c => [c.id, Math.round(c.x), Math.round(c.y), +c.a.toFixed(2), (c.alive ? 1 : 0) | (c.shield > 0 ? 2 : 0) | (c.boostT > 0 ? 4 : 0) | (c.isBot ? 8 : 0) | (c.isBoss ? 16 : 0), c.owner]);
      const L = this.g.letter;
      this.broadcast({ t: 's', cars, letter: L ? [Math.round(L.x), Math.round(L.y), L.ch] : null });
    }
    if (this.gridDirty && this.tickN % 60 === 0) {
      this.gridDirty = false;
      store.meta.grid = gridToRLE(this.g.owners); store.save();
      if (this.onSave) this.onSave();
    }
  }

  bossTick() {
    this.bossClock -= TICK;
    if (this.boss) {
      this.boss.stay -= TICK;
      if (this.boss.stay <= 0 || !this.boss.alive) {
        removeCar(this.g, this.boss.id); clearOwner(this.g, this.boss.owner); this.boss = null;
        this.broadcast({ t: 'toast', text: '🏴‍☠️ Пират Fuadaqa12 уехал. Его земля снова ничья!' });
        this.broadcast({ t: 'people', people: this.people() });
      }
    } else if (this.bossClock <= 0) {
      this.bossClock = BOSS_EVERY;
      this.boss = addCar(this.g, { owner: this.ownerIdx('bot:pirate'), name: '☠️ Пират Fuadaqa12', color: '#1c1c1e', isBot: true, isBoss: true, botSpeed: 1.15 });
      this.boss.stay = BOSS_STAY; this.boss.noRespawn = true;
      this.broadcast({ t: 'people', people: this.people() });
      this.broadcast({ t: 'toast', text: '☠️ В Говсан ворвался Пират Fuadaqa12! Перережь его след!', big: true });
    }
  }

  flushEvents() {
    const g = this.g;
    for (const e of g.events) {
      if (e.type === 'paint') this.onPaint(e);
      else if (e.type === 'kill') this.onKill(e);
      else if (e.type === 'egg') this.onEgg(this.byCar.get(e.car.id), e.egg);
      else if (e.type === 'boost') this.toCar(e.car, { t: 'toast', text: '🚌 Автобусная остановка: турбо!' });
      else if (e.type === 'bump') this.broadcast({ t: 'fx', k: 'bump', x: Math.round(e.x), y: Math.round(e.y) });
      else if (e.type === 'letter') { const lc = this.byCar.get(e.car.id); if (lc) { lc.p.letters = e.have; store.save(lc.p); } }
      if (e.type === 'letter') this.toCar(e.car, { t: 'toast', text: `✨ Буква «${e.ch}»! Собрано: ${['F', 'U', 'A', 'D'].map(ch => e.have.includes(ch) ? ch : '_').join(' ')}` });
    }
    g.events.length = 0;
  }

  onPaint(e) {
    this.gridDirty = true;
    this.broadcast({ t: 'paint', o: e.o, r: runs(e.cells), car: e.car?.id ?? null });
    const c = e.car && this.byCar.get(e.car.id);
    if (!c) return;
    const gained = e.cells.length / N * 100;
    if (gained >= 0.3) this.send(c.ws, { t: 'gain', pct: +gained.toFixed(2) });
    this.meUpdate(c);
    // у кого отжали землю
    for (const [o, n] of e.victims || []) {
      const vc = [...this.clients.values()].find(x => x.car.owner === o);
      if (vc && n > 20) { this.send(vc.ws, { t: 'toast', text: `😱 ${c.car.name} отжал у тебя ${(n / N * 100).toFixed(1)}% района!` }); this.meUpdate(vc); }
    }
    // в группу пишем только про большие захваты (20%+) и про рост в топе
    if (gained >= 20) this.onAnnounce(`⚡⚡ <b>${esc(c.car.name)}</b> одним кругом захватил <b>${gained.toFixed(1)}%</b> Говсан!`);
    this.checkLeader();
    this.checkRise(c.p);
  }

  checkLeader() {
    const lead = this.top()[0];
    if (!lead || lead.pct < 3) return;
    if (store.meta.leader !== lead.p.id) {
      const prev = store.meta.leader; store.meta.leader = lead.p.id; store.save();
      if (prev) {
        this.broadcast({ t: 'toast', text: `👑 Новый хозяин Говсан: ${lead.p.name}!`, big: true });
      }
    }
  }

  // игрок поднялся в топе: сообщаем в группу (не чаще раза в 2 минуты на игрока)
  checkRise(p) {
    const list = this.top();
    const ranks = (store.meta.ranks ||= {});
    const now = Date.now(), cool = (this.riseT ||= {});
    let changed = false;
    const i = list.findIndex(x => x.p.id === p.id);
    if (i < 0) return;
    const rank = i + 1, before = ranks[p.id];
    // новичка просто запоминаем: первое появление в топе не анонсируем
    if (before != null && rank < before) {
      if (!cool[p.id] || now - cool[p.id] > 120000) {
        cool[p.id] = now;
        const passed = list[i + 1]?.p;
        const nm = esc(p.creator ? '👑 ' + p.name : p.name);
        this.onAnnounce(rank === 1
          ? `👑 <b>${nm}</b> теперь <b>топ-1 Говсан</b> (${list[i].pct.toFixed(1)}% района)!` + (passed ? ` Подвинул ${esc(passed.name)}.` : '')
          : `📈 <b>${nm}</b> поднялся на <b>#${rank}</b> в топе Говсан` + (passed ? `, обогнал ${esc(passed.name)}` : '') + ` (${list[i].pct.toFixed(1)}%)`);
      }
    }
    // запоминаем новые места всех
    list.forEach((x, k) => { if (ranks[x.p.id] !== k + 1) { ranks[x.p.id] = k + 1; changed = true; } });
    if (changed) store.save();
  }

  onEgg(c, egg) {
    if (!c) return;
    if (store.giveEgg(c.p, egg)) {
      this.send(c.ws, { t: 'toast', text: `🥚 ПАСХАЛКА: «${store.EGGS[egg].name}»! +1 медаль 🏅`, big: true });
      this.meUpdate(c);
    }
  }

  onKill(e) {
    const v = e.victim, k = e.killer;
    const vc = this.byCar.get(v.id), kc = k && this.byCar.get(k.id);
    const how = e.kind === 'cut' ? '✂️ перерезал след' : '💥 поглотил';
    this.broadcast({ t: 'feed', text: `${k ? k.name : '???'} ${how} ${v.name}` });
    this.broadcast({ t: 'fx', k: 'boom', x: Math.round(e.x), y: Math.round(e.y), id: v.id });
    if (vc) {
      vc.p.deaths++; store.save(vc.p);
      this.send(vc.ws, { t: 'dead', by: k ? k.name : '', kind: e.kind });
    }
    if (kc) {
      kc.p.kills++; store.save(kc.p);
      this.send(kc.ws, { t: 'toast', text: e.kind === 'cut' ? `✂️ Ты перерезал след ${v.name}!` : `💥 Ты поглотил ${v.name} на своей земле!` });
      if (v.isBoss) {
        this.onEgg(kc, 'boss');
        kc.p.bossKills++;
        this.broadcast({ t: 'toast', text: `☠️ ${k.name} остановил Пирата Fuadaqa12!`, big: true });
      }
      if (v.botName === 'Не Fuad (точно)') { this.send(kc.ws, { t: 'toast', text: '🤨 «Это был не я!» — сказал Не Fuad, улетая в кювет...' }); this.onEgg(kc, 'not_fuad'); }
    }
  }
}

function ensureColor(p) {
  if (p.creator) return;
  if (p.color && PALETTE.includes(p.color)) return;
  const used = new Set(store.allPlayers().map(x => x.color));
  p.color = PALETTE.find(c => !used.has(c)) || PALETTE[Math.floor(Math.random() * PALETTE.length)];
  store.save(p);
}
export function colorOf(p) { return p.creator ? FUAD_COLOR : p.color || '#ff3b30'; }
export function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

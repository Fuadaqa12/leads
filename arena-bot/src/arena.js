// Онлайн-арена: одна общая карта для всех, сервер считает физику и раздаёт кубки
import { createWorld, addShip, removeShip, setInput, step, snapshot, spawnBoss, BOT_NAMES, CFG, PLAYER_SKINS } from '../public/sim.js';
import * as store from './store.js';

const TICK = 1 / 30;
const BOSS_EVERY = +process.env.BOSS_EVERY || 420; // сек. онлайна между боссами

export class Arena {
  constructor({ onAnnounce } = {}) {
    this.w = createWorld();
    this.clients = new Map(); // ws -> { p, ship }
    this.byShip = new Map(); // shipId -> client
    this.onAnnounce = onAnnounce || (() => {});
    this.tickN = 0;
    this.bossClock = BOSS_EVERY * 0.5;
    this.rosterDirty = true;
    this.timer = null;
  }

  // цикл крутится только пока в море есть люди
  loop() {
    if (this.humans() > 0 && !this.timer) this.timer = setInterval(() => this.tick(), TICK * 1000);
    if (this.humans() === 0 && this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  humans() { return this.clients.size; }

  join(ws, user) {
    const p = store.getPlayer(user);
    // один корабль на игрока: старое подключение закрываем
    for (const [oldWs, c] of this.clients) if (c.p.id === p.id) { try { oldWs.close(4000, 'opened elsewhere'); } catch { /* уже закрыт */ } this.leave(oldWs); }
    const skin = p.creator ? 'gold' : (p.eggs.includes('flag') && p.skin === 'pirate') ? 'pirate' : PLAYER_SKINS.includes(p.skin) ? p.skin : 'red';
    const name = p.creator ? '👑 Fuad' : p.name || 'Пират';
    const ship = addShip(this.w, { name, skin, uid: p.id });
    const c = { ws, p, ship };
    this.clients.set(ws, c);
    this.byShip.set(ship.id, c);
    this.rosterDirty = true;
    this.send(ws, {
      t: 'welcome', id: ship.id, world: CFG.world, islands: this.w.islands,
      me: this.profile(p),
    });
    if (p.creator) this.broadcast({ t: 'toast', text: '👑 На арену зашёл сам Создатель! Все на палубу!' });
    this.syncBots();
    this.loop();
    return c;
  }

  leave(ws) {
    const c = this.clients.get(ws);
    if (!c) return;
    this.clients.delete(ws);
    this.byShip.delete(c.ship.id);
    removeShip(this.w, c.ship.id);
    this.rosterDirty = true;
    this.syncBots();
    this.loop();
  }

  input(ws, msg) {
    const c = this.clients.get(ws);
    if (c) setInput(c.ship, msg.a, msg.m, msg.f);
  }

  profile(p) {
    return { trophies: p.trophies, medals: p.medals, title: store.titleFor(p), rank: store.rankOf(p), eggs: p.eggs.length };
  }

  syncBots() {
    const h = this.humans();
    const want = h === 0 ? 0 : Math.min(8, Math.max(5, h + 3)) - h;
    const bots = [...this.w.ships.values()].filter(s => s.isBot && !s.isBoss);
    for (let i = bots.length; i < want; i++) {
      const used = new Set(bots.map(b => b.name));
      const free = BOT_NAMES.filter(n => !used.has(n));
      const name = (i === 0 && !used.has(BOT_NAMES[0])) ? BOT_NAMES[0] : free[Math.floor(Math.random() * free.length)] || 'Бот';
      bots.push(addShip(this.w, { name: '🤖 ' + name, skin: 'bot', isBot: true }));
    }
    while (bots.length > want) removeShip(this.w, bots.pop().id);
    if (h === 0) for (const s of [...this.w.ships.values()]) if (s.isBoss) removeShip(this.w, s.id);
    this.rosterDirty = true;
  }

  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch { /* сокет закрыт */ } }
  broadcast(obj) { const s = JSON.stringify(obj); for (const ws of this.clients.keys()) { try { ws.send(s); } catch { /* закрыт */ } } }
  toast(ship, text) { const c = this.byShip.get(ship?.id); if (c) this.send(c.ws, { t: 'toast', text }); }
  meUpdate(c, delta, reason) { this.send(c.ws, { t: 'me', me: this.profile(c.p), delta, reason }); }

  tick() {
    if (this.humans() === 0) return; // никого нет: экономим процессор
    step(this.w, TICK);
    this.bossClock -= TICK;
    if (this.bossClock <= 0 && ![...this.w.ships.values()].some(s => s.isBoss)) {
      this.bossClock = BOSS_EVERY;
      spawnBoss(this.w);
      this.rosterDirty = true;
      this.broadcast({ t: 'toast', text: '☠️ Пират Fuadaqa12 вышел в море! Топите его вместе!', big: true });
      this.onAnnounce('☠️ На Арене Хаоса появился босс <b>Пират Fuadaqa12</b>! Кто в море, бейте его, за него дают кучу кубков 🏆');
    }
    this.handleEvents();
    if (this.onTick) this.onTick();
    if (++this.tickN % 2 === 0) {
      if (this.rosterDirty) {
        this.rosterDirty = false;
        this.broadcast({ t: 'roster', list: [...this.w.ships.values()].map(s => [s.id, s.name, s.skin]) });
      }
      const snap = snapshot(this.w);
      snap.fx = this.fx; this.fx = [];
      this.broadcast(snap);
    }
  }

  handleEvents() {
    this.fx ||= [];
    for (const e of this.w.events) {
      if (e.type === 'hit' || e.type === 'splash' || e.type === 'boom') this.fx.push([e.type[0], Math.round(e.x), Math.round(e.y)]);
      else if (e.type === 'kill') this.onKill(e);
      else if (e.type === 'egg') this.onEgg(this.byShip.get(e.id), e.egg);
      else if (e.type === 'letter') this.toast(this.w.ships.get(e.id), `✨ Буква «${e.ch}»! Собрано: ${['F', 'U', 'A', 'D'].map(ch => e.have.includes(ch) ? ch : '_').join(' ')}`);
      else if (e.type === 'chest') this.toast(this.w.ships.get(e.id), '💰 Сундук с Острова Fuad! +15 золота');
      else if (e.type === 'lvl') this.toast(this.w.ships.get(e.id), `⬆️ Корабль прокачан до ${e.lvl} уровня!`);
    }
    this.w.events.length = 0;
  }

  onEgg(c, egg) {
    if (!c) return;
    if (store.giveEgg(c.p, egg)) {
      this.send(c.ws, { t: 'toast', text: `🥚 ПАСХАЛКА: «${store.EGGS[egg].name}»! +1 медаль 🏅`, big: true });
      this.meUpdate(c, 0);
    }
  }

  onKill(e) {
    const k = e.killerShip, v = e.victimShip;
    const kc = k && this.byShip.get(k.id), vc = this.byShip.get(v.id);
    let killText = `${k ? k.name : 'Море'} 💥 ${v.name}`;
    if (v.isBoss) {
      // всем, кто бил босса: +10, добивший: +30
      for (const [sid, dmg] of e.dmgBy) {
        const c = this.byShip.get(sid);
        if (!c || dmg < 30) continue;
        const bonus = sid === k?.id ? 30 : 10;
        store.addTrophies(c.p, bonus);
        c.p.bossKills += sid === k?.id ? 1 : 0;
        this.onEgg(c, 'boss');
        this.meUpdate(c, bonus, 'Босс повержен');
      }
      killText = `☠️ ${k ? k.name : '???'} потопил Пирата Fuadaqa12!`;
      this.broadcast({ t: 'toast', text: killText, big: true });
      if (kc) this.onAnnounce(`🏴‍☠️ <b>${esc(kc.p.name)}</b> добил Пирата Fuadaqa12 на Арене Хаоса! +30 🏆`);
    } else if (kc && vc) {
      store.addTrophies(kc.p, 10); kc.p.kills++;
      store.addTrophies(vc.p, -5); vc.p.deaths++;
      this.meUpdate(kc, 10, `Потопил ${v.name}`);
      this.meUpdate(vc, -5, `Тебя потопил ${k.name}`);
      if (k.streak === 3 || k.streak === 5 || k.streak === 10) {
        store.addTrophies(kc.p, 5);
        this.broadcast({ t: 'toast', text: `🔥 ${k.name}: серия ${k.streak}! Остановите его!` });
        this.meUpdate(kc, 5, 'Серия');
      }
    } else if (kc && v.isBot) {
      store.addTrophies(kc.p, 1); kc.p.kills++;
      this.meUpdate(kc, 1, `Потопил бота`);
      if (v.name.includes('Не Fuad')) {
        this.send(kc.ws, { t: 'toast', text: '🤨 «Это был не я!» — сказал Не Fuad, уходя на дно...' });
        this.onEgg(kc, 'not_fuad');
      }
    } else if (vc) {
      store.addTrophies(vc.p, -2); vc.p.deaths++;
      this.meUpdate(vc, -2, `Тебя потопил ${k ? k.name : 'шторм'}`);
    }
    if (vc) this.send(vc.ws, { t: 'dead', by: k ? k.name : '' });
    this.broadcast({ t: 'feed', text: killText });
    if (kc) store.save(kc.p);
    if (vc) store.save(vc.p);
  }
}

export function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

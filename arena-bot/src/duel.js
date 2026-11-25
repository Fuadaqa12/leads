// Дуэли 1 на 1: отдельная чистая карта Говсан на 3 минуты, кто больше захватил — тот победил.
// Протокол для клиента тот же, что у онлайна, плюс сообщения 'duel' (счёт и таймер) и 'duelEnd'.
import crypto from 'node:crypto';
import { POWERS, createGame, addCar, setInput, step, gridToRLE, runs, PN, pct } from '../public/grid.js';
import * as store from './store.js';
import * as quests from './quests.js';
import { colorOf, ensureColor, esc, EMOJI } from './arena.js';

const TICK = 1 / 30;
const TIME = +process.env.DUEL_TIME || 180;            // длительность боя
const WAIT = 10 * 60 * 1000; // сколько живёт вызов
const ALT = ['#0a84ff', '#ff3b30']; // если у соперников одинаковый цвет

export class Duels {
  constructor({ onAnnounce, onDM, onNews } = {}) {
    this.onNews = onNews;
    this.rooms = new Map(); // id -> room
    this.onAnnounce = onAnnounce || (() => {});
    this.onDM = onDM || (() => {});
    setInterval(() => this.cleanup(), 30 * 1000).unref?.();
  }

  // вызов: from бросает вызов игроку to
  challenge(from, toId) {
    const to = store.findPlayer(toId);
    if (!to || to.id === from.id) return { error: 'Такого соперника нет' };
    for (const r of this.rooms.values()) {
      if (r.state !== 'over' && [r.a, r.b].includes(from.id) && [r.a, r.b].includes(to.id)) return { id: r.id };
    }
    const id = crypto.randomBytes(5).toString('hex');
    const r = { id, a: from.id, b: to.id, state: 'wait', created: Date.now(), clients: new Map(), g: null };
    this.rooms.set(id, r);
    this.onDM(to.id, `⚔️ <b>${esc(nameOf(from))}</b> вызывает тебя на дуэль в Говсан!\n3 минуты, одна карта на двоих, кто больше захватил — тот победил. Вызов действует 10 минут.`, id);
    return { id };
  }

  // входящие и исходящие вызовы игрока (для меню)
  pending(p) {
    const out = [];
    for (const r of this.rooms.values()) {
      if (r.state === 'over' || ![r.a, r.b].includes(p.id)) continue;
      const other = store.findPlayer(r.a === p.id ? r.b : r.a);
      out.push({ id: r.id, incoming: r.b === p.id, state: r.state, name: other ? nameOf(other) : '???', left: Math.max(0, Math.round((r.created + WAIT - Date.now()) / 1000)) });
    }
    return out;
  }

  decline(p, id) {
    const r = this.rooms.get(id);
    if (!r || r.state !== 'wait' || ![r.a, r.b].includes(p.id)) return;
    r.state = 'over';
    for (const ws of r.clients.keys()) this.send(ws, { t: 'duelEnd', text: '🙅 Вызов отменён' });
  }

  join(ws, user, id) {
    const r = this.rooms.get(id);
    const p = store.getPlayer(user);
    if (!r || r.state === 'over' || ![r.a, r.b].includes(p.id)) { this.send(ws, { t: 'duelEnd', text: 'Дуэль уже закончилась или не найдена' }); try { ws.close(); } catch {} return false; }
    for (const [oldWs, c] of r.clients) if (c.p.id === p.id) { r.clients.delete(oldWs); try { oldWs.close(4000); } catch {} }
    ensureColor(p);
    r.clients.set(ws, { p });
    ws.duel = r;
    if (r.state === 'wait') {
      const other = store.findPlayer(r.a === p.id ? r.b : r.a);
      this.send(ws, { t: 'duel', wait: true, text: `⏳ Ждём ${other ? nameOf(other) : 'соперника'}...` });
      if ([...r.clients.values()].map(c => c.p.id).sort().join() === [r.a, r.b].sort().join()) this.start(r);
    } else this.welcome(r, ws);
    return true;
  }

  leave(ws) {
    const r = ws.duel; if (!r) return;
    r.clients.delete(ws);
  }

  input(ws, m) {
    const r = ws.duel; if (!r || r.state !== 'live') return;
    const c = r.clients.get(ws); const car = c && r.cars[c.p.id];
    if (car) setInput(car, m.a);
  }

  emote(ws, e) {
    const r = ws.duel; if (!r || r.state !== 'live' || !EMOJI.includes(e)) return;
    const c = r.clients.get(ws); if (!c || Date.now() - (c.emoT || 0) < 1500) return;
    c.emoT = Date.now();
    this.bc(r, { t: 'emo', id: r.cars[c.p.id].id, e });
  }

  start(r) {
    r.state = 'live';
    r.g = createGame({ solo: true });
    r.cars = {}; r.people = {};
    const pa = store.findPlayer(r.a), pb = store.findPlayer(r.b);
    let ca = colorOf(pa), cb = colorOf(pb);
    if (ca === cb) { ca = ALT[0]; cb = ALT[1]; }
    for (const [p, owner, color] of [[pa, 1, ca], [pb, 2, cb]]) {
      const car = addCar(r.g, { owner, name: nameOf(p), color, uid: p.id });
      car.carType = p.car || 'sedan';
      r.cars[p.id] = car;
      r.people[owner] = [nameOf(p), color, car.carType];
    }
    r.left = TIME; r.tickN = 0;
    r.g.events.length = 0;
    for (const ws of r.clients.keys()) this.welcome(r, ws);
    r.timer = setInterval(() => this.tick(r), TICK * 1000);
  }

  welcome(r, ws) {
    const c = r.clients.get(ws), car = r.cars[c.p.id];
    this.send(ws, { t: 'welcome', duel: true, id: car.id, owner: car.owner, grid: gridToRLE(r.g.owners), people: r.people, trails: [], me: {} });
    this.send(ws, { t: 'toast', text: '⚔️ ДУЭЛЬ! 3 минуты. Захвати больше соперника', big: true });
  }

  tick(r) {
    step(r.g, TICK);
    for (const e of r.g.events) {
      if (e.type === 'paint') {
        this.bc(r, { t: 'paint', o: e.o, r: runs(e.cells), car: e.car?.id ?? null });
        const ws = this.wsOf(r, e.car); const gained = e.cells.length / PN * 100;
        if (ws && gained >= 0.3) this.send(ws, { t: 'gain', pct: +gained.toFixed(2) });
      } else if (e.type === 'kill') {
        this.bc(r, { t: 'fx', k: 'boom', x: Math.round(e.x), y: Math.round(e.y), id: e.victim.id });
        this.bc(r, { t: 'feed', text: `${e.killer?.name || '???'} ${e.kind === 'cut' ? '✂️' : '💥'} ${e.victim.name}` });
        const ws = this.wsOf(r, e.victim); if (ws) this.send(ws, { t: 'dead', by: e.killer?.name || '', kind: e.kind });
      } else if (e.type === 'power') {
        const P = POWERS[e.kind], ws = this.wsOf(r, e.car);
        if (ws) this.send(ws, { t: 'toast', text: `${P.emoji} ${P.name}!` });
        this.bc(r, { t: 'fx', k: 'power', x: Math.round(e.x), y: Math.round(e.y), kind: e.kind });
      } else if (e.type === 'bump') this.bc(r, { t: 'fx', k: 'bump', x: Math.round(e.x), y: Math.round(e.y) });
    }
    r.g.events.length = 0;
    r.left -= TICK;
    if (++r.tickN % 2 === 0) {
      const cars = [...r.g.cars.values()].map(c => [c.id, Math.round(c.x), Math.round(c.y), +c.a.toFixed(2), (c.alive ? 1 : 0) | (c.shield > 0 ? 2 : 0) | (c.boostT > 0 ? 4 : 0) | (c.ghostT > 0 ? 32 : 0), c.owner]);
      this.bc(r, { t: 's', cars, letter: null, pw: r.g.powers.map(p => [Math.round(p.x), Math.round(p.y), p.kind]) });
    }
    if (r.tickN % 15 === 0) this.bc(r, { t: 'duel', left: Math.max(0, Math.ceil(r.left)), score: [pct(r.g, 1), pct(r.g, 2)].map(x => +x.toFixed(1)) });
    if (r.left <= 0) this.finish(r);
  }

  finish(r) {
    clearInterval(r.timer); r.state = 'over';
    const pa = store.findPlayer(r.a), pb = store.findPlayer(r.b);
    const sa = +pct(r.g, 1).toFixed(1), sb = +pct(r.g, 2).toFixed(1);
    const win = sa === sb ? null : sa > sb ? pa : pb, lose = win === pa ? pb : win === pb ? pa : null;
    if (win) {
      win.duelW = (win.duelW || 0) + 1; lose.duelL = (lose.duelL || 0) + 1;
      store.giveMedal(win, 'duel1', '⚔️ Первая победа в дуэли');
      if (win.duelW === 10) store.giveMedal(win, 'duel10', '⚔️ Дуэлянт: 10 побед');
      store.save(win); store.save(lose);
    }
    const line = `${nameOf(pa)} ${sa}% : ${sb}% ${nameOf(pb)}`;
    const qa = quests.bump(pa, 'duel'), qb = quests.bump(pb, 'duel');
    if (win) (win === pa ? qa : qb).push(...quests.bump(win, 'duelwin'));
    this.onNews?.(win ? `⚔️ ${nameOf(win)} победил ${nameOf(lose)} в дуэли` : `⚔️ ${nameOf(pa)} и ${nameOf(pb)}: ничья в дуэли`);
    for (const [ws, c] of r.clients) {
      const res = !win ? '🤝 Ничья!' : win.id === c.p.id ? '🏆 ПОБЕДА!' : '😵 Поражение';
      this.send(ws, { t: 'duelEnd', text: `${res}\n${line}`, win: win?.id === c.p.id, quests: c.p.id === pa.id ? qa : qb });
    }
    this.onAnnounce(win
      ? `⚔️ Дуэль в Говсан: <b>${esc(nameOf(win))}</b> победил <b>${esc(nameOf(lose))}</b>\n${esc(line)}`
      : `⚔️ Дуэль в Говсан закончилась вничью\n${esc(line)}`);
  }

  cleanup() {
    const now = Date.now();
    for (const [id, r] of this.rooms) {
      if (r.state === 'wait' && now - r.created > WAIT) {
        r.state = 'over';
        for (const ws of r.clients.keys()) this.send(ws, { t: 'duelEnd', text: '⌛ Соперник не пришёл, вызов сгорел' });
      }
      // бой идёт, а оба ушли больше чем на минуту — досрочно подводим итог
      if (r.state === 'live' && !r.clients.size) { r.empty ||= now; if (now - r.empty > 60000) this.finish(r); } else if (r.state === 'live') r.empty = 0;
      if (r.state === 'over' && now - r.created > 30 * 60 * 1000) this.rooms.delete(id);
    }
  }

  wsOf(r, car) { if (!car) return null; for (const [ws, c] of r.clients) if (r.cars[c.p.id] === car) return ws; return null; }
  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch { /* закрыт */ } }
  bc(r, obj) { const s = JSON.stringify(obj); for (const ws of r.clients.keys()) { try { ws.send(s); } catch { /* */ } } }
}

function nameOf(p) { return p.creator ? '👑 Fuad' : p.name || 'Гонщик'; }

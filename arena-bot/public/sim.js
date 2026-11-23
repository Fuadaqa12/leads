// Общий движок игры: работает и на сервере (онлайн-арена), и в браузере (соло-режим).
// Никаких зависимостей, чтобы один и тот же код крутился везде.

export const CFG = {
  world: 2400,
  shipR: 22,
  maxSpeed: 170,
  accel: 260,
  turnRate: 3.2,
  ballSpeed: 460,
  ballR: 5,
  range: 430,
  reload: 0.55,
  baseDmg: 16,
  coinTarget: 70,
  respawn: 3,
  spawnShield: 2.5,
  maxLevel: 10,
};

export const SKINS = {
  red: '#e74c3c', blue: '#3498db', green: '#2ecc71', purple: '#9b59b6',
  orange: '#e67e22', pink: '#ff6b9d', teal: '#1abc9c', gold: '#f1c40f',
  pirate: '#2c2c2c', bot: '#8d6e63', boss: '#1a1a1a',
};
export const PLAYER_SKINS = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'teal'];

// Пасхалка: настоящая позиция клада Фуада (видна только вблизи)
export const FUAD_TREASURE = { x: 1985, y: 415 };
export const LETTERS = ['F', 'U', 'A', 'D'];

export const BOT_NAMES = [
  'Не Fuad (точно)', 'Капитан Шаурма', 'Боцман Плов', 'Юнга Чайник', 'Матрос Кефир',
  'Дед Морской', 'Шпрот', 'Килька 3000', 'Адмирал Тапок', 'Сэр Креветка',
  'Чёрная Борода (фейк)', 'Ржавый Якорь', 'Пельмень', 'Капитан Очевидность',
];

export function lvlFromGold(g) { return Math.min(CFG.maxLevel, 1 + Math.floor(Math.sqrt(g / 4))); }
export function maxHpFor(lvl) { return 100 + (lvl - 1) * 15; }

// Детерминированный рандом (для соло-испытания дня и карты)
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function makeIslands() {
  const W = CFG.world;
  return [
    { x: 1900, y: 500, r: 150, name: 'Остров Fuad' },
    { x: 600, y: 600, r: 120, name: 'Черепаший' },
    { x: 1200, y: 1200, r: 170, name: 'Арена' },
    { x: 500, y: 1800, r: 130, name: 'Ромовый' },
    { x: 1850, y: 1750, r: 140, name: 'Пиратская Бухта' },
    { x: 1250, y: 380, r: 80, name: '' },
    { x: 280, y: 1150, r: 75, name: '' },
    { x: 2100, y: 1150, r: 90, name: '' },
    { x: 1150, y: 2100, r: 85, name: '' },
  ].map(i => ({ ...i, x: Math.min(W - i.r, i.x), y: Math.min(W - i.r, i.y) }));
}

export function createWorld(opts = {}) {
  const w = {
    t: 0, nextId: 1, ships: new Map(), balls: [], coins: [], events: [],
    islands: makeIslands(), letter: null, letterT: 20, chestT: 60, chest: null,
    bossT: opts.bossEvery ?? 420, bossEvery: opts.bossEvery ?? 420,
    solo: !!opts.solo, rand: opts.rand || Math.random, mods: opts.mods || {},
  };
  if (!w.solo) for (let i = 0; i < CFG.coinTarget; i++) spawnCoin(w);
  return w;
}

function freeSpot(w, margin = 40) {
  for (let k = 0; k < 60; k++) {
    const x = margin + w.rand() * (CFG.world - margin * 2);
    const y = margin + w.rand() * (CFG.world - margin * 2);
    if (w.islands.every(i => Math.hypot(i.x - x, i.y - y) > i.r + margin)) return { x, y };
  }
  return { x: 100, y: 100 };
}

function spawnCoin(w, x, y, v = 1) {
  if (x === undefined) ({ x, y } = freeSpot(w, 30));
  w.coins.push({ id: w.nextId++, x, y, v });
}

export function addShip(w, p) {
  const s = {
    id: p.id ?? w.nextId++, name: p.name || '???', skin: p.skin || 'red',
    isBot: !!p.isBot, isBoss: !!p.isBoss, uid: p.uid ?? null,
    x: 0, y: 0, a: 0, v: 0, ta: 0, thr: 0, fire: false,
    gold: 0, lvl: 1, hp: 100, maxHp: 100, cd: 0, alive: true, respawnT: 0, shield: 0,
    kills: 0, streak: 0, letters: new Set(), dmgBy: new Map(), lastHit: null,
    r: CFG.shipR, aiT: 0, aiTarget: null, wanderA: 0, botLevel: p.botLevel || 1,
  };
  if (s.isBoss) { s.r = 42; s.maxHp = s.hp = p.hp || 1400; s.lvl = 10; }
  if (p.isBot && p.hp) { s.maxHp = s.hp = p.hp; }
  respawn(w, s, p.x, p.y);
  if (s.isBoss && p.hp) s.maxHp = s.hp = p.hp;
  w.ships.set(s.id, s);
  return s;
}

function respawn(w, s, x, y) {
  if (x === undefined) ({ x, y } = freeSpot(w, 80));
  Object.assign(s, { x, y, a: w.rand() * Math.PI * 2, v: 0, alive: true, shield: s.isBoss ? 0 : CFG.spawnShield });
  if (!s.isBoss && !(s.isBot && w.solo)) { s.gold = 0; s.lvl = 1; s.maxHp = maxHpFor(1); s.hp = s.maxHp; }
  s.dmgBy = new Map(); s.lastHit = null; s.streak = 0;
}

export function removeShip(w, id) { w.ships.delete(id); }

export function setInput(s, a, thr, fire) {
  if (typeof a === 'number' && isFinite(a)) s.ta = a;
  s.thr = Math.max(0, Math.min(1, +thr || 0));
  s.fire = !!fire;
}

function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

function nearestEnemy(w, s, range) {
  let best = null, bd = range;
  for (const o of w.ships.values()) {
    if (o === s || !o.alive || o.shield > 0) continue;
    if (w.solo && s.isBot && o.isBot) continue; // в соло боты не воюют друг с другом
    const d = Math.hypot(o.x - s.x, o.y - s.y) - o.r;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

function shoot(w, s, ang, extra = 0) {
  const sp = CFG.ballSpeed * (s.isBoss ? 0.75 : 1);
  const dmg = (s.isBoss ? 22 : CFG.baseDmg + (s.lvl - 1) * 2) * (s.isBot && w.mods.botDmg ? w.mods.botDmg : 1);
  w.balls.push({
    x: s.x + Math.cos(ang) * (s.r + 6), y: s.y + Math.sin(ang) * (s.r + 6),
    vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: (CFG.range + extra) / sp, owner: s.id, dmg,
  });
}

function tryFire(w, s) {
  if (s.cd > 0) return;
  const target = nearestEnemy(w, s, CFG.range);
  let ang = s.a;
  if (target) {
    // упреждение
    const dx = target.x - s.x, dy = target.y - s.y;
    const t = Math.hypot(dx, dy) / CFG.ballSpeed;
    ang = Math.atan2(dy + Math.sin(target.a) * target.v * t, dx + Math.cos(target.a) * target.v * t);
  }
  shoot(w, s, ang);
  const reload = CFG.reload * (s.isBot ? (w.solo ? 2.0 : 1.6) : 1) / (1 + (s.lvl - 1) * 0.04);
  s.cd = reload;
  w.events.push({ type: 'shot', id: s.id });
}

function damage(w, s, dmg, by) {
  if (!s.alive || s.shield > 0) return;
  s.hp -= dmg;
  s.dmgBy.set(by, (s.dmgBy.get(by) || 0) + dmg);
  s.lastHit = by;
  if (s.hp <= 0) kill(w, s, by);
}

function kill(w, s, by) {
  s.alive = false; s.hp = 0; s.respawnT = CFG.respawn;
  const killer = w.ships.get(by);
  if (killer && killer !== s) { killer.kills++; killer.streak++; }
  // половина золота выпадает монетами
  const drop = Math.min(30, Math.floor(s.gold / 2)) + (s.isBoss ? 40 : s.isBot ? 3 : 2);
  for (let i = 0; i < drop; i++) {
    const a = w.rand() * Math.PI * 2, d = w.rand() * (s.r + 30);
    spawnCoin(w, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, 1);
  }
  w.events.push({ type: 'kill', killer: by, victim: s.id, killerShip: killer, victimShip: s, dmgBy: new Map(s.dmgBy) });
  if (s.isBoss) w.ships.delete(s.id);
}

function moveShip(w, s, dt) {
  const turn = s.isBoss ? 1.4 : CFG.turnRate;
  const d = angDiff(s.a, s.ta);
  s.a += Math.max(-turn * dt, Math.min(turn * dt, d));
  let maxV = (s.isBoss ? 95 : CFG.maxSpeed) * (s.isBot && w.mods.botSpeed ? w.mods.botSpeed : 1);
  maxV *= 1 - (s.lvl - 1) * 0.015; // тяжёлые корабли медленнее
  const target = maxV * s.thr * (Math.abs(d) > 2 ? 0.5 : 1);
  s.v += Math.max(-CFG.accel * dt, Math.min(CFG.accel * dt, target - s.v));
  s.x += Math.cos(s.a) * s.v * dt;
  s.y += Math.sin(s.a) * s.v * dt;
  const W = CFG.world;
  s.x = Math.max(s.r, Math.min(W - s.r, s.x));
  s.y = Math.max(s.r, Math.min(W - s.r, s.y));
  for (const i of w.islands) {
    const dx = s.x - i.x, dy = s.y - i.y, dist = Math.hypot(dx, dy) || 1, min = i.r + s.r * 0.7;
    if (dist < min) { s.x = i.x + dx / dist * min; s.y = i.y + dy / dist * min; s.v *= 0.6; }
  }
}

function botThink(w, s, dt) {
  s.aiT -= dt;
  if (s.aiT <= 0) {
    s.aiT = 0.4 + w.rand() * 0.4;
    const sense = s.isBoss ? 700 : w.solo ? 2000 : 520;
    s.aiTarget = nearestEnemy(w, s, sense)?.id ?? null;
    if (!s.aiTarget) s.wanderA += (w.rand() - 0.5) * 1.5;
  }
  const t = s.aiTarget != null ? w.ships.get(s.aiTarget) : null;
  if (t && t.alive) {
    const dist = Math.hypot(t.x - s.x, t.y - s.y);
    const toT = Math.atan2(t.y - s.y, t.x - s.x);
    // кружим вокруг цели на дистанции стрельбы
    s.ta = dist > 300 ? toT : toT + (s.id % 2 ? 1.2 : -1.2);
    s.thr = s.hp < s.maxHp * 0.25 && !s.isBoss && !w.solo ? 1 : 0.85;
    if (s.hp < s.maxHp * 0.25 && !s.isBoss && !w.solo) s.ta = toT + Math.PI;
    s.fire = dist < CFG.range;
  } else {
    // ищем монеты
    let best = null, bd = 500;
    if (!s.isBoss) for (const c of w.coins) { const d = Math.hypot(c.x - s.x, c.y - s.y); if (d < bd) { bd = d; best = c; } }
    s.ta = best ? Math.atan2(best.y - s.y, best.x - s.x) : s.wanderA;
    s.thr = 0.6; s.fire = false;
  }
  // не врезаемся в острова
  for (const i of w.islands) {
    const ax = s.x + Math.cos(s.ta) * 90, ay = s.y + Math.sin(s.ta) * 90;
    if (Math.hypot(ax - i.x, ay - i.y) < i.r + s.r) { s.ta += 0.9; break; }
  }
  const m = 120;
  if (s.x < m) s.ta = 0; else if (s.x > CFG.world - m) s.ta = Math.PI;
  if (s.y < m) s.ta = Math.PI / 2; else if (s.y > CFG.world - m) s.ta = -Math.PI / 2;
}

export function step(w, dt) {
  w.t += dt;
  for (const s of w.ships.values()) {
    if (!s.alive) {
      s.respawnT -= dt;
      if (s.respawnT <= 0 && !s.isBot && !w.solo) respawn(w, s);
      if (s.respawnT <= 0 && s.isBot && !w.solo && !s.isBoss) respawn(w, s);
      continue;
    }
    if (s.shield > 0) s.shield -= dt;
    if (s.cd > 0) s.cd -= dt;
    if (s.isBot || s.isBoss) botThink(w, s, dt);
    moveShip(w, s, dt);
    if (s.fire) tryFire(w, s);
    if (s.isBoss) {
      s.burst = (s.burst ?? 3) - dt;
      if (s.burst <= 0) {
        s.burst = 3.2;
        for (let k = 0; k < 12; k++) shoot(w, s, k / 12 * Math.PI * 2 + w.t, -80);
        w.events.push({ type: 'boom', x: s.x, y: s.y });
      }
    }
    // монеты
    for (let k = w.coins.length - 1; k >= 0; k--) {
      const c = w.coins[k];
      if (Math.abs(c.x - s.x) < s.r + 12 && Math.abs(c.y - s.y) < s.r + 12 && !s.isBoss) {
        w.coins.splice(k, 1);
        addGold(w, s, c.v);
      }
    }
    // буква FUAD
    if (w.letter && Math.hypot(w.letter.x - s.x, w.letter.y - s.y) < s.r + 18 && !s.isBot) {
      s.letters.add(w.letter.ch);
      w.events.push({ type: 'letter', id: s.id, ch: w.letter.ch, have: [...s.letters] });
      if (LETTERS.every(ch => s.letters.has(ch))) { w.events.push({ type: 'egg', id: s.id, egg: 'fuad_word' }); s.letters.clear(); addGold(w, s, 20); }
      w.letter = null; w.letterT = 60 + w.rand() * 60;
    }
    // сундук на Острове Fuad
    if (w.chest && Math.hypot(w.chest.x - s.x, w.chest.y - s.y) < s.r + 20 && !s.isBot) {
      addGold(w, s, 15); w.events.push({ type: 'chest', id: s.id }); w.chest = null; w.chestT = 150;
    }
    // клад Фуада (секретная точка)
    if (!s.isBot && Math.hypot(FUAD_TREASURE.x - s.x, FUAD_TREASURE.y - s.y) < 26) {
      if (!s.foundTreasure) { s.foundTreasure = true; w.events.push({ type: 'egg', id: s.id, egg: 'treasure' }); addGold(w, s, 10); }
    }
  }
  // ядра
  for (let k = w.balls.length - 1; k >= 0; k--) {
    const b = w.balls[k];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) for (const i of w.islands) if (Math.hypot(b.x - i.x, b.y - i.y) < i.r * 0.85) { dead = true; w.events.push({ type: 'splash', x: b.x, y: b.y }); break; }
    if (!dead) for (const s of w.ships.values()) {
      if (s.id === b.owner || !s.alive) continue;
      const owner = w.ships.get(b.owner);
      if (w.solo && owner && owner.isBot && s.isBot) continue;
      if ((b.x - s.x) ** 2 + (b.y - s.y) ** 2 < (s.r + CFG.ballR) ** 2) {
        dead = true;
        w.events.push({ type: 'hit', x: b.x, y: b.y, id: s.id });
        damage(w, s, b.dmg, b.owner);
        break;
      }
    }
    if (dead) { if (b.life <= 0) w.events.push({ type: 'splash', x: b.x, y: b.y }); w.balls.splice(k, 1); }
  }
  if (!w.solo) {
    if (w.coins.length < CFG.coinTarget && w.rand() < dt * 4) spawnCoin(w);
    w.letterT -= dt;
    if (!w.letter && w.letterT <= 0) {
      const p = freeSpot(w, 60);
      w.letter = { ...p, ch: LETTERS[Math.floor(w.rand() * 4)] };
      w.letterT = 999;
    }
    w.chestT -= dt;
    if (!w.chest && w.chestT <= 0) { w.chest = { x: 1900 + 165, y: 500 + 40 }; w.chestT = 999; }
  }
}

export function addGold(w, s, v) {
  s.gold += v;
  const lvl = lvlFromGold(s.gold);
  if (lvl > s.lvl && !s.isBoss) {
    const grow = maxHpFor(lvl) - s.maxHp;
    s.lvl = lvl; s.maxHp = maxHpFor(lvl); s.hp = Math.min(s.maxHp, s.hp + grow + 20);
    w.events.push({ type: 'lvl', id: s.id, lvl });
  }
}

export function spawnBoss(w) {
  const p = { x: 1200, y: 60 + 80 };
  return addShip(w, { name: '☠️ Пират Fuadaqa12', skin: 'boss', isBoss: true, isBot: true, hp: 1400, ...p });
}

// Сжатое состояние для отправки клиентам
export function snapshot(w) {
  const ships = [];
  for (const s of w.ships.values()) {
    ships.push([s.id, Math.round(s.x), Math.round(s.y), +s.a.toFixed(2), Math.ceil(s.hp), s.maxHp, s.lvl,
      (s.alive ? 1 : 0) | (s.shield > 0 ? 2 : 0) | (s.isBot ? 4 : 0) | (s.isBoss ? 8 : 0), s.gold, s.kills, Math.round(s.v)]);
  }
  return {
    t: 's', ships,
    balls: w.balls.map(b => [Math.round(b.x), Math.round(b.y)]),
    coins: w.coins.map(c => [c.id, Math.round(c.x), Math.round(c.y)]),
    letter: w.letter ? [Math.round(w.letter.x), Math.round(w.letter.y), w.letter.ch] : null,
    chest: w.chest ? [w.chest.x, w.chest.y] : null,
  };
}

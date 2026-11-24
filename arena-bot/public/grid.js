// Движок «Захват Говсан»: машины ездят по карте, оставляют след, замкнул — территория твоя.
// Один и тот же код крутится на сервере (онлайн) и в браузере (соло).
import { ROAD_B64 } from './roads.js';
import { S, NODES, EDGES, angleOf, edgeLen, SPAWN_NODES, BLOCKS_AT, pathTo } from './city.js';
export { S, NODES };

export const IMG_W = 1080, IMG_H = 1073;
export const GW = 180, GH = 179;      // сетка территорий
export const CELL = 6 * S;            // размер клетки в мире (15)
export const W = GW * CELL, H = GH * CELL;
export const N = GW * GH;

export const CFG = {
  speed: 210, carR: 13, respawn: 3, shield: 2.2,
  boost: 1.5, boostTime: 3, spawnRadius: 3,
};

// дороги
export const ROAD = (() => {
  const bin = typeof atob === 'function' ? atob(ROAD_B64) : Buffer.from(ROAD_B64, 'base64').toString('binary');
  const r = new Uint8Array(N);
  for (let i = 0; i < N; i++) r[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  return r;
})();
export const ROAD_CELLS = [...ROAD.keys()].filter(i => ROAD[i]);

// особые места (координаты карты ×S)
export const SPOTS = [
  { kind: 'fish', x: 905 * S, y: 588 * S, r: 70, emoji: '🐟' },
  { kind: 'parking', x: 32 * S, y: 725 * S, r: 60, emoji: '🅿️' },
  { kind: 'bus', x: 862 * S, y: 262 * S, r: 55, emoji: '🚌' },
  { kind: 'bus', x: 905 * S, y: 345 * S, r: 55, emoji: '🚌' },
];
export const LETTERS = ['F', 'U', 'A', 'D'];

export const cellAt = (x, y) => {
  const cx = Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), cy = Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)));
  return cy * GW + cx;
};
export const cellCenter = (i) => [(i % GW + 0.5) * CELL, (Math.floor(i / GW) + 0.5) * CELL];

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------- RLE для сетки (сохранение и передача) ----------
export function gridToRLE(g) {
  const out = []; let cur = g[0], len = 0;
  for (let i = 0; i < g.length; i++) { if (g[i] === cur) len++; else { out.push(cur, len); cur = g[i]; len = 1; } }
  out.push(cur, len);
  return out.join(',');
}
export function gridFromRLE(s, g = new Uint16Array(N)) {
  if (!s) return g;
  const a = s.split(',').map(Number); let p = 0;
  for (let k = 0; k < a.length; k += 2) { g.fill(a[k], p, Math.min(N, p + a[k + 1])); p += a[k + 1]; }
  return g;
}
// список клеток -> пары [start,len,...]
export function runs(cells) {
  const s = cells.slice().sort((a, b) => a - b), out = [];
  for (let k = 0; k < s.length; k++) {
    if (out.length && s[k] === out[out.length - 2] + out[out.length - 1]) out[out.length - 1]++;
    else if (!(out.length && s[k] < out[out.length - 2] + out[out.length - 1])) out.push(s[k], 1);
  }
  return out;
}

// ---------- игра ----------
export function createGame(opts = {}) {
  const g = {
    t: 0, owners: opts.owners || new Uint16Array(N), counts: new Map(), cars: new Map(), events: [], nextId: 1,
    rand: opts.rand || Math.random, mods: opts.mods || {}, solo: !!opts.solo,
    letter: null, letterT: 25,
  };
  for (let i = 0; i < N; i++) if (g.owners[i]) g.counts.set(g.owners[i], (g.counts.get(g.owners[i]) || 0) + 1);
  return g;
}

function setCell(g, i, o, changed) {
  const prev = g.owners[i];
  if (prev === o) return;
  if (prev) g.counts.set(prev, (g.counts.get(prev) || 1) - 1);
  if (o) g.counts.set(o, (g.counts.get(o) || 0) + 1);
  g.owners[i] = o;
  changed.push(i);
}

export function clearOwner(g, o) {
  const changed = [];
  for (let i = 0; i < N; i++) if (g.owners[i] === o) setCell(g, i, 0, changed);
  if (changed.length) g.events.push({ type: 'paint', o: 0, cells: changed });
}

export function addCar(g, p) {
  const c = {
    id: p.id ?? g.nextId++, owner: p.owner, name: p.name || '???', color: p.color || '#ff3b30', uid: p.uid ?? null,
    isBot: !!p.isBot, isBoss: !!p.isBoss, x: 0, y: 0, a: 0, want: null, from: 0, to: 0, d: 0, len: 1, v: 0, alive: true, respawnT: 0, shield: 0, boostT: 0,
    trail: [], trailSet: new Set(), kills: 0, letters: new Set(), plan: [], home: null, found: new Set(), botSpeed: p.botSpeed || 1,
  };
  g.cars.set(c.id, c);
  spawn(g, c);
  return c;
}
export function removeCar(g, id) { g.cars.delete(id); }

function placeOnEdge(c, from, to, d = 0) {
  c.from = from; c.to = to; c.len = edgeLen(from, to) || 1; c.d = d;
  const k = c.d / c.len, A = NODES[from], B = NODES[to];
  c.x = A.x + (B.x - A.x) * k; c.y = A.y + (B.y - A.y) * k; c.a = angleOf(from, to);
}

function spawn(g, c) {
  const own = g.counts.get(c.owner) || 0;
  let node = -1;
  if (own > 0) {
    // перекрёсток на своей земле
    const mine = NODES.filter(n => g.owners[cellAt(n.x, n.y)] === c.owner).map(n => n.i);
    if (mine.length) node = mine[Math.floor(g.rand() * mine.length)];
  }
  if (node < 0) {
    // земли нет: стартовый участок на перекрёстке подальше от других машин
    for (let k = 0; k < 30; k++) {
      node = SPAWN_NODES[Math.floor(g.rand() * SPAWN_NODES.length)];
      const n = NODES[node];
      if ([...g.cars.values()].every(o => o === c || !o.alive || Math.hypot(o.x - n.x, o.y - n.y) > 350)) break;
    }
    const n = NODES[node], cell = cellAt(n.x, n.y);
    const changed = [], cx = cell % GW, cy = Math.floor(cell / GW), R = CFG.spawnRadius;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R + 1) continue;
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < GW && y < GH) setCell(g, y * GW + x, c.owner, changed);
    }
    if (changed.length) g.events.push({ type: 'paint', o: c.owner, cells: changed });
  }
  const nb = NODES[node].nb;
  placeOnEdge(c, node, nb[Math.floor(g.rand() * nb.length)]);
  Object.assign(c, { alive: true, shield: CFG.shield, v: 0, plan: [] });
  c.trail = []; c.trailSet = new Set(); c.lastCell = null;
}

// куда свернуть на перекрёстке: по направлению пальца, без пальца — прямо
function chooseNext(c, node, prev) {
  const nb = NODES[node].nb;
  if (c.plan.length) { const nx = c.plan.shift(); if (nb.includes(nx)) return nx; c.plan = []; }
  const options = nb.length > 1 ? nb.filter(x => x !== prev) : nb;
  const want = c.want ?? c.a;
  let best = options[0], bd = 9;
  for (const x of options) { const d = Math.abs(angDiff(want, angleOf(node, x))); if (d < bd) { bd = d; best = x; } }
  return best;
}

export function setInput(c, a) { c.want = typeof a === 'number' && isFinite(a) ? a : null; }

function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

export function kill(g, c, by, kind) {
  if (!c.alive) return;
  c.alive = false; c.respawnT = CFG.respawn;
  const lostTrail = c.trail.length;
  c.trail = []; c.trailSet = new Set(); c.plan = [];
  if (by) by.kills++;
  g.events.push({ type: 'kill', victim: c, killer: by || null, kind, lostTrail, x: c.x, y: c.y });
}

// замыкание следа: след + всё, что внутри, становится твоим
function capture(g, c) {
  const o = c.owner, own = (i) => g.owners[i] === o || c.trailSet.has(i);
  const seen = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
  const push = (i) => { if (!seen[i] && !own(i)) { seen[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < GW; x++) { push(x); push((GH - 1) * GW + x); }
  for (let y = 0; y < GH; y++) { push(y * GW); push(y * GW + GW - 1); }
  while (qh < qt) {
    const i = q[qh++], x = i % GW;
    if (x > 0) push(i - 1); if (x < GW - 1) push(i + 1);
    if (i >= GW) push(i - GW); if (i < N - GW) push(i + GW);
  }
  const changed = [], victims = new Map();
  for (let i = 0; i < N; i++) {
    if (!seen[i] && g.owners[i] !== o) {
      const prev = g.owners[i];
      if (prev) victims.set(prev, (victims.get(prev) || 0) + 1);
      setCell(g, i, o, changed);
    }
  }
  c.trail = []; c.trailSet = new Set();
  if (changed.length) g.events.push({ type: 'paint', o, cells: changed, car: c, victims });
}

function botThink(g, c) {
  // вызывается на перекрёстке: если плана нет — объехать соседний квартал или вернуться домой
  if (c.plan.length) return;
  const node = c.to;
  const onOwn = g.owners[cellAt(NODES[node].x, NODES[node].y)] === c.owner;
  if (onOwn || !c.trail.length) {
    const blocks = BLOCKS_AT[node];
    if (!blocks.length || g.rand() < 0.2) return; // покататься
    const b = blocks[Math.floor(g.rand() * blocks.length)];
    let k = b.nodes.indexOf(node);
    const seq = [...b.nodes.slice(k + 1), ...b.nodes.slice(0, k + 1)];
    c.plan = g.rand() < 0.5 ? seq : [...seq].reverse().slice(1).concat([node]);
  } else {
    c.plan = pathTo(node, (u) => g.owners[cellAt(NODES[u].x, NODES[u].y)] === c.owner);
  }
}

function markCells(g, c, cars) {
  if (!c.alive) return;
  const cell = cellAt(c.x, c.y);
  // клетки между прошлой и текущей, чтобы след был сплошным (без дыр по диагонали)
  const path = [];
  if (c.lastCell != null && c.lastCell !== cell) {
    let x = c.lastCell % GW, y = Math.floor(c.lastCell / GW);
    const tx = cell % GW, ty = Math.floor(cell / GW);
    let guard = 0;
    while ((x !== tx || y !== ty) && guard++ < 50) {
      if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      path.push(y * GW + x);
    }
  } else path.push(cell);
  c.lastCell = cell;
  for (const i of path) {
    if (g.owners[i] === c.owner) { if (c.trail.length) capture(g, c); continue; }
    if (!c.trailSet.has(i)) { c.trail.push(i); c.trailSet.add(i); }
    // переехал чужой след — его хозяин разбивается
    if (c.shield <= 0) for (const o of cars) {
      if (o !== c && o.alive && o.shield <= 0 && o.trailSet.has(i)) kill(g, o, c, 'cut');
    }
  }
}

export function step(g, dt) {
  g.t += dt;
  const cars = [...g.cars.values()];
  for (const c of cars) {
    if (!c.alive) { c.respawnT -= dt; if (c.respawnT <= 0 && !c.noRespawn) spawn(g, c); continue; }
    if (c.shield > 0) c.shield -= dt;
    if (c.boostT > 0) c.boostT -= dt;
    // разворот посреди улицы, если палец тянет назад
    if (c.want !== null && !c.isBot && Math.abs(angDiff(c.a, c.want)) > 2.5) placeOnEdge(c, c.to, c.from, c.len - c.d);
    let sp = CFG.speed * (c.boostT > 0 ? CFG.boost : 1);
    if (c.isBot) sp *= (g.mods.botSpeed || 1) * c.botSpeed * (c.isBoss ? 0.95 : 0.8);
    c.v = sp;
    let left = sp * dt, guard = 0;
    while (left > 0 && guard++ < 8) {
      const room = c.len - c.d;
      if (left < room) { placeOnEdge(c, c.from, c.to, c.d + left); left = 0; break; }
      left -= room;
      if (c.isBot) { placeOnEdge(c, c.from, c.to, c.len); botThink(g, c); }
      const next = chooseNext(c, c.to, c.from);
      placeOnEdge(c, c.to, next, 0);
      markCells(g, c, cars);
    }
    markCells(g, c, cars);
    // особые места
    if (!c.isBot) for (const s of SPOTS) {
      if (Math.hypot(s.x - c.x, s.y - c.y) > s.r) continue;
      if (s.kind === 'bus') { if (c.boostT <= 0) g.events.push({ type: 'boost', car: c }); c.boostT = CFG.boostTime; }
      else if (!c.found.has(s.kind)) { c.found.add(s.kind); g.events.push({ type: 'egg', car: c, egg: s.kind }); }
    }
    if (g.letter && !c.isBot && Math.hypot(g.letter.x - c.x, g.letter.y - c.y) < 36) {
      c.letters.add(g.letter.ch);
      g.events.push({ type: 'letter', car: c, ch: g.letter.ch, have: [...c.letters] });
      if (LETTERS.every(ch => c.letters.has(ch))) { g.events.push({ type: 'egg', car: c, egg: 'fuad_word' }); c.letters.clear(); }
      g.letter = null; g.letterT = 50 + g.rand() * 60;
    }
  }
  // лобовые столкновения: хозяин земли поглощает чужака
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j];
    if (!a.alive || !b.alive || a.shield > 0 || b.shield > 0) continue;
    if (Math.hypot(a.x - b.x, a.y - b.y) > CFG.carR * 2) continue;
    if (Math.abs(angDiff(a.a, b.a)) < 1.6) continue; // едут в одну сторону — не лоб
    const o = g.owners[cellAt((a.x + b.x) / 2, (a.y + b.y) / 2)];
    if (o === a.owner && o !== b.owner) kill(g, b, a, 'absorb');
    else if (o === b.owner && o !== a.owner) kill(g, a, b, 'absorb');
    else {
      for (const c of [a, b]) { placeOnEdge(c, c.to, c.from, c.len - c.d); c.shield = 0.6; c.plan = []; }
      g.events.push({ type: 'bump', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  }
  if (!g.solo) {
    g.letterT -= dt;
    if (!g.letter && g.letterT <= 0) {
      // буква ставится прямо на линию улицы, по которой ездят машины
      const [a, b] = EDGES[Math.floor(g.rand() * EDGES.length)], k = 0.2 + g.rand() * 0.6;
      const x = NODES[a].x + (NODES[b].x - NODES[a].x) * k, y = NODES[a].y + (NODES[b].y - NODES[a].y) * k;
      g.letter = { x, y, ch: LETTERS[Math.floor(g.rand() * 4)] }; g.letterT = 90; // не взяли за 90 с — переедет
    }
    if (g.letter && g.letterT <= 0) { g.letter = null; g.letterT = 3; }
  }
}

export const pct = (g, o) => (g.counts.get(o) || 0) / N * 100;

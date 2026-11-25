// Клиент «Захват Говсан»: меню, отрисовка карты, онлайн и соло
import * as music from './music.js';
import * as sfx from './sfx.js';
import { RING_EDGES } from './city.js';
import { GW, GH, CELL, W, H, N, PN, PLAY, S, NODES, IMG_W, IMG_H, SPOTS, createGame, addCar, setInput, step, gridFromRLE, cellAt, cellCenter, pct, rng } from './grid.js';

const tg = window.Telegram?.WebApp;
try { tg?.ready(); tg?.expand(); tg?.disableVerticalSwipes?.(); tg?.setHeaderColor?.('#101418'); tg?.setBackgroundColor?.('#101418'); } catch {}
const qs = new URLSearchParams(location.search);
const INIT = tg?.initData || '';
const DEV = !INIT ? (qs.get('dev') || 'local') : '';
const $ = (id) => document.getElementById(id);
const haptic = (t = 'light') => { try { tg?.HapticFeedback?.impactOccurred(t); } catch {} };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- API ----------
async function api(path, body = {}) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ init: INIT, dev: DEV, ...body }) });
  return r.json();
}
let ME = null, TOP = [], PALETTE = [], GIFT = null, giftOffset = 0;
async function refresh() {
  try {
    const r = await api('/api/me');
    if (r.error) { $('meName').textContent = r.error === 'auth' ? 'Открой игру через бота в Телеграме' : 'Ошибка: ' + r.error; return; }
    ME = r.me; TOP = r.top; PALETTE = r.palette; GIFT = r.gift || null; renderMe(); renderGift();
  } catch { $('meName').textContent = 'Нет связи с сервером 😢'; }
}
function renderMe() {
  if (!ME) return;
  $('meName').textContent = ME.creator ? '👑 ' + ME.name : ME.name || 'Гонщик';
  $('meRank').textContent = '#' + ME.rank;
  $('meTitle').textContent = ME.title + (ME.soloBest ? ` · рекорд гонки: ${ME.soloBest}%` : '');
  $('mePct').textContent = ME.pct.toFixed(1) + '%';
  $('meMedals').textContent = ME.medals;
  $('meEggs').textContent = ME.eggs.length + '/' + ME.eggsTotal;
  $('onlineCount').textContent = ME.online ? `сейчас на улицах: ${ME.online} 🟢` : 'одна карта на всех, тут решается топ';
}

// ---------- музыка ----------
// песни играют всегда; браузер разрешает звук только после первого касания
addEventListener('pointerdown', () => { music.start(); sfx.unlock(); }, { capture: true });
addEventListener('keydown', () => music.start(), { capture: true });

// ---------- розыгрыш подарка ----------
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const bakuDate = (t) => { const d = new Date(t + 4 * 3600e3); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
function renderGift() {
  if (!GIFT) { $('giftCard').classList.add('hidden'); return; }
  $('giftCard').classList.remove('hidden');
  $('giftWhen').textContent = (GIFT.next === GIFT.first ? 'Первый розыгрыш ' : 'Розыгрыш ') + bakuDate(GIFT.next) + ', 20:00';
  const L = GIFT.leader, mine = GIFT.mine;
  let html = L ? (mine ? `👑 <span class="you">Сейчас подарок твой!</span> Удержи топ-1 до розыгрыша` : `👑 Сейчас забирает: <b>${esc(L.name)}</b> · ${L.pct}%`)
    : '👑 Топ-1 свободен. Захвати район и подарок твой!';
  if (GIFT.last) html += `<div class="muted" style="margin-top:4px">Прошлый победитель: ${esc(GIFT.last.name)}</div>`;
  $('giftLeader').innerHTML = html;
  tickGift();
}
function tickGift() {
  if (!GIFT) return;
  let s = Math.max(0, Math.floor((GIFT.next - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
  $('giftLeft').textContent = d ? `${d}д ${h}ч ${m}м` : `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
setInterval(tickGift, 1000);

// ---------- экраны ----------
const screens = ['menu', 'topScr', 'shipScr', 'helpScr', 'resultScr'];
function show(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== null);
  if (id) tg?.BackButton?.[id === 'menu' ? 'hide' : 'show']?.();
}
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { show('menu'); refresh(); });
tg?.BackButton?.onClick(() => { if (game) stopGame(); show('menu'); refresh(); });

$('btnTop').onclick = async () => {
  show('topScr');
  await refresh();
  const icons = ['🥇', '🥈', '🥉'];
  $('topList').innerHTML = TOP.length ? TOP.map((p, i) => `<div class="li ${p.me ? 'me' : ''}"><div class="pos">${icons[i] || i + 1}</div><div class="nm"><b><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</b><i>${esc(p.title)}</i></div><div class="sc">🏘 ${p.pct}%<span>🏅 ${p.medals}</span></div></div>`).join('')
    : '<p class="muted">Пока пусто. Захвати первый квартал!</p>';
};
$('btnShip').onclick = () => {
  show('shipScr');
  if (ME?.creator) $('skins').innerHTML = `<div class="skin on" style="background:#ffd60a">👑</div><p class="muted" style="grid-column:1/-1">У Создателя свой цвет, золотой 😎</p>`;
  else {
    $('skins').innerHTML = PALETTE.map(c => `<div class="skin ${ME?.color === c ? 'on' : ''}" data-c="${c}" style="background:${c}">🚗</div>`).join('');
    $('skins').querySelectorAll('[data-c]').forEach(el => el.onclick = async () => {
      haptic(); const r = await api('/api/color', { color: el.dataset.c }); ME = r.me;
      if (r.taken) alertToast('Этот цвет уже занят другом 🙃'); $('btnShip').onclick();
    });
  }
  $('medalList').innerHTML = ME?.medalList?.length ? ME.medalList.slice().reverse().map(m => `<div class="li">${esc(m.l)}</div>`).join('') : '<p class="muted">Медалей пока нет. Гонка ждёт!</p>';
};
$('btnHelp').onclick = () => show('helpScr');

// пасхалка: 7 тапов по логотипу
let logoTaps = 0, logoT = 0;
$('logo').onclick = async () => {
  const now = Date.now(); if (now - logoT > 1500) logoTaps = 0; logoT = now;
  logoTaps++; haptic('soft');
  $('logo').classList.remove('shake'); void $('logo').offsetWidth; $('logo').classList.add('shake');
  if (logoTaps === 7) {
    logoTaps = 0;
    const r = await api('/api/egg', { egg: 'flag' });
    if (r.me) ME = r.me;
    alertToast(r.fresh ? '🏴‍☠️ Пасхалка «Чёрный флаг»! +1 медаль 🏅' : '🏴‍☠️ Йо-хо-хо! Флаг уже твой.');
    renderMe();
  }
};
function alertToast(text) {
  const d = document.createElement('div'); d.className = 'toast big'; d.textContent = text;
  d.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:20;width:min(90vw,380px)';
  document.body.appendChild(d); setTimeout(() => d.remove(), 4000);
}

// ---------- испытание дня ----------
const DAILY_MODS = [
  { name: 'Шустрые соседи', desc: 'боты гоняют на 30% быстрее', mods: { botSpeed: 1.3 } },
  { name: 'Ночь в Говсан', desc: 'видно только рядом с собой', mods: { fog: true } },
  { name: 'Пробка', desc: 'на 2 бота больше', mods: { extraBots: 2 } },
  { name: 'Пират в городе', desc: 'Пират Fuadaqa12 гоняет с вами', mods: { boss: true } },
];
const today = new Date().toISOString().slice(0, 10);
const daily = DAILY_MODS[rng(+today.replace(/-/g, ''))() * DAILY_MODS.length | 0];
$('dailyName').textContent = daily.name;

// ---------- канвас и картинки ----------
const cv = $('cv'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize() { DPR = Math.min(2, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; cv.width = VW * DPR; cv.height = VH * DPR; }
addEventListener('resize', resize); resize();
const ZOOM = () => Math.min(1.1, Math.max(0.5, Math.min(VW, VH) / 700));
const mapImg = new Image(); mapImg.src = 'hovsan.jpg';

// слой территорий: 1 пиксель = 1 клетка
// слой территорий: 4 пикселя на клетку, заливка + яркий контур по границе участка
const TS = 4;
const terr = document.createElement('canvas'); terr.width = GW * TS; terr.height = GH * TS;
const tctx = terr.getContext('2d');
const tdata = tctx.createImageData(GW * TS, GH * TS);
let owners = new Uint16Array(N);
let people = {}; // ownerIdx -> [name, color]
const rgbCache = new Map();
function rgb(hex) {
  if (!rgbCache.has(hex)) { const n = parseInt(hex.slice(1), 16); rgbCache.set(hex, [n >> 16 & 255, n >> 8 & 255, n & 255]); }
  return rgbCache.get(hex);
}
function colorOfOwner(o) { return people[o]?.[1] || '#9e9e9e'; }
const TW = GW * TS, D = tdata.data;
function drawCell(i) {
  const o = owners[i], cx = i % GW, cy = (i / GW) | 0;
  if (!o) { for (let y = 0; y < TS; y++) { let k = ((cy * TS + y) * TW + cx * TS) * 4; for (let x = 0; x < TS; x++, k += 4) D[k + 3] = 0; } return; }
  const [r, g, b] = rgb(colorOfOwner(o));
  const L = cx > 0 && owners[i - 1] !== o, R = cx < GW - 1 && owners[i + 1] !== o;
  const T = cy > 0 && owners[i - GW] !== o, B = cy < GH - 1 && owners[i + GW] !== o;
  for (let y = 0; y < TS; y++) {
    let k = ((cy * TS + y) * TW + cx * TS) * 4;
    for (let x = 0; x < TS; x++, k += 4) {
      const edge = (L && x === 0) || (R && x === TS - 1) || (T && y === 0) || (B && y === TS - 1);
      // контур чуть светлее и плотнее заливки
      D[k] = edge ? Math.min(255, r + 60) : r; D[k + 1] = edge ? Math.min(255, g + 60) : g; D[k + 2] = edge ? Math.min(255, b + 60) : b;
      D[k + 3] = edge ? 245 : 120;
    }
  }
}
// клетку меняем вместе с соседями: у них мог появиться или пропасть контур
function paintCell(i) {
  drawCell(i);
  const x = i % GW;
  if (x > 0) drawCell(i - 1); if (x < GW - 1) drawCell(i + 1);
  if (i >= GW) drawCell(i - GW); if (i < N - GW) drawCell(i + GW);
}
let terrDirty = true;
function repaintAll() { for (let i = 0; i < N; i++) drawCell(i); terrDirty = true; }

// ---------- управление: тянешь пальцем в сторону поворота ----------
let want = null;
const keys = new Set();
addEventListener('keydown', e => { keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.code));
let joyId = null, joyX = 0, joyY = 0;
const joy = $('joy'), knob = $('joyKnob');
cv.addEventListener('pointerdown', e => {
  if (!game || joyId !== null) return;
  joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY;
  joy.style.left = joyX + 'px'; joy.style.top = joyY + 'px'; joy.classList.remove('hidden'); knob.style.transform = '';
});
addEventListener('pointermove', e => {
  if (e.pointerId !== joyId) return;
  let dx = e.clientX - joyX, dy = e.clientY - joyY; const d = Math.hypot(dx, dy);
  if (d > 50) { dx = dx / d * 50; dy = dy / d * 50; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  want = d > 14 ? Math.atan2(dy, dx) : null;
});
const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; joy.classList.add('hidden'); want = null; };
addEventListener('pointerup', joyEnd); addEventListener('pointercancel', joyEnd);
function currentWant() {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x--; if (keys.has('ArrowRight') || keys.has('KeyD')) x++;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y--; if (keys.has('ArrowDown') || keys.has('KeyS')) y++;
  return x || y ? Math.atan2(y, x) : want;
}

// ---------- общее ----------
let game = null;
const fx = [];
const disp = new Map();   // сглаженные позиции машин
const trails = new Map(); // id -> [[x,y]...] (для онлайна)

function toast(text, big) {
  const d = document.createElement('div'); d.className = 'toast' + (big ? ' big' : ''); d.textContent = text;
  $('toasts').prepend(d); setTimeout(() => d.remove(), 4000);
  while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
}
function feed(text) {
  const d = document.createElement('div'); d.textContent = text; $('feed').prepend(d); setTimeout(() => d.remove(), 6000);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
}
function pop(text, color = '#ffd60a') {
  const d = document.createElement('div'); d.className = 'delta'; d.textContent = text; d.style.color = color;
  d.style.left = VW / 2 - 50 + 'px'; d.style.top = VH / 2 - 90 + 'px';
  $('hud').appendChild(d); setTimeout(() => d.remove(), 1600);
}
// вспышка над только что захваченной землёй
const flashes = [];
function flash(cells) {
  if (cells.length < 6) return;
  const c = document.createElement('canvas'); c.width = GW; c.height = GH;
  const x = c.getContext('2d'), im = x.createImageData(GW, GH);
  for (const i of cells) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0); flashes.push({ c, t: 0 });
  if (flashes.length > 4) flashes.shift();
}
let shake = 0;
const nearMe = (x, y) => { const m = game && disp.get(game.myId); return m && Math.hypot(m.x - x, m.y - y) < 600; };
function boom(x, y, color = '#ff9f0a') {
  if (nearMe(x, y)) { shake = Math.max(shake, 0.45); sfx.play('crash'); }
  for (let i = 0; i < 28; i++) fx.push({ x, y, vx: (Math.random() - .5) * 320, vy: (Math.random() - .5) * 320, life: 0.9, max: 0.9, c: [color, '#ffcc00', '#ff453a', '#666'][i % 4], r: 4 + Math.random() * 5 });
  fx.push({ x, y, ring: true, life: 0.6, max: 0.6, c: '#fff', r: 10 });
}

function startCommon() {
  show(null); disp.clear(); fx.length = 0; trails.clear();
  $('feed').innerHTML = ''; $('toasts').innerHTML = ''; $('deathMsg').classList.add('hidden'); $('hudTime').textContent = '';
  want = null;
}
function stopGame() {
  if (!game) return;
  game.ws?.close(); clearInterval(game.sendT);
  game = null;
}
$('btnExit').onclick = () => {
  if (game?.mode === 'solo') { endSolo(); return; }
  stopGame(); show('menu'); refresh();
};

// ---------- ОНЛАЙН ----------
$('btnArena').onclick = () => {
  haptic('medium');
  stopGame(); startCommon();
  owners = new Uint16Array(N); people = {}; repaintAll();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws?init=${encodeURIComponent(INIT)}&dev=${encodeURIComponent(DEV)}`);
  game = { mode: 'arena', ws, myId: null, myOwner: 0, cars: [], letter: null, last: '', ready: false };
  $('hudMode').textContent = '🚗 онлайн';
  ws.onmessage = (ev) => onServer(JSON.parse(ev.data));
  ws.onclose = (e) => {
    if (game?.ws !== ws) return;
    stopGame(); show('menu'); refresh();
    alertToast(e.code === 4000 ? 'Ты зашёл с другого устройства' : 'Связь с Говсан потеряна 📡 Попробуй ещё раз');
  };
  game.sendT = setInterval(() => {
    if (ws.readyState !== 1) return;
    const w = currentWant();
    const s = JSON.stringify({ t: 'in', a: w === null ? null : +w.toFixed(2) });
    if (s !== game.last || Date.now() - (game.lastT || 0) > 2000) { ws.send(s); game.last = s; game.lastT = Date.now(); }
  }, 80);
};

function applyRuns(o, r) {
  for (let k = 0; k < r.length; k += 2) for (let i = r[k]; i < r[k] + r[k + 1]; i++) { owners[i] = o; paintCell(i); }
  terrDirty = true;
}

function onServer(m) {
  if (!game) return;
  switch (m.t) {
    case 'welcome':
      game.myId = m.id; game.myOwner = m.owner; game.ready = true;
      owners = gridFromRLE(m.grid); people = m.people; repaintAll();
      for (const [id, cells] of m.trails) trails.set(id, cells.map(cellCenter));
      if (ME) Object.assign(ME, m.me);
      toast('🚗 Ты в Говсан! Замыкай круги и захватывай кварталы');
      break;
    case 'people': people = m.people; repaintAll(); break;
    case 'paint':
      if (!game.ready) break;
      applyRuns(m.o, m.r);
      if (m.car != null) trails.delete(m.car);
      if (m.o) { const cells = []; for (let k = 0; k < m.r.length; k += 2) for (let i = m.r[k]; i < m.r[k] + m.r[k + 1]; i++) cells.push(i); flash(cells); }
      break;
    case 's':
      game.cars = m.cars.map(a => ({ id: a[0], x: a[1], y: a[2], a: a[3], alive: !!(a[4] & 1), shield: !!(a[4] & 2), boost: !!(a[4] & 4), isBot: !!(a[4] & 8), isBoss: !!(a[4] & 16), owner: a[5] }));
      game.letter = m.letter && { x: m.letter[0], y: m.letter[1], ch: m.letter[2] };
      for (const c of game.cars) {
        if (!c.alive) { trails.delete(c.id); continue; }
        const onOwn = owners[cellAt(c.x, c.y)] === c.owner;
        if (onOwn) { trails.delete(c.id); continue; }
        const t = trails.get(c.id) || []; const last = t[t.length - 1];
        if (!last || Math.hypot(last[0] - c.x, last[1] - c.y) > 6) t.push([c.x, c.y]);
        trails.set(c.id, t);
      }
      break;
    case 'toast':
      toast(m.text, m.big); if (m.big) haptic('heavy');
      if (/Буква/.test(m.text)) sfx.play('letter'); else if (/ПАСХАЛКА/.test(m.text)) sfx.play('egg'); else if (/Турбо|турбо/.test(m.text)) sfx.play('boost');
      break;
    case 'feed': feed(m.text); break;
    case 'fx':
      if (m.k === 'boom') { boom(m.x, m.y); if (m.id != null) trails.delete(m.id); }
      else if (m.k === 'bump') { fx.push({ x: m.x, y: m.y, ring: true, life: 0.5, max: 0.5, c: '#fff', r: 8 }); haptic('rigid'); if (nearMe(m.x, m.y)) sfx.play('bump'); }
      break;
    case 'gain': pop(`+${m.pct}% 🏘`); haptic('medium'); sfx.play('capture', m.pct >= 3 ? 3 : m.pct >= 1 ? 2 : 1); break;
    case 'me': if (ME) Object.assign(ME, m.me); break;
    case 'dead': {
      const d = $('deathMsg'); d.classList.remove('hidden');
      d.innerHTML = (m.kind === 'cut' ? '✂️ Твой след перерезал<br>' : '💥 Тебя поглотил<br>') + `<span style="color:#ff9f0a">${esc(m.by || '???')}</span><br><small>снова в деле через 3...</small>`;
      setTimeout(() => d.classList.add('hidden'), 3000);
      haptic('heavy');
      break;
    }
  }
}

// ---------- СОЛО: ГОНКА 3 минуты ----------
const SOLO_TIME = 180;
let lastSoloDaily = null;
$('btnSolo').onclick = () => startSolo(null);
$('btnDaily').onclick = () => startSolo(daily);
$('btnAgain').onclick = () => startSolo(lastSoloDaily);

function startSolo(dailyCfg) {
  haptic('medium');
  stopGame(); startCommon();
  lastSoloDaily = dailyCfg;
  const mods = dailyCfg?.mods || {};
  const g = createGame({ solo: true, mods });
  owners = g.owners;
  people = { 1: [ME?.creator ? '👑 Fuad' : ME?.name || 'Ты', ME?.color || '#ff3b30'] };
  const me = addCar(g, { owner: 1, name: people[1][0], color: people[1][1] });
  const botNames = ['Таксист Рамиз', 'Дядя на Жигулях', 'Мопед Самира', 'Курьер Вольт', 'Сосед с BMW'];
  const botColors = ['#9ca3af', '#b45309', '#0f766e', '#7c2d12', '#334155'];
  const nBots = 3 + (mods.extraBots || 0);
  for (let i = 0; i < nBots; i++) { people[i + 2] = ['🤖 ' + botNames[i], botColors[i]]; addCar(g, { owner: i + 2, name: people[i + 2][0], color: botColors[i], isBot: true }); }
  if (mods.boss) { people[9] = ['☠️ Пират Fuadaqa12', '#1c1c1e']; addCar(g, { owner: 9, name: people[9][0], color: '#1c1c1e', isBot: true, isBoss: true, botSpeed: 1.15 }); }
  repaintAll();
  game = { mode: 'solo', g, myId: me.id, myOwner: 1, timeLeft: SOLO_TIME, t0: performance.now(), daily: dailyCfg, mods, over: false };
  $('hudMode').textContent = dailyCfg ? `📅 ${dailyCfg.name}` : '⏱ Гонка против ботов';
  if (dailyCfg) toast(`📅 Испытание дня: ${dailyCfg.name}. Захвати 20%!`, true);
}

function soloTick(dt) {
  const G = game, g = G.g;
  setInput(g.cars.get(G.myId), currentWant());
  step(g, dt);
  for (const e of g.events) {
    if (e.type === 'paint') {
      for (const i of e.cells) paintCell(i); terrDirty = true;
      if (e.o) flash(e.cells);
      const gp = e.cells.length / PN * 100;
      if (e.car?.id === G.myId && gp >= 0.3) { pop(`+${gp.toFixed(1)}% 🏘`); haptic('medium'); sfx.play('capture', gp >= 3 ? 3 : gp >= 1 ? 2 : 1); }
    }
    else if (e.type === 'kill') {
      boom(e.x, e.y);
      feed(`${e.killer?.name || '???'} ${e.kind === 'cut' ? '✂️' : '💥'} ${e.victim.name}`);
      if (e.victim.id === G.myId) { haptic('heavy'); toast(e.kind === 'cut' ? '✂️ Твой след перерезали!' : '💥 Тебя поглотили!', true); }
      else if (e.killer?.id === G.myId) haptic('medium');
    } else if (e.type === 'boost' && e.car.id === G.myId) { toast('🚌 Турбо!'); sfx.play('boost'); }
    else if (e.type === 'bump') { fx.push({ x: e.x, y: e.y, ring: true, life: 0.5, max: 0.5, c: '#fff', r: 8 }); if (nearMe(e.x, e.y)) sfx.play('bump'); }
  }
  g.events.length = 0;
  G.timeLeft -= dt;
  $('hudTime').textContent = '⏱ ' + Math.max(0, Math.ceil(G.timeLeft)) + 'с';
  if (G.timeLeft <= 0 && !G.over) { G.over = true; endSolo(); }
}

async function endSolo() {
  const G = game; if (!G || G.mode !== 'solo') return;
  const res = +pct(G.g, 1).toFixed(1);
  const time = (performance.now() - G.t0) / 1000;
  const finished = G.timeLeft <= 0;
  game = null; lastSoloDaily = G.daily;
  show('resultScr');
  $('resTitle').textContent = !finished ? '🚪 Сошёл с гонки' : res >= 35 ? '🔥 Король Говсан!' : res >= 15 ? '🏁 Неплохо, гонщик!' : '🏁 Финиш';
  $('resBody').innerHTML = `<p>Твоя часть района: <b style="font-size:26px">${res}%</b></p><p class="muted">${finished ? 'Сохраняю...' : 'Медали дают только за полную гонку (3 минуты)'}</p>`;
  if (!finished) return;
  try {
    const r = await api('/api/solo', { pct: res, time, daily: G.daily ? today : '' });
    if (r.me) ME = r.me;
    const got = r.got || [];
    $('resBody').innerHTML = `<p>Твоя часть района: <b style="font-size:26px">${res}%</b></p><p>Рекорд: <b>${ME?.soloBest ?? res}%</b></p>`
      + (got.length ? `<p style="color:#ffd60a;font-weight:800">Новые медали:</p>${got.map(x => `<div>🏅 ${esc(x)}</div>`).join('')}` : `<p class="muted">Следующая медаль: ${[10, 20, 35, 50, 70].find(m => m > (ME?.soloBest || res)) || '∞'}%</p>`)
      + (r.error ? `<p class="muted">${esc(r.error)}</p>` : '');
    if (got.length) haptic('heavy');
  } catch { $('resBody').innerHTML += '<p class="muted">Не удалось сохранить 😢</p>'; }
}

// ---------- ОТРИСОВКА ----------
function viewCars() {
  if (!game) return [];
  if (game.mode === 'arena') return game.cars;
  return [...game.g.cars.values()].map(c => ({ id: c.id, x: c.x, y: c.y, a: c.a, alive: c.alive, shield: c.shield > 0, boost: c.boostT > 0, isBot: c.isBot, isBoss: c.isBoss, owner: c.owner, trail: c.trail }));
}

let lastT = performance.now(), cam = { x: W / 2, y: H / 2 };
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (game?.mode === 'solo' && !game.over) soloTick(dt);
  draw(dt, now / 1000);
  requestAnimationFrame(frame);
}

function draw(dt, t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const cars = viewCars();
  for (const c of cars) {
    let d = disp.get(c.id);
    if (!d || game?.mode === 'solo') { d = { x: c.x, y: c.y, a: c.a }; disp.set(c.id, d); }
    const k = Math.min(1, dt * 15);
    if (Math.hypot(c.x - d.x, c.y - d.y) > 150) { d.x = c.x; d.y = c.y; d.a = c.a; }
    d.x += (c.x - d.x) * k; d.y += (c.y - d.y) * k;
    let da = c.a - d.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; d.a += da * Math.min(1, dt * 12);
  }
  const me = cars.find(c => c.id === game?.myId), md = me && disp.get(me.id);
  if (md) { cam.x += (md.x - cam.x) * Math.min(1, dt * 6); cam.y += (md.y - cam.y) * Math.min(1, dt * 6); }
  else if (!game) { cam.x = W / 2 + Math.cos(t * 0.05) * 700; cam.y = H / 2 + Math.sin(t * 0.07) * 600; }
  const z = game ? ZOOM() : ZOOM() * 0.8;
  // камера не уезжает за край карты (там пустота)
  const hw = VW / 2 / z, hh = VH / 2 / z;
  const M = 90; // немного видно за краем, чтобы Окружную было видно целиком
  cam.x = W + 2 * M > hw * 2 ? Math.min(W + M - hw, Math.max(hw - M, cam.x)) : W / 2;
  cam.y = H + 2 * M > hh * 2 ? Math.min(H + M - hh, Math.max(hh - M, cam.y)) : H / 2;
  ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  shake = Math.max(0, shake - dt);
  const sh = shake * 14;
  ctx.translate(VW / 2 + (Math.random() - 0.5) * sh, VH / 2 + (Math.random() - 0.5) * sh); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  // карта
  if (mapImg.complete && mapImg.naturalWidth) ctx.drawImage(mapImg, 0, 0, IMG_W * S, IMG_H * S);
  // Окружная по краю карты
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [a, b] of RING_EDGES) { ctx.moveTo(NODES[a].x, NODES[a].y); ctx.lineTo(NODES[b].x, NODES[b].y); }
  ctx.strokeStyle = 'rgba(20,20,24,0.55)'; ctx.lineWidth = 40; ctx.stroke();
  ctx.strokeStyle = '#7a7a7e'; ctx.lineWidth = 32; ctx.stroke();
  ctx.setLineDash([24, 22]); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(10,15,25,0.22)'; ctx.fillRect(0, 0, W, H);
  // территории
  if (terrDirty) { tctx.putImageData(tdata, 0, 0); terrDirty = false; }
  // мягкие края территорий смотрятся лучше пиксельной лесенки
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(terr, 0, 0, W, H);
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i]; f.t += dt;
    if (f.t > 0.7) { flashes.splice(i, 1); continue; }
    ctx.globalAlpha = 0.55 * (1 - f.t / 0.7); ctx.drawImage(f.c, 0, 0, W, H); ctx.globalAlpha = 1;
  }
  // особые места
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const s of SPOTS) { ctx.font = '34px serif'; ctx.fillText(s.emoji, s.x, s.y - 30 + Math.sin(t * 3 + s.x) * 3); }
  const L = game?.mode === 'arena' ? game.letter : null;
  if (L) {
    const p = 1 + Math.sin(t * 5) * 0.15;
    ctx.save(); ctx.translate(L.x, L.y); ctx.scale(p, p); ctx.shadowColor = '#ff3df5'; ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffb0ff'; ctx.font = '900 46px system-ui'; ctx.fillText(L.ch, 0, 0); ctx.restore();
  }
  // следы
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const c of cars) {
    if (!c.alive) continue;
    const d = disp.get(c.id);
    const pts = game.mode === 'solo' ? c.trail.map(cellCenter) : trails.get(c.id) || [];
    if (!pts.length) continue;
    const col = colorOfOwner(c.owner);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    let px = pts[0][0], py = pts[0][1];
    for (const p of pts) { if (Math.hypot(p[0] - px, p[1] - py) > CELL * 2.5) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); px = p[0]; py = p[1]; }
    if (Math.hypot(d.x - px, d.y - py) < CELL * 2.5) ctx.lineTo(d.x, d.y);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 15; ctx.stroke();
    ctx.shadowColor = col; ctx.shadowBlur = 16;
    ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.setLineDash([22, 10]); ctx.lineDashOffset = -t * 60; ctx.stroke(); ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }
  // дым из-под колёс: на турбо и на поворотах
  for (const c of cars) {
    if (!c.alive) continue;
    const d = disp.get(c.id); if (!d) continue;
    const turning = Math.abs(((c.a - d.a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > 0.25;
    if ((c.boost || turning) && Math.random() < (c.boost ? 0.9 : 0.5) && fx.length < 220) {
      fx.push({ x: d.x - Math.cos(d.a) * 18, y: d.y - Math.sin(d.a) * 18, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, life: 0.7, max: 0.7, c: c.boost ? '#ffcf8a' : '#d8d8d8', r: 6, smoke: true });
    }
  }
  drawFx(dt);
  // машины
  for (const c of cars) if (c.alive) drawCar(c, disp.get(c.id), t, c.id === game.myId);
  ctx.restore();
  drawNight(cars, z);
  if (game?.mode === 'solo' && game.mods.fog) {
    const fg = ctx.createRadialGradient(VW / 2, VH / 2, 110 * z, VW / 2, VH / 2, 380 * z);
    fg.addColorStop(0, 'rgba(5,10,20,0)'); fg.addColorStop(1, 'rgba(5,10,20,0.97)');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, VW, VH);
  }
  if (game) hud(cars, me);
}

// ночь по времени Баку: темнеет, у машин горят фары
const night = document.createElement('canvas'), nctx = night.getContext('2d');
function darkness() {
  const h = (new Date().getUTCHours() + 4) % 24 + new Date().getUTCMinutes() / 60;
  if (h >= 20 || h < 5) return 0.55;
  if (h >= 18) return (h - 18) / 2 * 0.55;      // закат
  if (h < 7) return (7 - h) / 2 * 0.55;         // рассвет
  return 0;
}
function drawNight(cars, z) {
  const dk = qs.get("night") ? 0.55 : darkness();
  if (!dk || !game) return;
  if (night.width !== cv.width || night.height !== cv.height) { night.width = cv.width; night.height = cv.height; }
  nctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  nctx.globalCompositeOperation = 'source-over'; nctx.clearRect(0, 0, VW, VH);
  nctx.fillStyle = `rgba(6,10,32,${dk})`; nctx.fillRect(0, 0, VW, VH);
  nctx.globalCompositeOperation = 'destination-out';
  for (const c of cars) {
    if (!c.alive) continue;
    const d = disp.get(c.id); if (!d) continue;
    const sx = VW / 2 + (d.x - cam.x) * z, sy = VH / 2 + (d.y - cam.y) * z;
    if (sx < -300 || sy < -300 || sx > VW + 300 || sy > VH + 300) continue;
    let gr = nctx.createRadialGradient(sx, sy, 0, sx, sy, 70 * z);
    gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    nctx.fillStyle = gr; nctx.beginPath(); nctx.arc(sx, sy, 70 * z, 0, 7); nctx.fill();
    // фары: конус вперёд
    const fx2 = sx + Math.cos(d.a) * 150 * z, fy2 = sy + Math.sin(d.a) * 150 * z;
    gr = nctx.createRadialGradient(sx, sy, 10 * z, fx2, fy2, 120 * z);
    gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    nctx.fillStyle = gr; nctx.beginPath(); nctx.moveTo(sx, sy);
    nctx.arc(sx, sy, 230 * z, d.a - 0.45, d.a + 0.45); nctx.closePath(); nctx.fill();
  }
  nctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(night, 0, 0); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); }
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

function drawFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i];
    p.life -= dt; if (p.life <= 0) { fx.splice(i, 1); continue; }
    const k = p.life / p.max;
    ctx.globalAlpha = k;
    if (p.ring) { ctx.strokeStyle = p.c; ctx.lineWidth = 4; circle(p.x, p.y, p.r + (1 - k) * 70); ctx.stroke(); }
    else if (p.smoke) { p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = k * 0.45; ctx.fillStyle = p.c; circle(p.x, p.y, p.r * (2.2 - k)); ctx.fill(); }
    else { p.x += p.vx * dt; p.y += p.vy * dt; ctx.fillStyle = p.c; circle(p.x, p.y, p.r * (k + 0.3)); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
}

function drawCar(c, d, t, mine) {
  const col = colorOfOwner(c.owner), L = c.isBoss ? 44 : 36, Wd = c.isBoss ? 24 : 20;
  const z = ZOOM();
  const name = people[c.owner]?.[0] || '?';
  ctx.save(); ctx.translate(d.x, d.y);
  if (mine) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; circle(0, 0, 30 + Math.sin(t * 4) * 3); ctx.fill(); }
  if (c.shield) { ctx.strokeStyle = 'rgba(120,220,255,0.85)'; ctx.lineWidth = 3; circle(0, 0, 26); ctx.stroke(); }
  ctx.save(); ctx.rotate(d.a);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(-L / 2 + 3, -Wd / 2 + 4, L, Wd, 6); ctx.fill();
  if (c.boost) { ctx.fillStyle = '#ffb340'; ctx.beginPath(); ctx.moveTo(-L / 2, -5); ctx.lineTo(-L / 2 - 14 - Math.random() * 8, 0); ctx.lineTo(-L / 2, 5); ctx.fill(); }
  ctx.fillStyle = col; rrect(-L / 2, -Wd / 2, L, Wd, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(20,30,45,0.85)'; rrect(L * 0.05, -Wd / 2 + 3, L * 0.22, Wd - 6, 3); ctx.fill(); // лобовое
  ctx.fillStyle = 'rgba(20,30,45,0.6)'; rrect(-L * 0.38, -Wd / 2 + 3, L * 0.16, Wd - 6, 3); ctx.fill(); // заднее
  ctx.fillStyle = '#fffbe0'; ctx.fillRect(L / 2 - 3, -Wd / 2 + 2, 3, 4); ctx.fillRect(L / 2 - 3, Wd / 2 - 6, 3, 4);
  ctx.fillStyle = '#ff3b30'; ctx.fillRect(-L / 2, -Wd / 2 + 2, 2, 4); ctx.fillRect(-L / 2, Wd / 2 - 6, 2, 4);
  ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (c.isBoss) { ctx.font = '20px serif'; ctx.fillText('☠️', 0, 0); }
  if (col === '#ffd60a' && !c.isBot) { ctx.font = `${18 / z}px serif`; ctx.fillText('👑', 0, -L / 2 - 22 / z + Math.sin(t * 3) * 2); }
  // подпись одного размера на экране при любом зуме
  const fs = (mine ? 13 : 12) / z, ny = -L / 2 - 4 / z;
  ctx.font = `800 ${fs}px system-ui`; ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 3.5 / z; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(name, 0, ny);
  ctx.fillStyle = mine ? '#ffe08a' : '#fff'; ctx.fillText(name, 0, ny);
  ctx.restore();
}

// ---------- HUD ----------
const miniBg = document.createElement('canvas');
let hudT = 0;
function hud(cars, me) {
  if (performance.now() - hudT < 200) return; hudT = performance.now();
  const counts = new Map();
  for (let i = 0; i < N; i++) if (owners[i]) counts.set(owners[i], (counts.get(owners[i]) || 0) + 1);
  const myPct = (counts.get(game.myOwner) || 0) / PN * 100;
  $('hudPct').textContent = `🏘 ${myPct.toFixed(1)}%`;
  $('hudKills').textContent = '💥 ' + (game.mode === 'solo' ? game.g.cars.get(game.myId).kills : ME?.kills ?? 0);
  // миникарта
  const mc = $('mini'), m = mc.getContext('2d');
  if (!miniBg.width && mapImg.complete && mapImg.naturalWidth) { miniBg.width = mc.width; miniBg.height = mc.height; miniBg.getContext('2d').drawImage(mapImg, 0, 0, mc.width, mc.height); }
  m.clearRect(0, 0, mc.width, mc.height);
  if (miniBg.width) { m.globalAlpha = 0.6; m.drawImage(miniBg, 0, 0); m.globalAlpha = 1; }
  m.imageSmoothingEnabled = false; m.drawImage(terr, 0, 0, mc.width, mc.height);
  const sx = mc.width / W, sy = mc.height / H;
  for (const c of cars) {
    if (!c.alive) continue;
    m.fillStyle = c.id === game.myId ? '#fff' : colorOfOwner(c.owner);
    m.beginPath(); m.arc(c.x * sx, c.y * sy, c.id === game.myId ? 4 : 3, 0, 7); m.fill();
    if (c.id === game.myId) { m.strokeStyle = '#000'; m.lineWidth = 1; m.stroke(); }
  }
  // табло: все, у кого есть земля
  const list = [...counts.entries()].filter(([o]) => people[o]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $('board').innerHTML = list.map(([o, n]) => `<div class="${o === game.myOwner ? 'me' : ''}"><span><i class="dot" style="background:${colorOfOwner(o)}"></i>${esc(people[o][0].replace('🤖 ', ''))}</span><span>${(n / PN * 100).toFixed(1)}%</span></div>`).join('');
}

show('menu');
refresh();
requestAnimationFrame(frame);

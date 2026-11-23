// Клиент Арены Хаоса: меню, отрисовка моря, онлайн и соло
import { CFG, SKINS, PLAYER_SKINS, FUAD_TREASURE, createWorld, addShip, setInput, step, spawnBoss, rng } from './sim.js';

const tg = window.Telegram?.WebApp;
try { tg?.ready(); tg?.expand(); tg?.disableVerticalSwipes?.(); tg?.setHeaderColor?.('#071a2c'); tg?.setBackgroundColor?.('#071a2c'); } catch {}
const qs = new URLSearchParams(location.search);
const INIT = tg?.initData || '';
const DEV = !INIT ? (qs.get('dev') || 'local') : '';
const $ = (id) => document.getElementById(id);
const haptic = (t = 'light') => { try { tg?.HapticFeedback?.impactOccurred(t); } catch {} };

// ---------- API ----------
async function api(path, body = {}) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ init: INIT, dev: DEV, ...body }) });
  return r.json();
}
let ME = null, TOP = [];
async function refresh() {
  try {
    const r = await api('/api/me');
    if (r.error) { $('meName').textContent = r.error === 'auth' ? 'Открой игру через бота в Телеграме' : 'Ошибка: ' + r.error; return; }
    ME = r.me; TOP = r.top; renderMe();
  } catch { $('meName').textContent = 'Нет связи с сервером 😢'; }
}
function renderMe() {
  if (!ME) return;
  $('meName').textContent = ME.creator ? '👑 ' + ME.name : ME.name || 'Пират';
  $('meRank').textContent = '#' + ME.rank;
  $('meTitle').textContent = ME.title + (ME.soloBest ? ` · рекорд шторма: ${ME.soloBest} волн` : '');
  $('meTrophies').textContent = ME.trophies;
  $('meMedals').textContent = ME.medals;
  $('meEggs').textContent = ME.eggs.length + '/7';
  $('onlineCount').textContent = ME.online ? `сейчас в море: ${ME.online} 🟢` : 'одно море на всех, тут решается топ';
}

// ---------- экраны ----------
const screens = ['menu', 'topScr', 'shipScr', 'helpScr', 'resultScr'];
function show(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== null);
  if (id) { tg?.BackButton?.[id === 'menu' ? 'hide' : 'show']?.(); }
}
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { show('menu'); refresh(); });
tg?.BackButton?.onClick(() => { if (game) stopGame(); show('menu'); refresh(); });

$('btnTop').onclick = async () => {
  show('topScr');
  await refresh();
  const icons = ['🥇', '🥈', '🥉'];
  $('topList').innerHTML = TOP.length ? TOP.map((p, i) => `<div class="li ${p.me ? 'me' : ''}"><div class="pos">${icons[i] || i + 1}</div><div class="nm"><b>${esc(p.name)}</b><i>${esc(p.title)}</i></div><div class="sc">🏆 ${p.trophies}<span>🏅 ${p.medals}</span></div></div>`).join('')
    : '<p class="muted">Пока пусто. Будь первым!</p>';
};
$('btnShip').onclick = () => {
  show('shipScr');
  const list = [...PLAYER_SKINS]; if (ME?.eggs.includes('flag')) list.push('pirate');
  $('skins').innerHTML = list.map(s => `<div class="skin ${ME?.skin === s ? 'on' : ''}" data-s="${s}" style="background:${SKINS[s]}">${s === 'pirate' ? '🏴‍☠️' : '⛵'}</div>`).join('')
    + (ME?.creator ? `<div class="skin on" style="background:${SKINS.gold}">👑</div>` : '');
  $('skins').querySelectorAll('[data-s]').forEach(el => el.onclick = async () => { haptic(); const r = await api('/api/skin', { skin: el.dataset.s }); ME = r.me; $('btnShip').onclick(); });
  $('medalList').innerHTML = ME?.medalList?.length ? ME.medalList.slice().reverse().map(m => `<div class="li">${esc(m.l)}</div>`).join('') : '<p class="muted">Медалей пока нет. Шторм ждёт!</p>';
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
    alertToast(r.fresh ? '🏴‍☠️ Пасхалка «Чёрный флаг»! +1 медаль 🏅 и пиратский корабль в «Корабль»' : '🏴‍☠️ Йо-хо-хо! Флаг уже твой.');
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
  { name: 'Быстрые черти', desc: 'враги плавают на 35% быстрее', mods: { botSpeed: 1.35 } },
  { name: 'Злые пушки', desc: 'враги бьют в 1.5 раза больнее', mods: { botDmg: 1.5 } },
  { name: 'Туман', desc: 'видно только рядом с собой', mods: { fog: true } },
  { name: 'Орда', desc: 'на каждой волне +2 врага', mods: { extraBots: 2 } },
  { name: 'Без бинтов', desc: 'между волнами не лечишься', mods: { noHeal: true } },
  { name: 'Ночь Пирата', desc: 'босс Fuadaqa12 приходит каждые 3 волны', mods: { bossEvery: 3 } },
];
const today = new Date().toISOString().slice(0, 10);
const daily = DAILY_MODS[rng(+today.replace(/-/g, ''))() * DAILY_MODS.length | 0];
$('dailyName').textContent = daily.name;

// ---------- канвас ----------
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; }
addEventListener('resize', resize); resize();
const ZOOM = () => Math.min(1.15, Math.max(0.78, Math.min(W, H) / 470));

// ---------- управление ----------
const input = { a: 0, m: 0, f: false };
const keys = new Set();
addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.code));
let joyId = null, joyX = 0, joyY = 0;
const joy = $('joy'), knob = $('joyKnob'), fire = $('fireBtn');
cv.addEventListener('pointerdown', e => {
  if (!game || e.clientX > W * 0.6 || joyId !== null) return;
  joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY;
  joy.style.left = joyX + 'px'; joy.style.top = joyY + 'px'; joy.classList.remove('hidden');
  knob.style.transform = '';
});
addEventListener('pointermove', e => {
  if (e.pointerId !== joyId) return;
  let dx = e.clientX - joyX, dy = e.clientY - joyY; const d = Math.hypot(dx, dy);
  if (d > 50) { dx = dx / d * 50; dy = dy / d * 50; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  if (d > 8) { input.a = Math.atan2(dy, dx); input.m = Math.min(1, d / 45); } else input.m = 0;
});
const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; joy.classList.add('hidden'); input.m = 0; };
addEventListener('pointerup', joyEnd); addEventListener('pointercancel', joyEnd);
fire.addEventListener('pointerdown', e => { e.preventDefault(); input.f = true; fire.classList.add('on'); haptic(); });
const fireUp = () => { input.f = false; fire.classList.remove('on'); };
fire.addEventListener('pointerup', fireUp); fire.addEventListener('pointerleave', fireUp); fire.addEventListener('pointercancel', fireUp);
function readKeys() {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x--; if (keys.has('ArrowRight') || keys.has('KeyD')) x++;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y--; if (keys.has('ArrowDown') || keys.has('KeyS')) y++;
  const k = { f: keys.has('Space') };
  if (x || y) { k.a = Math.atan2(y, x); k.m = 1; }
  return k;
}
function currentInput() {
  const k = readKeys();
  return { a: k.a ?? input.a, m: k.m ?? input.m, f: input.f || k.f };
}

// ---------- общее состояние игры ----------
let game = null; // { mode, myId, view, ... }
const fx = []; // частицы
const disp = new Map(); // сглаженные позиции кораблей

function spawnFx(kind, x, y) {
  if (kind === 'h') { for (let i = 0; i < 10; i++) fx.push({ x, y, vx: (Math.random() - .5) * 160, vy: (Math.random() - .5) * 160, life: .5, max: .5, c: Math.random() < .5 ? '#ffb347' : '#ff5a36', r: 3 + Math.random() * 3 }); }
  else if (kind === 's') fx.push({ x, y, ring: true, life: .6, max: .6, c: '#cfefff', r: 4 });
  else if (kind === 'b') fx.push({ x, y, ring: true, life: .8, max: .8, c: '#ff4040', r: 20, big: true });
  else if (kind === 'x') { for (let i = 0; i < 30; i++) fx.push({ x, y, vx: (Math.random() - .5) * 260, vy: (Math.random() - .5) * 260, life: 1, max: 1, c: ['#ffb347', '#ff5a36', '#555', '#888'][i % 4], r: 4 + Math.random() * 5 }); }
}

function toast(text, big) {
  const d = document.createElement('div'); d.className = 'toast' + (big ? ' big' : ''); d.textContent = text;
  $('toasts').prepend(d); setTimeout(() => d.remove(), 4000);
  while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
}
function feed(text) {
  const d = document.createElement('div'); d.textContent = text; $('feed').prepend(d); setTimeout(() => d.remove(), 6000);
  while ($('feed').children.length > 5) $('feed').lastChild.remove();
}
function deltaPop(n, reason) {
  const d = document.createElement('div'); d.className = 'delta';
  d.textContent = (n > 0 ? '+' : '') + n + ' 🏆'; d.style.color = n > 0 ? '#f6c544' : '#ff6b6b';
  d.style.left = W / 2 - 30 + 'px'; d.style.top = H / 2 - 80 + 'px';
  $('hud').appendChild(d); setTimeout(() => d.remove(), 1600);
}

function startCommon(mode) {
  show(null); disp.clear(); fx.length = 0;
  $('feed').innerHTML = ''; $('toasts').innerHTML = ''; $('deathMsg').classList.add('hidden');
  input.m = 0; input.f = false;
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
  startCommon('arena');
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws?init=${encodeURIComponent(INIT)}&dev=${encodeURIComponent(DEV)}`);
  game = { mode: 'arena', ws, myId: null, names: new Map(), view: null, islands: [], last: '' };
  $('hudMode').textContent = '⚔️ онлайн';
  ws.onmessage = (ev) => onServer(JSON.parse(ev.data));
  ws.onclose = (e) => {
    if (game?.ws !== ws) return;
    stopGame(); show('menu'); refresh();
    alertToast(e.code === 4000 ? 'Ты зашёл с другого устройства' : 'Связь с морем потеряна 🌊 Попробуй ещё раз');
  };
  game.sendT = setInterval(() => {
    if (ws.readyState !== 1) return;
    const i = currentInput();
    const s = JSON.stringify({ t: 'in', a: +i.a.toFixed(2), m: +i.m.toFixed(2), f: i.f ? 1 : 0 });
    if (s !== game.last || Date.now() - (game.lastT || 0) > 2000) { ws.send(s); game.last = s; game.lastT = Date.now(); }
  }, 100);
};

function onServer(m) {
  if (!game) return;
  switch (m.t) {
    case 'welcome': game.myId = m.id; game.islands = m.islands; ME = { ...ME, ...m.me }; toast('🌊 Ты в море! Топи всех, собирай золото', false); break;
    case 'roster': game.names = new Map(m.list.map(([id, n, s]) => [id, { n, s }])); break;
    case 's': {
      const ships = m.ships.map(a => {
        const nm = game.names.get(a[0]) || { n: '?', s: 'red' };
        return { id: a[0], x: a[1], y: a[2], a: a[3], hp: a[4], maxHp: a[5], lvl: a[6], alive: !!(a[7] & 1), shield: (a[7] & 2) ? 1 : 0, isBot: !!(a[7] & 4), isBoss: !!(a[7] & 8), gold: a[8], kills: a[9], v: a[10], name: nm.n, skin: nm.s };
      });
      for (const f of m.fx || []) spawnFx(f[0], f[1], f[2]);
      game.view = { ships, balls: m.balls.map(b => ({ x: b[0], y: b[1] })), coins: m.coins.map(c => ({ id: c[0], x: c[1], y: c[2] })),
        letter: m.letter && { x: m.letter[0], y: m.letter[1], ch: m.letter[2] }, chest: m.chest && { x: m.chest[0], y: m.chest[1] } };
      break;
    }
    case 'toast': toast(m.text, m.big); if (m.big) haptic('heavy'); break;
    case 'feed': feed(m.text); break;
    case 'me': if (ME) Object.assign(ME, m.me); if (m.delta) { deltaPop(m.delta); haptic(m.delta > 0 ? 'medium' : 'rigid'); } break;
    case 'dead': {
      const me = game.view?.ships.find(s => s.id === game.myId); if (me) spawnFx('x', me.x, me.y);
      const d = $('deathMsg'); d.classList.remove('hidden');
      d.innerHTML = `☠️ Тебя потопил<br><span style="color:#ff8a3d">${esc(m.by || 'шторм')}</span><br><small>возрождение через 3...</small>`;
      setTimeout(() => d.classList.add('hidden'), 3000);
      haptic('heavy');
      break;
    }
  }
}

// ---------- СОЛО: ШТОРМ ----------
$('btnSolo').onclick = () => startSolo(null);
$('btnDaily').onclick = () => startSolo(daily);
$('btnAgain').onclick = () => startSolo(game?.lastDaily ?? lastSoloDaily);
let lastSoloDaily = null;

function startSolo(dailyCfg) {
  haptic('medium');
  stopGame(); startCommon('solo');
  lastSoloDaily = dailyCfg;
  const mods = dailyCfg?.mods || {};
  const w = createWorld({ solo: true, mods });
  const skin = ME?.creator ? 'gold' : ME?.skin || 'red';
  const me = addShip(w, { name: ME?.creator ? '👑 Fuad' : ME?.name || 'Ты', skin, x: 1200, y: 1500 });
  me.shield = 2;
  game = { mode: 'solo', w, myId: me.id, wave: 0, breakT: 1.5, t0: performance.now(), daily: dailyCfg, mods, over: false };
  $('hudMode').textContent = dailyCfg ? `📅 ${dailyCfg.name}: ${dailyCfg.desc}` : '🌪 Шторм';
  if (dailyCfg) toast(`📅 Испытание дня: ${dailyCfg.name}. Переживи 5 волн!`, true);
}

function soloTick(dt) {
  const g = game, w = g.w;
  const me = w.ships.get(g.myId);
  const i = currentInput();
  setInput(me, i.a, i.m, i.f);
  step(w, dt);
  for (const e of w.events) {
    if (e.type === 'hit' || e.type === 'splash' || e.type === 'boom') spawnFx(e.type[0], e.x, e.y);
    if (e.type === 'kill') {
      spawnFx('x', e.victimShip.x, e.victimShip.y);
      if (e.victimShip.id === g.myId) { setTimeout(endSolo, 1200); g.over = true; haptic('heavy'); }
      else { w.ships.delete(e.victimShip.id); feed(`💥 ${e.victimShip.name}`); haptic('light'); }
    }
    if (e.type === 'lvl' && e.id === g.myId) toast(`⬆️ Уровень ${e.lvl}!`);
  }
  w.events.length = 0;
  if (g.over) return;
  const enemies = [...w.ships.values()].filter(s => s.isBot);
  if (!enemies.length) {
    if (g.breakT === null) {
      g.breakT = 2.5;
      if (g.wave > 0) {
        if (!g.mods.noHeal) me.hp = Math.min(me.maxHp, me.hp + me.maxHp * 0.35);
        toast(`✅ Волна ${g.wave} пройдена!` + ([3, 5, 8, 12, 16, 20, 25, 30].includes(g.wave) ? ' 🏅' : ''), true);
        if (g.daily && g.wave === 5) toast('📅 Испытание дня выполнено! Медаль твоя после боя 🏅', true);
      }
    }
    g.breakT -= dt;
    if (g.breakT <= 0) { g.breakT = null; spawnWave(); }
  }
}

function spawnWave() {
  const g = game, w = g.w, n = ++g.wave;
  const me = w.ships.get(g.myId);
  const bossEvery = g.mods.bossEvery || 10;
  const names = ['Шпрот', 'Килька', 'Пельмень', 'Боцман Плов', 'Капитан Шаурма', 'Матрос Кефир', 'Юнга Чайник', 'Адмирал Тапок', 'Сэр Креветка', 'Ржавый Якорь'];
  const count = Math.min(10, 1 + Math.floor(n * 0.7)) + (g.mods.extraBots || 0);
  for (let k = 0; k < count; k++) {
    const a = Math.random() * Math.PI * 2, d = 650 + Math.random() * 250;
    let x = Math.max(60, Math.min(CFG.world - 60, me.x + Math.cos(a) * d)), y = Math.max(60, Math.min(CFG.world - 60, me.y + Math.sin(a) * d));
    for (const isl of w.islands) { const dd = Math.hypot(x - isl.x, y - isl.y); if (dd < isl.r + 40) { x = isl.x + (x - isl.x) / dd * (isl.r + 50); y = isl.y + (y - isl.y) / dd * (isl.r + 50); } }
    const b = addShip(w, { name: '🤖 ' + names[(n + k) % names.length], skin: 'bot', isBot: true, hp: Math.round(45 + n * 9), x, y });
    b.lvl = Math.min(10, 1 + Math.floor(n / 3));
  }
  if (n % bossEvery === 0) {
    const b = spawnBoss(w); b.maxHp = b.hp = 500 + n * 40; b.x = me.x > 1200 ? 300 : 2100; b.y = 300;
    toast('☠️ Пират Fuadaqa12 пришёл за тобой!', true); haptic('heavy');
  }
  toast(`🌊 Волна ${n}`, n % 5 === 0);
}

async function endSolo() {
  const g = game; if (!g || g.mode !== 'solo') return;
  const passed = Math.max(0, g.wave - 1 + ([...g.w.ships.values()].some(s => s.isBot) ? 0 : 1));
  const time = (performance.now() - g.t0) / 1000;
  game = null; lastSoloDaily = g.daily;
  show('resultScr');
  $('resTitle').textContent = passed >= 10 ? '🔥 Легендарный шторм!' : passed >= 5 ? '⚓ Достойно, капитан!' : '🌊 Корабль затонул';
  $('resBody').innerHTML = `<p>Пережито волн: <b style="font-size:26px">${passed}</b></p><p class="muted">Сохраняю результат...</p>`;
  try {
    const r = await api('/api/solo', { wave: passed, time, daily: g.daily ? today : '' });
    if (r.me) ME = r.me;
    const got = r.got || [];
    $('resBody').innerHTML = `<p>Пережито волн: <b style="font-size:26px">${passed}</b></p>`
      + `<p>Рекорд: <b>${ME?.soloBest ?? passed}</b></p>`
      + (got.length ? `<p style="color:#f6c544;font-weight:800">Новые медали:</p>${got.map(x => `<div>🏅 ${esc(x)}</div>`).join('')}` : `<p class="muted">Следующая медаль: ${nextMilestone(ME?.soloBest || passed)} волн</p>`)
      + (r.error ? `<p class="muted">${esc(r.error)}</p>` : '');
    if (got.length) haptic('heavy');
  } catch { $('resBody').innerHTML += '<p class="muted">Не удалось сохранить 😢</p>'; }
}
function nextMilestone(best) { return [3, 5, 8, 12, 16, 20, 25, 30].find(m => m > best) || '∞'; }

// ---------- ОТРИСОВКА ----------
function viewOf() {
  if (!game) return null;
  if (game.mode === 'arena') return game.view;
  const w = game.w;
  return { ships: [...w.ships.values()], balls: w.balls, coins: w.coins, letter: null, chest: null };
}

let lastT = performance.now(), cam = { x: 1200, y: 1200 };
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (game?.mode === 'solo') soloTick(dt);
  draw(dt, now / 1000);
  requestAnimationFrame(frame);
}

function draw(dt, t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const v = viewOf();
  const islands = game?.mode === 'arena' ? game.islands : game?.w?.islands || [];
  // сглаживание позиций
  if (v) for (const s of v.ships) {
    let d = disp.get(s.id);
    if (!d || game.mode === 'solo') { d = { x: s.x, y: s.y, a: s.a }; disp.set(s.id, d); }
    const k = Math.min(1, dt * 14);
    if (Math.hypot(s.x - d.x, s.y - d.y) > 200) { d.x = s.x; d.y = s.y; }
    d.x += (s.x - d.x) * k; d.y += (s.y - d.y) * k;
    let da = s.a - d.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; d.a += da * k;
  }
  const me = v?.ships.find(s => s.id === game.myId);
  const md = me && disp.get(me.id);
  if (md) { cam.x += (md.x - cam.x) * Math.min(1, dt * 6); cam.y += (md.y - cam.y) * Math.min(1, dt * 6); }
  else if (!game) { cam.x = 1200 + Math.cos(t * 0.05) * 600; cam.y = 1200 + Math.sin(t * 0.07) * 500; }
  const z = ZOOM();
  // море
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f4c75'); g.addColorStop(1, '#0a2f4d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  const vx0 = cam.x - W / 2 / z, vy0 = cam.y - H / 2 / z, vx1 = cam.x + W / 2 / z, vy1 = cam.y + H / 2 / z;
  // волны
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 2;
  const step = 70;
  for (let y = Math.floor(vy0 / step) * step; y < vy1 + step; y += step) {
    ctx.beginPath();
    for (let x = Math.floor(vx0 / step) * step - step; x < vx1 + step; x += step) {
      const yy = y + Math.sin(x * 0.02 + t * 1.2 + y) * 6;
      ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + 17, yy - 7, x + 34, yy);
    }
    ctx.stroke();
  }
  // граница мира
  ctx.strokeStyle = 'rgba(255,80,80,0.5)'; ctx.lineWidth = 6; ctx.setLineDash([30, 20]);
  ctx.strokeRect(0, 0, CFG.world, CFG.world); ctx.setLineDash([]);
  // острова
  for (const i of islands) {
    if (i.x + i.r + 60 < vx0 || i.x - i.r - 60 > vx1 || i.y + i.r + 60 < vy0 || i.y - i.r - 60 > vy1) continue;
    ctx.fillStyle = 'rgba(64,200,210,0.28)'; circle(i.x, i.y, i.r + 26 + Math.sin(t * 2 + i.x) * 3); ctx.fill();
    ctx.fillStyle = '#e8cf8f'; circle(i.x, i.y, i.r); ctx.fill();
    ctx.fillStyle = '#5fae57'; circle(i.x + i.r * 0.08, i.y - i.r * 0.06, i.r * 0.68); ctx.fill();
    ctx.fillStyle = '#4b9446'; circle(i.x - i.r * 0.2, i.y + i.r * 0.15, i.r * 0.35); ctx.fill();
    ctx.font = `${Math.round(i.r * 0.42)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(i.name === 'Остров Fuad' ? '🏝' : '🌴', i.x, i.y);
    if (i.name) {
      ctx.font = 'bold 22px system-ui'; ctx.fillStyle = i.name === 'Остров Fuad' ? '#ffd54a' : 'rgba(255,255,255,0.8)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4; ctx.strokeText(i.name, i.x, i.y + i.r * 0.55); ctx.fillText(i.name, i.x, i.y + i.r * 0.55);
    }
  }
  // клад Фуада: виден только вблизи
  if (md && game.mode === 'arena') {
    const dd = Math.hypot(md.x - FUAD_TREASURE.x, md.y - FUAD_TREASURE.y);
    if (dd < 220) { ctx.globalAlpha = Math.max(0, 1 - dd / 220) * 0.9; ctx.font = '34px serif'; ctx.fillText('❌', FUAD_TREASURE.x, FUAD_TREASURE.y); ctx.globalAlpha = 1; }
  }
  if (v) {
    // монеты
    for (const c of v.coins) {
      if (c.x < vx0 - 20 || c.x > vx1 + 20 || c.y < vy0 - 20 || c.y > vy1 + 20) continue;
      const bob = Math.sin(t * 4 + c.id) * 2;
      ctx.fillStyle = '#b8860b'; circle(c.x, c.y + bob + 1.5, 8); ctx.fill();
      ctx.fillStyle = '#ffd54a'; circle(c.x, c.y + bob, 8); ctx.fill();
      ctx.fillStyle = '#fff6c0'; circle(c.x - 2.5, c.y + bob - 2.5, 2.5); ctx.fill();
    }
    if (v.chest) { ctx.font = '40px serif'; ctx.textAlign = 'center'; ctx.fillText('💰', v.chest.x, v.chest.y + Math.sin(t * 3) * 3); }
    if (v.letter) {
      const L = v.letter, p = 1 + Math.sin(t * 5) * 0.15;
      ctx.save(); ctx.translate(L.x, L.y); ctx.scale(p, p);
      ctx.shadowColor = '#ff3df5'; ctx.shadowBlur = 25; ctx.fillStyle = '#ffb0ff'; ctx.font = '900 44px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(L.ch, 0, 0); ctx.restore();
    }
    // следы за кораблями
    for (const s of v.ships) {
      const d = disp.get(s.id); if (!d || !s.alive) continue;
      const r0 = s.isBoss ? 42 : 22;
      if ((s.v ?? 100) > 40 && Math.random() < 0.6) fx.push({ x: d.x - Math.cos(d.a) * r0, y: d.y - Math.sin(d.a) * r0, vx: 0, vy: 0, life: 0.9, max: 0.9, c: 'rgba(255,255,255,0.5)', r: 3, wake: true });
    }
    drawFx(dt, true);
    // корабли
    for (const s of v.ships) {
      const d = disp.get(s.id); if (!d || !s.alive) continue;
      drawShip(s, d, t, s.id === game.myId);
    }
    // ядра
    ctx.fillStyle = '#111';
    for (const b of v.balls) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; circle(b.x + 3, b.y + 4, 5); ctx.fill(); ctx.fillStyle = '#1b1b1b'; circle(b.x, b.y, 5.5); ctx.fill(); }
  }
  drawFx(dt, false);
  ctx.restore();
  // туман в испытании
  if (game?.mode === 'solo' && game.mods.fog) {
    const fg = ctx.createRadialGradient(W / 2, H / 2, 90 * z, W / 2, H / 2, 330 * z);
    fg.addColorStop(0, 'rgba(10,20,30,0)'); fg.addColorStop(1, 'rgba(10,20,30,0.97)');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
  }
  if (game && v) hud(v, me);
}

function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); }

function drawFx(dt, under) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i];
    if (!!p.wake !== under) continue;
    p.life -= dt; if (p.life <= 0) { fx.splice(i, 1); continue; }
    const k = p.life / p.max;
    if (p.ring) { ctx.strokeStyle = p.c; ctx.globalAlpha = k; ctx.lineWidth = p.big ? 6 : 2; circle(p.x, p.y, p.r + (1 - k) * (p.big ? 160 : 18)); ctx.stroke(); }
    else { p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = k * (p.wake ? 0.5 : 1); ctx.fillStyle = p.c; circle(p.x, p.y, p.r * (p.wake ? 2 - k : k + 0.3)); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  if (fx.length > 600) fx.splice(0, fx.length - 600);
}

function drawShip(s, d, t, mine) {
  const R = s.isBoss ? 42 : 22, col = SKINS[s.skin] || '#e74c3c';
  ctx.save(); ctx.translate(d.x, d.y);
  const roll = Math.sin(t * 2.2 + s.id) * 0.05;
  ctx.save(); ctx.rotate(d.a);
  // тень
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(4, 6, R * 1.2, R * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  // корпус
  ctx.beginPath();
  ctx.moveTo(R * 1.35, 0); ctx.quadraticCurveTo(R * 0.6, -R * 0.68, -R * 0.95, -R * 0.55);
  ctx.lineTo(-R * 1.05, R * 0.55); ctx.quadraticCurveTo(R * 0.6, R * 0.68, R * 1.35, 0); ctx.closePath();
  ctx.fillStyle = s.isBoss ? '#2b1d14' : '#7a4a26'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = s.isBoss ? '#3d2a1d' : '#a06a3b'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.85, R * 0.38, 0, 0, Math.PI * 2); ctx.fill();
  // пушки
  ctx.fillStyle = '#222';
  for (const sx of [-0.3, 0.25]) { ctx.fillRect(R * sx - 3, -R * 0.62, 6, 6); ctx.fillRect(R * sx - 3, R * 0.62 - 6, 6, 6); }
  ctx.restore();
  // парус (смотрит «вверх», немного качается)
  ctx.save(); ctx.rotate(d.a + roll);
  ctx.fillStyle = s.isBoss ? '#111' : s.skin === 'pirate' ? '#1a1a1a' : '#f5f0e1';
  ctx.beginPath(); ctx.moveTo(R * 0.1, -R * 0.85); ctx.quadraticCurveTo(R * 0.55, 0, R * 0.1, R * 0.85); ctx.lineTo(-R * 0.1, R * 0.85); ctx.lineTo(-R * 0.1, -R * 0.85); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillRect(-R * 0.1, -R * 0.2, R * 0.38, R * 0.4); ctx.globalAlpha = 1;
  ctx.fillStyle = '#4a3020'; circle(0, 0, R * 0.12); ctx.fill();
  ctx.restore();
  if (s.isBoss || s.skin === 'pirate') { ctx.font = `${R * 0.8}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('☠️', 0, 0); }
  if (s.skin === 'gold') { ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.fillText('👑', 0, -R - 34 + Math.sin(t * 3) * 2); }
  if (s.shield) { ctx.strokeStyle = 'rgba(120,220,255,0.8)'; ctx.lineWidth = 3; circle(0, 0, R + 10 + Math.sin(t * 8) * 2); ctx.stroke(); }
  if (mine) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); circle(0, 0, CFG.range); ctx.stroke(); ctx.setLineDash([]); }
  // имя и HP
  const bw = s.isBoss ? 110 : 56;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-bw / 2, -R - 18, bw, 7);
  const k = Math.max(0, s.hp / s.maxHp);
  ctx.fillStyle = s.isBoss ? '#ff3b3b' : mine ? '#5ef08a' : k > 0.5 ? '#9be15d' : k > 0.25 ? '#f6c544' : '#ff5a5a';
  ctx.fillRect(-bw / 2, -R - 18, bw * k, 7);
  ctx.font = `bold ${s.isBoss ? 16 : 13}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  const label = (s.lvl > 1 && !s.isBoss ? `⭐${s.lvl} ` : '') + s.name;
  ctx.strokeText(label, 0, -R - 24); ctx.fillStyle = mine ? '#ffe08a' : s.isBoss ? '#ff8080' : '#fff'; ctx.fillText(label, 0, -R - 24);
  ctx.restore();
}

let hudT = 0;
function hud(v, me) {
  if (me) {
    $('hpFill').style.width = Math.max(0, me.hp / me.maxHp * 100) + '%';
    $('hpText').textContent = `${Math.max(0, Math.ceil(me.hp))} / ${me.maxHp}`;
    $('hudGold').textContent = '💰 ' + me.gold; $('hudLvl').textContent = '⭐ ' + me.lvl; $('hudKills').textContent = '💥 ' + me.kills;
  }
  if (performance.now() - hudT < 250) return; hudT = performance.now();
  // миникарта
  const mc = $('mini'), m = mc.getContext('2d'), S = mc.width / CFG.world;
  m.clearRect(0, 0, mc.width, mc.height);
  const islands = game.mode === 'arena' ? game.islands : game.w.islands;
  m.fillStyle = '#d9c07c'; for (const i of islands) { m.beginPath(); m.arc(i.x * S, i.y * S, Math.max(2, i.r * S), 0, 7); m.fill(); }
  for (const s of v.ships) {
    if (!s.alive) continue;
    m.fillStyle = s.id === game.myId ? '#fff' : s.isBoss ? '#ff2222' : s.isBot ? '#c9a27a' : SKINS[s.skin] || '#f55';
    m.beginPath(); m.arc(s.x * S, s.y * S, s.id === game.myId ? 3.5 : s.isBoss ? 5 : 2.5, 0, 7); m.fill();
  }
  if (v.letter) { m.fillStyle = '#ff6bff'; m.font = 'bold 10px system-ui'; m.fillText(v.letter.ch, v.letter.x * S - 3, v.letter.y * S + 4); }
  // табло
  const list = v.ships.filter(s => !s.isBoss).sort((a, b) => b.kills - a.kills || b.gold - a.gold).slice(0, 6);
  $('board').innerHTML = (game.mode === 'solo' ? `<div><b>🌊 Волна ${game.wave}</b><span>${v.ships.filter(s => s.isBot).length} врагов</span></div>` : '')
    + list.map(s => `<div class="${s.id === game.myId ? 'me' : ''}"><span>${esc(s.name.replace('🤖 ', ''))}</span><span>💥${s.kills}</span></div>`).join('');
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

show('menu');
refresh();
requestAnimationFrame(frame);

// Сервер «Захват Говсан» (Node.js): раздаёт игру, держит онлайн-арену по WebSocket, принимает вебхук Телеграма.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Arena, PALETTE, colorOf } from './arena.js';
import { CARS } from '../public/grid.js';
import { Duels } from './duel.js';
import * as quests from './quests.js';
import { createBot } from './bot.js';
import { checkInitData, devUser } from './auth.js';
import { FileKV, GistKV } from './storage.js';
import * as store from './store.js';
import * as gift from './giveaway.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
// bot-hosting.net отдаёт порт в SERVER_PORT, Render — в PORT
const PORT = +process.env.SERVER_PORT || +process.env.PORT || 8080;
const TOKEN = process.env.BOT_TOKEN || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DEV = process.env.DEV_MODE === '1';
// Секрет вебхука выводится из токена, чтобы не заводить лишних ключей
const HOOK_SECRET = crypto.createHash('sha256').update('arena-hook:' + TOKEN).digest('hex').slice(0, 40);
const MILESTONES = [10, 20, 35, 50, 70];

// ---------- база ----------
const kv = process.env.GH_GIST_TOKEN ? new GistKV(process.env.GH_GIST_TOKEN) : new FileKV(path.join(process.env.DATA_DIR || path.join(ROOT, 'data'), 'db.json'));
if (kv.init) await kv.init();
await store.load(kv);
let flushT = null;
function scheduleFlush() {
  if (flushT) return;
  flushT = setTimeout(async () => { flushT = null; await store.flush(kv); }, 2000);
}
// в gist пишем не чаще раза в 30 секунд, в файл — сразу
setInterval(() => kv.commit(), process.env.GH_GIST_TOKEN ? 30000 : 3000).unref();
async function shutdown() { await store.flush(kv); await kv.commit(); process.exit(0); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);

// ---------- игра и бот ----------
let bot;
const arena = new Arena({ onAnnounce: (html) => bot?.announce(html), onDM: (id, html) => bot?.send(id, html, { reply_markup: { inline_keyboard: [[{ text: '🚗 Вернуть своё', web_app: { url: PUBLIC_URL } }]] } }) });
arena.onSave = scheduleFlush;
const duels = new Duels({
  onAnnounce: (html) => bot?.announce(html),
  onNews: (text) => arena.news(text),
  onDM: (id, html, duelId) => bot?.send(id, html, { reply_markup: { inline_keyboard: [[{ text: '⚔️ Принять вызов', web_app: { url: PUBLIC_URL + '/?duel=' + duelId } }]] } }),
});
setInterval(scheduleFlush, 5000).unref();
bot = createBot({ token: TOKEN, publicUrl: PUBLIC_URL, miniAppShort: process.env.MINIAPP_SHORT || '', arena });

function userFrom(init, dev) {
  if (DEV && dev) return devUser(dev);
  return checkInitData(init, TOKEN);
}

function profile(p) {
  const pct = arena.pctOf(p), list = arena.top();
  return {
    name: p.name, creator: p.creator, pct: +pct.toFixed(2), medals: p.medals, title: store.titleFor(p, pct),
    rank: (list.findIndex(x => x.p.id === p.id) + 1) || list.length + 1, eggs: p.eggs, eggsTotal: Object.keys(store.EGGS).length,
    soloBest: p.soloBest || 0, color: colorOf(p), medalList: p.medalList.slice(-30), online: arena.humans(),
    kills: p.kills, deaths: p.deaths, car: p.car || 'sedan',
  };
}

function api(route, p, body) {
  switch (route) {
    case '/api/me': {
      const top = arena.top().slice(0, 20).map(({ p: x, pct }) => ({ name: x.creator ? '👑 ' + x.name : x.name, pct: +pct.toFixed(1), medals: x.medals, title: store.titleFor(x, pct), color: colorOf(x), me: x.id === p.id }));
      const gi = gift.info(arena);
      const strip = (x) => x && { name: x.name, pct: x.pct, week: x.week };
      const nm = (x) => x.creator ? '👑 ' + x.name : x.name;
      const topDay = arena.topDay().slice(0, 20).map(x => ({ name: nm(x), pct: +x.day.gained.toFixed(1), kills: x.day.kills, color: colorOf(x), me: x.id === p.id }));
      const topKills = arena.topKills().slice(0, 20).map(x => ({ name: nm(x), kills: x.kills, deaths: x.deaths, color: colorOf(x), me: x.id === p.id }));
      const rivals = arena.top().filter(x => x.p.id !== p.id).slice(0, 30).map(x => ({ id: x.p.id, name: nm(x.p), pct: +x.pct.toFixed(1), color: colorOf(x.p), w: x.p.duelW || 0 }));
      return { me: profile(p), top, topDay, topKills, cars: CARS, palette: PALETTE, duels: duels.pending(p), rivals, quests: quests.view(p), ticker: arena.ticker.slice(0, 8), gift: { next: gi.next, first: gi.first, leader: strip(gi.leader), last: strip(gi.last), mine: gi.leader?.id === p.id } };
    }
    case '/api/color': {
      const taken = store.allPlayers().some(x => x.id !== p.id && x.color === body.color);
      if (PALETTE.includes(body.color) && !taken && !p.creator) { p.color = body.color; store.save(p); }
      return { me: profile(p), taken };
    }
    case '/api/car': {
      const c = CARS.find(x => x.id === body.car);
      if (c && (p.creator || p.medals >= c.need)) { p.car = c.id; store.save(p); }
      return { me: profile(p) };
    }
    case '/api/duel': return { ...duels.challenge(p, String(body.to || '')), duels: duels.pending(p) };
    case '/api/duelDecline': duels.decline(p, String(body.id || '')); return { duels: duels.pending(p) };
    case '/api/egg': {
      // с клиента можно получить только «флаг» (7 тапов по логотипу)
      const fresh = body.egg === 'flag' ? store.giveEgg(p, 'flag') : false;
      return { fresh, me: profile(p) };
    }
    case '/api/solo': {
      const res = Math.round((+body.pct || 0) * 10) / 10, time = +body.time || 0;
      // защита от читов: гонка длится 3 минуты
      if (res < 0 || res > 100 || time < 150) return { error: 'странный результат 🤨' };
      const got = [];
      if (res > (p.soloBest || 0)) { p.soloBest = res; store.save(p); }
      for (const m of MILESTONES) if (res >= m && store.giveMedal(p, 'solo:' + m, `⏱ Гонка: захватил ${m}% района`)) got.push(`⏱ Гонка: захватил ${m}% района`);
      if (res >= 15) got.push(...quests.bump(p, 'solo15').map(x => x.replace('✅ Задание: ', '📋 ')));
      const today = new Date().toISOString().slice(0, 10);
      if (body.daily === today && res >= 20 && store.giveMedal(p, 'daily:' + today, `📅 Испытание дня ${today}`)) got.push(`📅 Испытание дня ${today}`);
      return { got, me: profile(p) };
    }
  }
  return { error: 'unknown' };
}

// ---------- розыгрыш подарка ----------
async function giftTick() {
  const w = gift.check(arena);
  if (!w) return;
  scheduleFlush();
  if (w.none) { bot.announce(`🎁 Розыгрыш недели ${w.week}: топ-1 пустой, подарок переносится. Захватывайте Говсан!`); return; }
  console.log('Розыгрыш:', JSON.stringify(w));
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  await bot.announce(`🎁 <b>Розыгрыш недели!</b>\nTelegram-подарок от создателя забирает <b>${esc(w.name)}</b>: топ-1 Говсан с ${w.pct}% района 👑\n\nСледующий розыгрыш: ${gift.fmtDate(gift.nextDraw())}`);
  await bot.send(w.id, `🎁 <b>Ты выиграл розыгрыш недели!</b>\nТы был топ-1 Говсан (${w.pct}% района). Создатель скоро пришлёт тебе Telegram-подарок 🎉`);
  const creator = store.allPlayers().find(x => x.creator);
  const p = store.findPlayer(w.id);
  if (creator) await bot.send(creator.id, `🎁 Розыгрыш ${w.week}: победил <b>${esc(w.name)}</b>${p?.username ? ' (@' + esc(p.username) + ')' : ''}, ${w.pct}% района. Не забудь отправить подарок 😉`);
}
setInterval(() => giftTick().catch(e => console.error('gift', e)), 60 * 1000).unref();

// ---------- HTTP ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.mp4': 'video/mp4' };
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-cache' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok) => {
  let s = ''; req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); });
  req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { ok({}); } });
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL);
  const p = url.pathname;
  try {
    if (p === '/health') return send(res, 200, { ok: true, online: arena.humans(), hasToken: !!TOKEN, url: PUBLIC_URL, bot: botStatus });
    if (p === '/tg' && req.method === 'POST') {
      if (req.headers['x-telegram-bot-api-secret-token'] !== HOOK_SECRET) return send(res, 403, 'nope', 'text/plain');
      const u = await readBody(req);
      // Телеграму всегда отвечаем 200, иначе он будет слать апдейт повторно
      const out = await bot.handleUpdate(u).catch(e => { console.error('update', e); return null; });
      scheduleFlush();
      return out ? send(res, 200, out) : send(res, 200, 'ok', 'text/plain');
    }
    if (p.startsWith('/api/')) {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
      const body = await readBody(req);
      const u = userFrom(body.init, body.dev);
      if (!u) return send(res, 401, { error: 'auth' });
      const out = api(p, store.getPlayer(u), body);
      scheduleFlush();
      return send(res, 200, out);
    }
    // список песен: всё, что лежит в public/music
    if (p === '/music/list') {
      let list = [];
      try { list = fs.readdirSync(path.join(PUBLIC, 'music')).filter(f => /\.(mp3|m4a|ogg|mp4)$/i.test(f)); } catch { /* папки нет */ }
      return send(res, 200, list);
    }
    // статика
    let dp = p; try { dp = decodeURIComponent(p); } catch { /* кривой адрес */ }
    const file = path.join(PUBLIC, dp === '/' ? 'index.html' : path.normalize(dp).replace(/^([/\\])+/, ''));
    if (!file.startsWith(PUBLIC)) return send(res, 403, 'nope', 'text/plain');
    // музыка отдаётся кусками (Range), иначе айфоны её не играют
    if (/\.(mp3|m4a|ogg|mp4)$/i.test(file)) {
      let st; try { st = fs.statSync(file); } catch { return send(res, 404, 'not found', 'text/plain'); }
      const type = TYPES[path.extname(file).toLowerCase()];
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (m) {
        const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
        if (start >= st.size) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end(); }
        res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${st.size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1, 'cache-control': 'public, max-age=86400' });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': st.size, 'cache-control': 'public, max-age=86400' });
      return fs.createReadStream(file).pipe(res);
    }
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'not found', 'text/plain');
      send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: String(e.message || e) });
  }
});

// ---------- WebSocket арены ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, PUBLIC_URL);
  const u = url.pathname === '/ws' && userFrom(url.searchParams.get('init'), url.searchParams.get('dev'));
  if (!u) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
  const duelId = url.searchParams.get('duel');
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (duelId) {
      // дуэль: своя комната, своя карта
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (data) => { try { const m = JSON.parse(data); if (m.t === 'in') duels.input(ws, m); else if (m.t === 'emo') duels.emote(ws, m.e); } catch { /* */ } });
      ws.on('close', () => { duels.leave(ws); scheduleFlush(); });
      ws.on('error', () => duels.leave(ws));
      duels.join(ws, u, duelId);
      return;
    }
    arena.join(ws, u);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data) => {
      try { const m = JSON.parse(data); if (m.t === 'in') arena.input(ws, m); else if (m.t === 'emo') arena.emote(ws, m.e); } catch { /* мусор игнорируем */ }
    });
    ws.on('close', () => { arena.leave(ws); scheduleFlush(); });
    ws.on('error', () => arena.leave(ws));
  });
});
// выкидываем «мёртвые» соединения
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) ws.terminate(); else { ws.isAlive = false; ws.ping(); } } }, 30000).unref();

// подключение бота к Телеграму; результат виден на /health
let botStatus = { state: 'ещё не подключался' };
async function connectBot() {
  try {
    const info = await bot.webhookInfo();
    if (info?.url === PUBLIC_URL + '/tg' && !info.last_error_message) { botStatus = { state: 'ok', username: store.meta.bot?.username, pending: info.pending_update_count }; return; }
    const r = await bot.setup(PUBLIC_URL + '/tg', HOOK_SECRET);
    const after = await bot.webhookInfo();
    botStatus = { state: r?.webhook ? 'ok' : 'ошибка', username: r?.bot?.username, webhook: r?.webhook, lastError: after?.last_error_message, tgError: bot.lastError };
    console.log('Бот:', JSON.stringify(botStatus));
    scheduleFlush();
  } catch (e) { botStatus = { state: 'ошибка', error: e.message }; console.error('connectBot', e); }
}

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Захват Говсан запущен: ${PUBLIC_URL} (порт ${PORT})`);
  if (TOKEN && PUBLIC_URL.startsWith('https://')) {
    await connectBot();
    // проверяем вебхук раз в 10 минут и чиним, если слетел
    setInterval(connectBot, 10 * 60 * 1000);
    // бесплатный хостинг засыпает без запросов: раз в 10 минут стучимся сами в себя
    setInterval(() => fetch(PUBLIC_URL + '/health').catch(() => {}), 10 * 60 * 1000);
  }
});

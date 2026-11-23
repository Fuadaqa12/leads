// Сервер Арены Хаоса (Node.js): раздаёт игру, держит онлайн-арену по WebSocket, принимает вебхук Телеграма.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Arena } from './arena.js';
import { createBot } from './bot.js';
import { checkInitData, devUser } from './auth.js';
import { FileKV, GistKV } from './storage.js';
import * as store from './store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = +process.env.PORT || 8080;
const TOKEN = process.env.BOT_TOKEN || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DEV = process.env.DEV_MODE === '1';
// Секрет вебхука выводится из токена, чтобы не заводить лишних ключей
const HOOK_SECRET = crypto.createHash('sha256').update('arena-hook:' + TOKEN).digest('hex').slice(0, 40);
const MILESTONES = [3, 5, 8, 12, 16, 20, 25, 30];

// ---------- база ----------
const kv = process.env.GH_GIST_TOKEN ? new GistKV(process.env.GH_GIST_TOKEN) : new FileKV(path.join(ROOT, 'data', 'db.json'));
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
const arena = new Arena({ onAnnounce: (html) => bot?.announce(html) });
arena.onTick = scheduleFlush;
bot = createBot({ token: TOKEN, publicUrl: PUBLIC_URL, miniAppShort: process.env.MINIAPP_SHORT || '', arena });

function userFrom(init, dev) {
  if (DEV && dev) return devUser(dev);
  return checkInitData(init, TOKEN);
}

function profile(p) {
  return {
    name: p.name, creator: p.creator, trophies: p.trophies, medals: p.medals, title: store.titleFor(p),
    rank: store.rankOf(p), eggs: p.eggs, soloBest: p.soloBest, skin: p.skin, medalList: p.medalList.slice(-30),
    online: arena.humans(),
  };
}

function api(route, p, body) {
  switch (route) {
    case '/api/me': {
      const top = store.leaderboard(20).map(x => ({ name: x.creator ? '👑 ' + x.name : x.name, trophies: x.trophies, medals: x.medals, title: store.titleFor(x), me: x.id === p.id }));
      return { me: profile(p), top };
    }
    case '/api/skin': {
      const ok = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'teal'].includes(body.skin) || (body.skin === 'pirate' && p.eggs.includes('flag'));
      if (ok) { p.skin = body.skin; store.save(p); }
      return { me: profile(p) };
    }
    case '/api/egg': {
      // с клиента можно получить только «флаг» (7 тапов по логотипу)
      const fresh = body.egg === 'flag' ? store.giveEgg(p, 'flag') : false;
      return { fresh, me: profile(p) };
    }
    case '/api/solo': {
      const wave = Math.floor(+body.wave || 0), time = +body.time || 0;
      // защита от читов: волна не может пройти быстрее ~6 секунд
      if (wave < 0 || wave > 60 || time < wave * 6) return { error: 'странный результат 🤨' };
      const got = [];
      if (wave > p.soloBest) { p.soloBest = wave; store.save(p); }
      for (const m of MILESTONES) if (wave >= m && store.giveMedal(p, 'solo:' + m, `🌊 Шторм: пережил ${m} волн`)) got.push(`🌊 Шторм: пережил ${m} волн`);
      const today = new Date().toISOString().slice(0, 10);
      if (body.daily === today && wave >= 5 && store.giveMedal(p, 'daily:' + today, `📅 Испытание дня ${today}`)) got.push(`📅 Испытание дня ${today}`);
      return { got, me: profile(p) };
    }
  }
  return { error: 'unknown' };
}

// ---------- HTTP ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-cache' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok) => {
  let s = ''; req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); });
  req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { ok({}); } });
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL);
  const p = url.pathname;
  try {
    if (p === '/health') return send(res, 200, { ok: true, online: arena.humans() });
    if (p === '/tg' && req.method === 'POST') {
      if (req.headers['x-telegram-bot-api-secret-token'] !== HOOK_SECRET) return send(res, 403, 'nope', 'text/plain');
      const u = await readBody(req);
      // Телеграму всегда отвечаем 200, иначе он будет слать апдейт повторно
      await bot.handleUpdate(u).catch(e => console.error('update', e));
      scheduleFlush();
      return send(res, 200, 'ok', 'text/plain');
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
    // статика
    const file = path.join(PUBLIC, p === '/' ? 'index.html' : path.normalize(p).replace(/^([/\\])+/, ''));
    if (!file.startsWith(PUBLIC)) return send(res, 403, 'nope', 'text/plain');
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
  wss.handleUpgrade(req, socket, head, (ws) => {
    arena.join(ws, u);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data) => {
      try { const m = JSON.parse(data); if (m.t === 'in') arena.input(ws, m); } catch { /* мусор игнорируем */ }
    });
    ws.on('close', () => { arena.leave(ws); scheduleFlush(); });
    ws.on('error', () => arena.leave(ws));
  });
});
// выкидываем «мёртвые» соединения
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) ws.terminate(); else { ws.isAlive = false; ws.ping(); } } }, 30000).unref();

server.listen(PORT, async () => {
  console.log(`Арена Хаоса запущена: ${PUBLIC_URL} (порт ${PORT})`);
  if (TOKEN && PUBLIC_URL.startsWith('https://')) {
    const r = await bot.setup(PUBLIC_URL + '/tg', HOOK_SECRET).catch(e => ({ error: e.message }));
    console.log('Бот:', r?.bot?.username ? '@' + r.bot.username : 'не подключился', '| вебхук:', r?.webhook);
    scheduleFlush();
    // бесплатный хостинг засыпает без запросов: раз в 10 минут стучимся сами в себя
    setInterval(() => fetch(PUBLIC_URL + '/health').catch(() => {}), 10 * 60 * 1000);
  }
});

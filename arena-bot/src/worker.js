// Точка входа Cloudflare Worker + Durable Object «Game», где живут арена, бот и база игроков
import { DurableObject } from 'cloudflare:workers';
import { Arena } from './arena.js';
import { createBot } from './bot.js';
import { checkInitData, devUser } from './auth.js';
import * as store from './store.js';

async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Секрет вебхука выводится из токена, чтобы не заводить лишних ключей
const hookSecret = async (token) => (await sha('arena-hook:' + token)).slice(0, 40);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p === '/ws' || p.startsWith('/api/') || p === '/tg' || p === '/setup') {
      if (p === '/tg' || p === '/setup') {
        const secret = await hookSecret(env.BOT_TOKEN || '');
        const given = p === '/tg' ? req.headers.get('x-telegram-bot-api-secret-token') : url.searchParams.get('key');
        if (!env.BOT_TOKEN || given !== secret) return new Response('nope', { status: 403 });
      }
      const stub = env.GAME.get(env.GAME.idFromName('main'));
      return stub.fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const MILESTONES = [3, 5, 8, 12, 16, 20, 25, 30];

export class Game extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.ready = ctx.blockConcurrencyWhile(() => store.load(ctx.storage));
    this.arena = new Arena({ onAnnounce: (html) => this.bot.announce(html) });
    this.flushT = null;
    this.arena.onTick = () => this.scheduleFlush();
  }

  get bot() {
    return this._bot ||= createBot({
      token: this.env.BOT_TOKEN, publicUrl: store.meta.publicUrl, miniAppShort: this.env.MINIAPP_SHORT || '', arena: this.arena,
    });
  }

  scheduleFlush() {
    if (this.flushT) return;
    this.flushT = setTimeout(() => { this.flushT = null; store.flush(this.ctx.storage).catch(e => console.error('flush', e)); }, 2000);
  }

  user(init, dev) {
    if (this.env.DEV_MODE === '1' && dev) return devUser(dev);
    return checkInitData(init, this.env.BOT_TOKEN);
  }

  async fetch(req) {
    await this.ready;
    const url = new URL(req.url);
    try {
      switch (url.pathname) {
        case '/ws': return this.ws(req, url);
        case '/tg': {
          const u = await req.json();
          // Телеграму всегда отвечаем 200, иначе он будет слать апдейт повторно
          await this.bot.handleUpdate(u).catch(e => console.error('update', e));
          this.scheduleFlush();
          return new Response('ok');
        }
        case '/setup': {
          store.meta.publicUrl = url.origin; store.save();
          this._bot = null;
          const r = await this.bot.setup(url.origin + '/tg', await hookSecret(this.env.BOT_TOKEN));
          await store.flush(this.ctx.storage);
          return json(r);
        }
      }
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
      const body = await req.json().catch(() => ({}));
      const tgUser = this.user(body.init, body.dev);
      if (!tgUser) return json({ error: 'auth' }, 401);
      const p = store.getPlayer(tgUser);
      const res = await this.api(url.pathname, p, body);
      this.scheduleFlush();
      return json(res);
    } catch (e) {
      console.error(e);
      return json({ error: String(e.message || e) }, 500);
    }
  }

  profile(p) {
    return {
      name: p.name, creator: p.creator, trophies: p.trophies, medals: p.medals, title: store.titleFor(p),
      rank: store.rankOf(p), eggs: p.eggs, soloBest: p.soloBest, skin: p.skin, medalList: p.medalList.slice(-30),
      online: this.arena.humans(),
    };
  }

  async api(path, p, body) {
    switch (path) {
      case '/api/me': {
        const top = store.leaderboard(20).map(x => ({ name: x.creator ? '👑 ' + x.name : x.name, trophies: x.trophies, medals: x.medals, title: store.titleFor(x), me: x.id === p.id }));
        return { me: this.profile(p), top };
      }
      case '/api/skin': {
        const ok = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'teal'].includes(body.skin) || (body.skin === 'pirate' && p.eggs.includes('flag'));
        if (ok) { p.skin = body.skin; store.save(p); }
        return { me: this.profile(p) };
      }
      case '/api/egg': {
        // с клиента можно получить только «флаг» (7 тапов по логотипу)
        const fresh = body.egg === 'flag' ? store.giveEgg(p, 'flag') : false;
        return { fresh, me: this.profile(p) };
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
        return { got, me: this.profile(p) };
      }
    }
    return { error: 'unknown' };
  }

  ws(req, url) {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('ws only', { status: 426 });
    const tgUser = this.user(url.searchParams.get('init'), url.searchParams.get('dev'));
    if (!tgUser) return new Response('auth', { status: 401 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.arena.join(server, tgUser);
    server.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.t === 'in') this.arena.input(server, msg);
      } catch { /* мусор игнорируем */ }
    });
    const bye = () => { this.arena.leave(server); this.scheduleFlush(); };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
}

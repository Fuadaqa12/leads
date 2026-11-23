import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
// Телеграм-бот: команды в группе и в личке, кнопка запуска игры, анонсы
import * as store from './store.js';
import { esc } from './arena.js';

const PIRATE_CODE = [
  '🏴‍☠️ <b>Пиратский кодекс Говсан</b>',
  '1. Кто не замкнул круг, тот ничего не захватил.',
  '2. Свой квартал защищай лбом: на своей земле ты поглощаешь любого.',
  '3. Чужой след переехал — человек улетел. Не оставляй свой след надолго.',
  '4. Видишь букву на дороге — бери. F-U-A-D, запомни.',
  '5. Пират Fuadaqa12 приезжает без предупреждения. Режь его след.',
  '6. Ныть в чат после аварии разрешено не более 3 сообщений.',
].join('\n');

const LEGEND = [
  '📜 <b>Легенда о Fuadaqa12</b>',
  '',
  'Говорят, давным-давно парень по имени Фуад собрал этого бота своими руками.',
  'Он дал ключ от него одному ИИ и сказал: «Сделай что-то пиздатое».',
  'ИИ сделал пиратское море, но Фуад сказал: «Не, давай Говсан».',
  'С тех пор по улицам Говсан носится Пират Fuadaqa12 и отжимает дворы.',
  '',
  '<i>А ещё говорят, где-то в Говсан Гугл запомнил чью-то припаркованную тачку...</i>',
].join('\n');

export const SHORT = '🚗 Гоняй по улицам Говсан, замыкай круги и отжимай районы у друзей. Кто держит больше — тот король.';
export const DESCRIPTION = [
  '🏁 Добро пожаловать в Говсан!',
  '',
  'Это война за район. Садишься в тачку и гоняешь по настоящим улицам Говсан вместе с друзьями на одной карте.',
  '',
  '🎨 За тобой тянется след: замкнул круг — всё внутри твоего цвета',
  '😈 Отжимай чужие кварталы',
  '💥 На своей земле лоб в лоб — чужак улетает',
  '✂️ Переехал чужой след — его хозяин в кювете',
  '👑 Кто держит больше района — король Говсан',
  '🏅 Соло-гонки, медали и 8 пасхалок',
  '',
  'Жми «Старт» и погнали 👇',
].join('\n');

export function createBot({ token, publicUrl, miniAppShort, arena }) {
  let lastError = null;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const api = async (method, body = {}, tries = 3) => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      const j = await r.json().catch(() => ({}));
      // 429: Телеграм просит подождать, ждём сколько сказал и пробуем снова
      if (j.error_code === 429 && tries > 1) {
        const wait = Math.min((j.parameters?.retry_after || 5) + 1, 90);
        console.warn('TG', method, 'ждём', wait, 'сек');
        await sleep(wait * 1000);
        return api(method, body, tries - 1);
      }
      if (!j.ok) { console.warn('TG', method, j.description); lastError = `${method}: ${j.description}`; }
      return j.result;
    } catch (e) {
      console.warn('TG fail', method, e.message); lastError = `${method}: ${e.message}`;
      return null;
    }
  };
  let me = null;

  const playUrlFor = (chat) => {
    if (chat.type === 'private') return null;
    if (!me) return publicUrl;
    if (miniAppShort === 'main') return `https://t.me/${me.username}?startapp=arena`;
    if (miniAppShort) return `https://t.me/${me.username}/${miniAppShort}?startapp=arena`;
    return `https://t.me/${me.username}?start=play`;
  };
  const playKeyboard = (chat, text = '🚗 Играть') => {
    if (chat.type === 'private') return { inline_keyboard: [[{ text, web_app: { url: publicUrl } }]] };
    return { inline_keyboard: [[{ text, url: playUrlFor(chat) }]] };
  };
  // Первый ответ на апдейт отдаём прямо в ответе на вебхук: так бот отвечает,
  // даже если исходящие запросы к Телеграму сейчас упираются в лимит
  const slots = new AsyncLocalStorage();
  const reply = (msg, text, extra = {}) => {
    const body = {
      chat_id: msg.chat.id, text, parse_mode: 'HTML', disable_web_page_preview: true,
      reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true }, ...extra,
    };
    const slot = slots.getStore();
    if (slot && !slot.body) { slot.body = { method: 'sendMessage', ...body }; return Promise.resolve(true); }
    return api('sendMessage', body, 1);
  };

  function topText() {
    const list = arena.top().slice(0, 15);
    if (!list.length) return '🏆 Топ пока пуст. Захвати первый квартал!';
    const icons = ['🥇', '🥈', '🥉'];
    const lines = list.map(({ p, pct }, i) => {
      const nm = esc(p.creator ? '👑 ' + (p.name || 'Fuad') : p.name || 'Гонщик');
      return `${icons[i] || `${i + 1}.`} <b>${nm}</b>  🏘 ${pct.toFixed(1)}%  ·  🏅 ${p.medals}\n      <i>${store.titleFor(p, pct)}</i>`;
    });
    return `🚗 <b>ТОП ГОВСАН</b>\n<i>место решает, какая часть района твоя 🏘. Медали 🏅 из соло идут бонусом</i>\n\n${lines.join('\n')}`;
  }

  function meText(p) {
    const pct = arena.pctOf(p), list = arena.top();
    const rank = (list.findIndex(x => x.p.id === p.id) + 1) || '—';
    return [
      `🧭 <b>${esc(p.name || 'Гонщик')}</b>  ${store.titleFor(p, pct)}`,
      `Место в топе: <b>#${rank}</b>`,
      `🏘 Твоя часть Говсан: <b>${pct.toFixed(1)}%</b>`,
      `🏅 Медали: <b>${p.medals}</b>`,
      `💥 Разбил: ${p.kills}  ·  🚑 Разбился: ${p.deaths}  ·  ☠️ Пиратов: ${p.bossKills}`,
      `⏱ Рекорд соло: ${p.soloBest || 0}%`,
      `🥚 Пасхалки: ${p.eggs.length}/${Object.keys(store.EGGS).length}`,
    ].join('\n');
  }

  async function handle(msg) {
    const text = (msg.text || '').trim();
    if (!text) return;
    store.rememberChat(msg.chat);
    const m = text.match(/^\/([\wа-яё]+)(?:@(\w+))?(?:\s+(.*))?$/i);
    if (!m) return;
    if (m[2] && me && m[2].toLowerCase() !== me.username.toLowerCase()) return;
    const cmd = m[1].toLowerCase();
    const arg = (m[3] || '').trim();
    const p = store.getPlayer(msg.from);

    switch (cmd) {
      case 'start':
      case 'help':
        if (arg === 'play' || cmd === 'start' && msg.chat.type === 'private') {
          return reply(msg, `🚗 <b>Захват Говсан</b>\n\nВсе гоняют по улицам Говсан на одной карте одновременно. За машиной тянется след: замкнул круг — всё внутри стало твоего цвета. Чужие кварталы тоже можно отжать.\n\nНа своей земле ты сильнее: врежешься лоб в лоб с чужаком — он улетает. Переехал чужой след — его хозяин разбился.\n\nКто держит больше района, тот выше в топе. В соло «Гонка» добываешь медали 🏅. И пасхалки 🥚 тоже есть.\n\nЖми кнопку 👇`, { reply_markup: playKeyboard(msg.chat, '🚗 Погнали') });
        }
        return reply(msg, `🚗 <b>Захват Говсан</b>\n\n/arena — кнопка входа в игру\n/top — топ игроков\n/me — мой профиль\n/medals — мои медали\n/eggs — подсказки к пасхалкам\n/announce — вкл/выкл анонсы в этом чате`, { reply_markup: playKeyboard(msg.chat) });
      case 'arena': case 'play': case 'game': case 'играть': case 'арена':
        return reply(msg, `🚗 <b>Говсан ждёт!</b>\nСейчас на улицах: ${arena.humans()} ${plural(arena.humans(), 'гонщик', 'гонщика', 'гонщиков')}`, { reply_markup: playKeyboard(msg.chat, '🚗 Погнали') });
      case 'top': case 'топ':
        return reply(msg, topText(), { reply_markup: playKeyboard(msg.chat) });
      case 'me': case 'profile': case 'я':
        return reply(msg, meText(p));
      case 'medals': case 'медали': {
        if (!p.medalList.length) return reply(msg, '🏅 Медалей пока нет. Иди в соло «Гонка» и захвати 10% района!');
        return reply(msg, `🏅 <b>Медали ${esc(p.name)}</b> (${p.medals})\n\n` + p.medalList.map(x => '• ' + esc(x.l)).join('\n'));
      }
      case 'eggs': case 'пасхалки': {
        const lines = Object.entries(store.EGGS).map(([k, e]) => p.eggs.includes(k) ? `✅ <b>${e.name}</b>` : `❔ <i>${e.hint}</i>`);
        return reply(msg, `🥚 <b>Пасхалки</b> ${p.eggs.length}/${lines.length}\nЗа каждую найденную: +1 медаль 🏅\n\n${lines.join('\n')}`);
      }
      case 'pirate': case 'пират': {
        const fresh = store.giveEgg(p, 'pirate_cmd');
        return reply(msg, PIRATE_CODE + (fresh ? '\n\n🥚 <b>Пасхалка найдена!</b> +1 медаль 🏅' : ''));
      }
      case 'fuad': case 'fuadaqa12': case 'фуад': {
        const fresh = store.giveEgg(p, 'legend');
        return reply(msg, LEGEND + (fresh ? '\n\n🥚 <b>Пасхалка найдена!</b> +1 медаль 🏅' : ''));
      }
      case 'announce': {
        const c = store.chat(msg.chat.id);
        if (!c) return reply(msg, 'Анонсы работают только в группах.');
        c.announce = !c.announce; store.save();
        return reply(msg, c.announce ? '📣 Анонсы включены.' : '🔕 Анонсы выключены.');
      }
    }
  }

  let meP = null;
  async function ensureMe() {
    if (me) return me;
    if (store.meta.bot) return (me = store.meta.bot);
    meP ||= api('getMe').then(r => {
      meP = null;
      if (r) { me = r; store.meta.bot = { id: r.id, username: r.username }; store.save(); }
      return me;
    });
    return meP;
  }

  // Разовая настройка: вебхук, команды, кнопка меню
  async function setup(webhookUrl, secret) {
    me = null; delete store.meta.bot;
    await ensureMe();
    const res = {};
    // сначала главное: вебхук, без него бот молчит
    res.webhook = await api('setWebhook', { url: webhookUrl, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: false });
    // остальное ставим только если поменялось, чтобы не ловить лимиты Телеграма
    const sig = crypto.createHash('sha1').update(JSON.stringify([publicUrl, DESCRIPTION, SHORT, 2])).digest('hex');
    if (res.webhook && store.meta.setupSig === sig) { res.bot = me; return res; }
    res.commands = await api('setMyCommands', { commands: [
      { command: 'arena', description: '🚗 Погнали' },
      { command: 'top', description: '🏆 Топ игроков' },
      { command: 'me', description: '🧭 Мой профиль' },
      { command: 'medals', description: '🏅 Мои медали' },
      { command: 'eggs', description: '🥚 Пасхалки' },
      { command: 'help', description: '❓ Помощь' },
    ] });
    res.menu = await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Играть', web_app: { url: publicUrl } } });
    res.description = await api('setMyDescription', { description: DESCRIPTION });
    res.short = await api('setMyShortDescription', { short_description: SHORT });
    if (res.webhook && res.commands && res.menu) { store.meta.setupSig = sig; store.save(); }
    res.bot = me;
    return res;
  }

  // возвращает метод, который сервер отдаст Телеграму прямо в ответе на вебхук
  async function handleUpdate(u) {
    ensureMe().catch(() => {}); // не ждём: при лимите getMe ждал бы минуту
    const slot = {};
    if (u.message) await slots.run(slot, () => handle(u.message)).catch(e => console.error('handle', e));
    return slot.body || null;
  }

  return {
    setup, handleUpdate,
    webhookInfo: () => api('getWebhookInfo'),
    get lastError() { return lastError; },
    announce(html) {
      if (!me) return;
      const jobs = [];
      for (const c of store.chats()) if (c.announce) jobs.push(api('sendMessage', { chat_id: c.id, text: html, parse_mode: 'HTML', reply_markup: playKeyboard({ type: 'group' }, '🚗 В Говсан') }));
      return Promise.all(jobs);
    },
  };
}

function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }

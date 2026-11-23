// Телеграм-бот: команды в группе и в личке, кнопка запуска игры, анонсы
import * as store from './store.js';
import { esc } from './arena.js';

const PIRATE_CODE = [
  '🏴‍☠️ <b>Пиратский кодекс Арены Хаоса</b>',
  '1. Кто не стреляет, тот кормит рыб.',
  '2. Золото выпадает из всех, кроме Фуада. У Фуада золото в сердце.',
  '3. Если видишь букву в море, плыви к ней. F-U-A-D, запомни.',
  '4. Босса бьют толпой. Одному его не утопить, проверено.',
  '5. Ныть в чат после смерти разрешено не более 3 сообщений.',
].join('\n');

const LEGEND = [
  '📜 <b>Легенда о Fuadaqa12</b>',
  '',
  'Говорят, давным-давно капитан по имени Фуад собрал этот корабль своими руками.',
  'Он дал ключ от него одному боту и сказал: «Сделай что-то пиздатое».',
  'С тех пор в водах Арены бродит призрак Пирата Fuadaqa12,',
  'а у северо-восточного острова зарыт клад, который мало кто нашёл.',
  '',
  '<i>Ищи там, где песок встречается с морем...</i>',
].join('\n');

export function createBot({ token, publicUrl, miniAppShort, arena }) {
  const api = async (method, body = {}) => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) console.warn('TG', method, j.description);
      return j.result;
    } catch (e) {
      console.warn('TG fail', method, e.message);
      return null;
    }
  };
  let me = null;

  const playUrlFor = (chat) => {
    if (chat.type === 'private') return null;
    if (miniAppShort === 'main') return `https://t.me/${me.username}?startapp=arena`;
    if (miniAppShort) return `https://t.me/${me.username}/${miniAppShort}?startapp=arena`;
    return `https://t.me/${me.username}?start=play`;
  };
  const playKeyboard = (chat, text = '⚔️ Играть') => {
    if (chat.type === 'private') return { inline_keyboard: [[{ text, web_app: { url: publicUrl } }]] };
    return { inline_keyboard: [[{ text, url: playUrlFor(chat) }]] };
  };
  const reply = (msg, text, extra = {}) => api('sendMessage', {
    chat_id: msg.chat.id, text, parse_mode: 'HTML', disable_web_page_preview: true,
    reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true }, ...extra,
  });

  function topText() {
    const list = store.leaderboard(15);
    if (!list.length) return '🏆 Топ пока пуст. Выходи в море первым!';
    const medalsIcon = ['🥇', '🥈', '🥉'];
    const lines = list.map((p, i) => {
      const nm = esc(p.creator ? '👑 ' + (p.name || 'Fuad') : p.name || 'Пират');
      return `${medalsIcon[i] || `${i + 1}.`} <b>${nm}</b>  🏆 ${p.trophies}  ·  🏅 ${p.medals}\n      <i>${store.titleFor(p)}</i>`;
    });
    return `🏴‍☠️ <b>ТОП АРЕНЫ ХАОСА</b>\n<i>место решают кубки 🏆 из онлайн-арены, медали 🏅 из соло идут бонусом</i>\n\n${lines.join('\n')}`;
  }

  function meText(p) {
    const eggs = Object.keys(store.EGGS);
    return [
      `🧭 <b>${esc(p.name || 'Пират')}</b>  ${store.titleFor(p)}`,
      `Место в топе: <b>#${store.rankOf(p)}</b>`,
      `🏆 Кубки: <b>${p.trophies}</b>`,
      `🏅 Медали: <b>${p.medals}</b>`,
      `💥 Потоплено: ${p.kills}  ·  ☠️ Утонул: ${p.deaths}  ·  👹 Боссов: ${p.bossKills}`,
      `🌊 Рекорд в соло: волна ${p.soloBest}`,
      `🥚 Пасхалки: ${p.eggs.length}/${eggs.length}`,
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
          return reply(msg, `🏴‍☠️ <b>Арена Хаоса</b>\n\nОнлайн-море, где все плавают на одной карте одновременно. Топи друзей, собирай золото, качай корабль. За победы капают кубки 🏆, по ним строится топ.\n\nВ соло-режиме «Шторм» отбивайся от волн и собирай медали 🏅.\n\nА ещё тут спрятаны пасхалки 🥚 Найдёшь все?\n\nЖми кнопку 👇`, { reply_markup: playKeyboard(msg.chat, '⚔️ Выйти в море') });
        }
        return reply(msg, `🏴‍☠️ <b>Арена Хаоса</b>\n\n/arena — кнопка входа в игру\n/top — топ игроков\n/me — мой профиль\n/medals — мои медали\n/eggs — подсказки к пасхалкам\n/announce — вкл/выкл анонсы боссов в этом чате`, { reply_markup: playKeyboard(msg.chat) });
      case 'arena': case 'play': case 'game': case 'играть': case 'арена':
        return reply(msg, `⚔️ <b>Море ждёт!</b>\nСейчас в море: ${arena.humans()} ${plural(arena.humans(), 'пират', 'пирата', 'пиратов')}`, { reply_markup: playKeyboard(msg.chat, '⚔️ Выйти в море') });
      case 'top': case 'топ':
        return reply(msg, topText(), { reply_markup: playKeyboard(msg.chat) });
      case 'me': case 'profile': case 'я':
        return reply(msg, meText(p));
      case 'medals': case 'медали': {
        if (!p.medalList.length) return reply(msg, '🏅 Медалей пока нет. Иди в соло-режим «Шторм» и переживи 3 волны!');
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
        return reply(msg, c.announce ? '📣 Анонсы боссов включены.' : '🔕 Анонсы боссов выключены.');
      }
    }
  }

  async function ensureMe() {
    if (me) return me;
    if (store.meta.bot) return (me = store.meta.bot);
    me = await api('getMe');
    if (me) { store.meta.bot = { id: me.id, username: me.username }; store.save(); }
    return me;
  }

  // Разовая настройка: вебхук, команды, кнопка меню
  async function setup(webhookUrl, secret) {
    me = null; delete store.meta.bot;
    await ensureMe();
    const res = {};
    res.webhook = await api('setWebhook', { url: webhookUrl, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: false });
    res.commands = await api('setMyCommands', { commands: [
      { command: 'arena', description: '⚔️ Выйти в море' },
      { command: 'top', description: '🏆 Топ игроков' },
      { command: 'me', description: '🧭 Мой профиль' },
      { command: 'medals', description: '🏅 Мои медали' },
      { command: 'eggs', description: '🥚 Пасхалки' },
      { command: 'help', description: '❓ Помощь' },
    ] });
    res.menu = await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Играть', web_app: { url: publicUrl } } });
    res.description = await api('setMyDescription', { description: '🏴‍☠️ Арена Хаоса: пиратская онлайн-битва для вашей группы. Одно море на всех, кубки, медали, босс и пасхалки. Жми «Играть»!' });
    res.short = await api('setMyShortDescription', { short_description: '🏴‍☠️ Онлайн-битва пиратов для групп. Топ, медали, пасхалки.' });
    res.bot = me;
    return res;
  }

  async function handleUpdate(u) {
    await ensureMe();
    if (u.message) await handle(u.message).catch(e => console.error('handle', e));
  }

  return {
    setup, handleUpdate,
    announce(html) {
      if (!me) return;
      const jobs = [];
      for (const c of store.chats()) if (c.announce) jobs.push(api('sendMessage', { chat_id: c.id, text: html, parse_mode: 'HTML', reply_markup: playKeyboard({ type: 'group' }, '⚔️ В бой') }));
      return Promise.all(jobs);
    },
  };
}

function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }

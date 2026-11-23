// Проверка подписи Telegram Mini App (initData), чтобы никто не подделал игрока
import crypto from 'node:crypto';

export function checkInitData(initData, botToken, maxAgeSec = 86400 * 7) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheck = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = +params.get('auth_date');
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try { return JSON.parse(params.get('user')); } catch { return null; }
}

// Режим разработки: игрок без Телеграма (только при DEV_MODE=1)
export function devUser(q) {
  const id = 'dev' + String(q || '1').replace(/\W/g, '').slice(0, 12);
  return { id, first_name: 'Тестер ' + id.slice(3), username: q === 'fuad' ? 'Fuadaqa12' : '' };
}

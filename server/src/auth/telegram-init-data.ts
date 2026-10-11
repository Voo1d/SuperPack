import { createHmac, timingSafeEqual } from 'node:crypto';

export type InitDataErrorCode =
  | 'INIT_DATA_MISSING'
  | 'INIT_DATA_MALFORMED'
  | 'INIT_DATA_BAD_SIGNATURE'
  | 'INIT_DATA_EXPIRED'
  | 'INIT_DATA_FROM_FUTURE';

export class InitDataError extends Error {
  constructor(
    readonly code: InitDataErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: number;
}

const MAX_LENGTH = 8192;
const MAX_FUTURE_SKEW_SECONDS = 60;

/**
 * Проверка подписи Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * secret = HMAC_SHA256(key="WebAppData", data=bot_token); hash = HMAC_SHA256(key=secret, data=data_check_string).
 * Telegram ID берётся только из подписанного поля `user`, поэтому клиент не может подставить чужой ID.
 */
export function verifyInitData(
  initData: string | undefined,
  botToken: string,
  opts: { maxAgeSeconds: number; now?: number },
): VerifiedInitData {
  if (!initData || !initData.trim()) throw new InitDataError('INIT_DATA_MISSING', 'initData не передан');
  if (initData.length > MAX_LENGTH) throw new InitDataError('INIT_DATA_MALFORMED', 'initData слишком длинный');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) throw new InitDataError('INIT_DATA_MALFORMED', 'В initData нет корректного hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  const actual = Buffer.from(hash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new InitDataError('INIT_DATA_BAD_SIGNATURE', 'Подпись initData неверна');
  }

  // Подпись верна — только теперь доверяем содержимому.
  const authDate = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(authDate) || authDate <= 0) throw new InitDataError('INIT_DATA_MALFORMED', 'Некорректный auth_date');
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (authDate - now > MAX_FUTURE_SKEW_SECONDS) throw new InitDataError('INIT_DATA_FROM_FUTURE', 'auth_date в будущем');
  if (now - authDate > opts.maxAgeSeconds) throw new InitDataError('INIT_DATA_EXPIRED', 'Срок действия initData истёк');

  let raw: unknown;
  try {
    raw = JSON.parse(params.get('user') ?? '');
  } catch {
    throw new InitDataError('INIT_DATA_MALFORMED', 'В initData нет пользователя');
  }
  const u = raw as { id?: unknown; first_name?: unknown; last_name?: unknown; username?: unknown; is_bot?: unknown };
  if (!u || typeof u !== 'object' || typeof u.id !== 'number' || !Number.isSafeInteger(u.id) || u.id <= 0 || u.is_bot === true) {
    throw new InitDataError('INIT_DATA_MALFORMED', 'Некорректный пользователь в initData');
  }
  return {
    authDate,
    user: {
      id: u.id,
      firstName: typeof u.first_name === 'string' ? u.first_name : '',
      lastName: typeof u.last_name === 'string' ? u.last_name : undefined,
      username: typeof u.username === 'string' ? u.username : undefined,
    },
  };
}

/** Собирает подписанный initData. Используется только в тестах и локальных скриптах проверки. */
export function signInitData(
  fields: Record<string, string>,
  botToken: string,
): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

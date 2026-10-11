import { z } from 'zod';

export const CONFIG = Symbol('CONFIG');

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  ADMIN_TELEGRAM_IDS: z.string().default(''),
  INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().min(60).default(86400),
  DEV_AUTH: bool,
  DEV_TELEGRAM_ID: z.coerce.number().int().positive().optional(),
  DEV_USER_NAME: z.string().default('Dev User'),
  APP_TIMEZONE: z.string().default('Asia/Tashkent'),
  WEB_DIST: z.string().optional(),
});

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  botToken: string | undefined;
  /** Telegram ID администраторов из окружения: всегда активны и имеют роль admin. */
  adminTelegramIds: number[];
  initDataMaxAgeSeconds: number;
  devAuth: { telegramId: number; name: string } | null;
  timezone: string;
  webDist: string | undefined;
}

export function parseAdminIds(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const n = Number(s);
      if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`ADMIN_TELEGRAM_IDS: некорректный Telegram ID "${s}"`);
      return n;
    });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Пустые значения из .env.example («DEV_TELEGRAM_ID=») считаем незаданными.
  const filled = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = schema.safeParse(filled);
  if (!parsed.success) {
    throw new Error('Некорректная конфигурация: ' + parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';
  if (e.DEV_AUTH && isProduction) {
    throw new Error('DEV_AUTH нельзя включать при NODE_ENV=production');
  }
  if (e.DEV_AUTH && !e.DEV_TELEGRAM_ID) {
    throw new Error('DEV_AUTH=true требует DEV_TELEGRAM_ID (задаётся на сервере, клиент его не выбирает)');
  }
  if (!e.DEV_AUTH && !e.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN обязателен (или явно включите DEV_AUTH=true для локальной разработки)');
  }
  return {
    nodeEnv: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    botToken: e.TELEGRAM_BOT_TOKEN || undefined,
    adminTelegramIds: parseAdminIds(e.ADMIN_TELEGRAM_IDS),
    initDataMaxAgeSeconds: e.INIT_DATA_MAX_AGE_SECONDS,
    devAuth: e.DEV_AUTH ? { telegramId: e.DEV_TELEGRAM_ID!, name: e.DEV_USER_NAME } : null,
    timezone: e.APP_TIMEZONE,
    webDist: e.WEB_DIST,
  };
}

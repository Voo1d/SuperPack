import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import { configureApp } from '../src/app-setup';
import { AppModule } from '../src/app.module';
import { AppConfig } from '../src/config';
import { DB, Database } from '../src/db/db.module';
import { runMigrations } from '../src/db/migrate';
import { signInitData } from '../src/auth/telegram-init-data';

export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? 'postgres://superpack:superpack@localhost:5432/superpack_test';
export const BOT_TOKEN = '123456:TEST-TOKEN-NOT-REAL';
export const ADMIN_ID = 1000001;
export const STOREKEEPER_ID = 2000002;
export const OUTSIDER_ID = 3000003;

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    isProduction: false,
    port: 0,
    databaseUrl: TEST_DB_URL,
    botToken: BOT_TOKEN,
    adminTelegramIds: [ADMIN_ID],
    initDataMaxAgeSeconds: 86400,
    devAuth: null,
    timezone: 'Asia/Tashkent',
    webDist: '/nonexistent',
    ...overrides,
  };
}

export async function createTestApp(overrides: Partial<AppConfig> = {}) {
  await runMigrations(TEST_DB_URL);
  const config = testConfig(overrides);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { logger: false });
  configureApp(app, config);
  await app.init();
  return app;
}

export async function resetDb(app: INestApplication) {
  const db = app.get<Database>(DB);
  await db.execute(sql`truncate table stock_movements, batches, items, batch_counters, employees restart identity cascade`);
}

export function initDataFor(
  id: number,
  opts: { token?: string; authDate?: number; firstName?: string; username?: string } = {},
): string {
  return signInitData(
    {
      auth_date: String(opts.authDate ?? Math.floor(Date.now() / 1000)),
      query_id: 'AAH-test',
      user: JSON.stringify({ id, first_name: opts.firstName ?? `User${id}`, username: opts.username }),
    },
    opts.token ?? BOT_TOKEN,
  );
}

export const tma = (id: number, opts: Parameters<typeof initDataFor>[1] = {}) => `tma ${initDataFor(id, opts)}`;

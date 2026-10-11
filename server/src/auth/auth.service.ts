import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AppConfig, CONFIG } from '../config';
import { unauthorized } from '../common/errors';
import { DB, Database } from '../db/db.module';
import { employees } from '../db/schema';
import { CurrentEmployee } from './auth.types';
import { InitDataError, TelegramUser, verifyInitData } from './telegram-init-data';

const LOGIN_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DB) private readonly db: Database,
  ) {}

  /**
   * Authorization: `tma <initData>` проверяется на КАЖДОМ запросе. Без заголовка пускаем только в явно
   * включённом DEV_AUTH — и всегда как пользователя из серверной переменной DEV_TELEGRAM_ID.
   */
  async authenticate(authorization: string | undefined): Promise<CurrentEmployee> {
    let user: TelegramUser;
    const match = /^tma\s+(.+)$/is.exec(authorization ?? '');
    if (match) {
      if (!this.config.botToken) {
        throw unauthorized('AUTH_NOT_CONFIGURED', 'Проверка Telegram не настроена на сервере');
      }
      try {
        user = verifyInitData(match[1], this.config.botToken, { maxAgeSeconds: this.config.initDataMaxAgeSeconds }).user;
      } catch (err) {
        if (err instanceof InitDataError) throw unauthorized(err.code, err.message);
        throw err;
      }
    } else if (this.config.devAuth) {
      user = { id: this.config.devAuth.telegramId, firstName: this.config.devAuth.name };
    } else {
      throw unauthorized('AUTH_REQUIRED', 'Откройте приложение из Telegram');
    }
    return this.resolveEmployee(user);
  }

  private async resolveEmployee(user: TelegramUser): Promise<CurrentEmployee> {
    const isEnvAdmin = this.config.adminTelegramIds.includes(user.id);
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `ID ${user.id}`;

    let row = (await this.db.select().from(employees).where(eq(employees.telegramId, user.id)).limit(1))[0];
    if (!row) {
      await this.db
        .insert(employees)
        .values({
          telegramId: user.id,
          displayName,
          username: user.username ?? null,
          role: isEnvAdmin ? 'admin' : 'viewer',
          status: isEnvAdmin ? 'active' : 'pending', // доступ закрыт по умолчанию
          lastLoginAt: new Date(),
        })
        .onConflictDoNothing();
      row = (await this.db.select().from(employees).where(eq(employees.telegramId, user.id)).limit(1))[0];
    } else {
      const patch: Partial<typeof employees.$inferInsert> = {};
      if (isEnvAdmin && (row.role !== 'admin' || row.status !== 'active')) {
        patch.role = 'admin';
        patch.status = 'active';
      }
      if (row.displayName !== displayName) patch.displayName = displayName;
      if ((row.username ?? null) !== (user.username ?? null)) patch.username = user.username ?? null;
      if (!row.lastLoginAt || Date.now() - row.lastLoginAt.getTime() > LOGIN_TOUCH_INTERVAL_MS) patch.lastLoginAt = new Date();
      if (Object.keys(patch).length) {
        row = (await this.db.update(employees).set(patch).where(eq(employees.id, row.id)).returning())[0];
      }
    }

    return {
      id: row.id,
      telegramId: row.telegramId,
      displayName: row.displayName,
      username: row.username,
      role: row.role,
      status: row.status,
      protected: isEnvAdmin,
    };
  }
}

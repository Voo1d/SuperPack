import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from './auth/auth.decorators';
import { DB, Database } from './db/db.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Всегда 200, пока процесс жив; поле db показывает доступность БД (миграции могут идти отдельным шагом). */
  @Get()
  @Public()
  async health() {
    let dbStatus: 'up' | 'down' = 'up';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      dbStatus = 'down';
    }
    return { status: 'ok', db: dbStatus };
  }
}

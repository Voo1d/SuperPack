import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
import type { CurrentEmployee } from '../auth/auth.types';
import { AppConfig, CONFIG } from '../config';
import { conflict, notFound, pgErrorCode } from '../common/errors';
import { ZodPipe } from '../common/zod.pipe';
import { DB, Database } from '../db/db.module';
import { ACCESS_STATUSES, employees, ROLES } from '../db/schema';

const name = z.string().trim().min(1, 'Укажите имя').max(120);
const telegramId = z.coerce
  .number()
  .int()
  .positive()
  .refine((n) => Number.isSafeInteger(n), 'Некорректный Telegram ID');

const createSchema = z.object({
  telegramId,
  displayName: name,
  role: z.enum(ROLES).default('viewer'),
  status: z.enum(['active', 'pending']).default('active'),
});

const updateSchema = z
  .object({
    displayName: name.optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(ACCESS_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Нечего изменять');

@Controller('staff')
@RequirePermission('staff.manage')
export class StaffController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private view(r: typeof employees.$inferSelect) {
    return {
      id: r.id,
      telegramId: r.telegramId,
      displayName: r.displayName,
      username: r.username,
      role: r.role,
      status: r.status,
      protected: this.config.adminTelegramIds.includes(r.telegramId),
      createdAt: r.createdAt,
      lastLoginAt: r.lastLoginAt,
    };
  }

  /** Сначала ожидающие подтверждения, затем остальные. */
  @Get()
  async list() {
    const rows = await this.db
      .select()
      .from(employees)
      .orderBy(sql`case ${employees.status} when 'pending' then 0 when 'active' then 1 else 2 end`, asc(employees.displayName));
    return { items: rows.map((r) => this.view(r)) };
  }

  /** Админ заранее вносит сотрудника по Telegram ID и сразу разрешает вход. */
  @Post()
  async create(@Body(new ZodPipe(createSchema)) dto: z.infer<typeof createSchema>) {
    try {
      const [row] = await this.db
        .insert(employees)
        .values({ telegramId: dto.telegramId, displayName: dto.displayName, role: dto.role, status: dto.status })
        .returning();
      return this.view(row);
    } catch (err) {
      if (pgErrorCode(err).code === '23505') throw conflict('EMPLOYEE_EXISTS', 'Сотрудник с таким Telegram ID уже есть');
      throw err;
    }
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(updateSchema)) dto: z.infer<typeof updateSchema>,
    @CurrentUser() me: CurrentEmployee,
  ) {
    const [target] = await this.db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!target) throw notFound('EMPLOYEE_NOT_FOUND', 'Сотрудник не найден');

    const touchesAccess = dto.role !== undefined || dto.status !== undefined;
    if (touchesAccess && this.config.adminTelegramIds.includes(target.telegramId)) {
      throw conflict('ADMIN_PROTECTED', 'Роль и доступ администратора из серверных настроек менять нельзя');
    }
    if (touchesAccess && target.id === me.id) {
      throw conflict('SELF_LOCKOUT', 'Нельзя менять собственную роль и доступ');
    }

    const [row] = await this.db.update(employees).set(dto).where(eq(employees.id, id)).returning();
    return this.view(row);
  }
}

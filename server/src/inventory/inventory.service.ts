import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, ilike, or, sql } from 'drizzle-orm';
import type { CurrentEmployee } from '../auth/auth.types';
import { todayIn } from '../common/dates';
import { conflict, notFound, pgErrorCode } from '../common/errors';
import { formatQuantity, isWholeNumber } from '../common/quantity';
import { AppConfig, CONFIG } from '../config';
import { DB, Database, Tx } from '../db/db.module';
import { batchCounters, batches, Category, CATEGORIES, employees, items, stockMovements } from '../db/schema';
import { isIntegerUnit, ListQuery, MovementDto, ReceiveDto } from './inventory.dto';

const CODE_PREFIX: Record<Category, string> = { finished: 'FG', raw: 'RM', spares: 'SP', other: 'OT' };

const batchColumns = {
  id: batches.id,
  code: batches.code,
  itemId: items.id,
  itemName: items.name,
  category: items.category,
  unit: batches.unit,
  receivedAt: batches.receivedAt,
  initialQuantity: batches.initialQuantity,
  currentQuantity: batches.currentQuantity,
  supplier: batches.supplier,
  note: batches.note,
  createdAt: batches.createdAt,
};

type BatchRow = {
  id: string;
  code: string;
  itemId: string;
  itemName: string;
  category: Category;
  unit: string;
  receivedAt: string;
  initialQuantity: string;
  currentQuantity: string;
  supplier: string | null;
  note: string | null;
  createdAt: Date;
};

function toBatchView(r: BatchRow) {
  return {
    ...r,
    initialQuantity: formatQuantity(r.initialQuantity),
    currentQuantity: formatQuantity(r.currentQuantity),
    status: Number(r.currentQuantity) > 0 ? ('in_stock' as const) : ('depleted' as const),
  };
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async listBatches(q: ListQuery) {
    const conditions = [];
    if (q.category) conditions.push(eq(items.category, q.category));
    if (q.inStock === true) conditions.push(gt(batches.currentQuantity, '0'));
    if (q.q) {
      const pattern = `%${q.q.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(or(ilike(items.name, pattern), ilike(batches.code, pattern)));
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await this.db
      .select(batchColumns)
      .from(batches)
      .innerJoin(items, eq(items.id, batches.itemId))
      .where(where)
      .orderBy(desc(batches.receivedAt), desc(batches.createdAt))
      .limit(q.limit)
      .offset(q.offset);
    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(batches)
      .innerJoin(items, eq(items.id, batches.itemId))
      .where(where);
    return { items: rows.map(toBatchView), total };
  }

  async summary() {
    const rows = await this.db
      .select({
        category: items.category,
        batches: sql<number>`count(*)::int`,
        inStock: sql<number>`count(*) filter (where ${batches.currentQuantity} > 0)::int`,
      })
      .from(batches)
      .innerJoin(items, eq(items.id, batches.itemId))
      .groupBy(items.category);
    return {
      categories: CATEGORIES.map((category) => {
        const r = rows.find((x) => x.category === category);
        return { category, batches: r?.batches ?? 0, inStock: r?.inStock ?? 0 };
      }),
    };
  }

  async listItems(q: { category?: Category; q?: string }) {
    const conditions = [];
    if (q.category) conditions.push(eq(items.category, q.category));
    if (q.q) conditions.push(ilike(items.name, `%${q.q.replace(/[\\%_]/g, '\\$&')}%`));
    const rows = await this.db
      .select()
      .from(items)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(items.name)
      .limit(200);
    return { items: rows };
  }

  async getBatch(id: string, executor: Database | Tx = this.db) {
    const [row] = await executor
      .select(batchColumns)
      .from(batches)
      .innerJoin(items, eq(items.id, batches.itemId))
      .where(eq(batches.id, id))
      .limit(1);
    if (!row) throw notFound('BATCH_NOT_FOUND', 'Партия не найдена');
    const movements = await executor
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        delta: stockMovements.delta,
        balanceAfter: stockMovements.balanceAfter,
        reason: stockMovements.reason,
        reference: stockMovements.reference,
        employeeName: employees.displayName,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(employees, eq(employees.id, stockMovements.employeeId))
      .where(eq(stockMovements.batchId, id))
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id));
    return {
      ...toBatchView(row),
      movements: movements.map((m) => ({ ...m, delta: formatQuantity(m.delta), balanceAfter: formatQuantity(m.balanceAfter) })),
    };
  }

  /** Приёмка партии: позиция, партия и первое движение «поступление» создаются одной транзакцией. */
  async receive(dto: ReceiveDto, employee: CurrentEmployee) {
    const receivedAt = dto.receivedAt ?? todayIn(this.config.timezone);
    if (receivedAt > todayIn(this.config.timezone)) {
      throw this.badRequest('Дата поступления не может быть в будущем', 'receivedAt');
    }
    try {
      return await this.db.transaction(async (tx) => {
        const item = await this.resolveItem(tx, dto.item);
        if (isIntegerUnit(item.unit) && !isWholeNumber(dto.quantity)) {
          throw this.badRequest(`Для единицы «${item.unit}» количество должно быть целым`, 'quantity');
        }
        const code = dto.code ? dto.code : await this.nextCode(tx, item.category);
        const [batch] = await tx
          .insert(batches)
          .values({
            code,
            itemId: item.id,
            receivedAt,
            unit: item.unit,
            initialQuantity: dto.quantity,
            currentQuantity: dto.quantity,
            supplier: dto.supplier ?? null,
            note: dto.note ?? null,
            createdBy: employee.id,
          })
          .returning({ id: batches.id });
        await tx.insert(stockMovements).values({
          batchId: batch.id,
          type: 'receipt',
          delta: dto.quantity,
          balanceAfter: dto.quantity,
          reason: 'Поступление',
          reference: dto.supplier ?? null,
          employeeId: employee.id,
        });
        return this.getBatch(batch.id, tx);
      });
    } catch (err) {
      if (pgErrorCode(err).code === '23505' && pgErrorCode(err).constraint === 'batches_code_uq') {
        throw conflict('BATCH_CODE_EXISTS', `Партия с кодом ${dto.code} уже существует`);
      }
      throw err;
    }
  }

  /** Списание или корректировка. Остаток меняется атомарным UPDATE с условием «не меньше нуля». */
  async addMovement(batchId: string, dto: MovementDto, employee: CurrentEmployee) {
    return this.db.transaction(async (tx) => {
      const [batch] = await tx.select({ unit: batches.unit }).from(batches).where(eq(batches.id, batchId)).limit(1);
      if (!batch) throw notFound('BATCH_NOT_FOUND', 'Партия не найдена');

      const delta = dto.type === 'writeoff' ? `-${dto.quantity}` : dto.delta;
      if (isIntegerUnit(batch.unit) && !isWholeNumber(delta)) {
        throw this.badRequest(`Для единицы «${batch.unit}» количество должно быть целым`, 'quantity');
      }
      const [updated] = await tx
        .update(batches)
        .set({ currentQuantity: sql`${batches.currentQuantity} + ${delta}::numeric` })
        .where(and(eq(batches.id, batchId), sql`${batches.currentQuantity} + ${delta}::numeric >= 0`))
        .returning({ balance: batches.currentQuantity });
      if (!updated) {
        const [cur] = await tx.select({ q: batches.currentQuantity }).from(batches).where(eq(batches.id, batchId)).limit(1);
        throw conflict('INSUFFICIENT_STOCK', 'Недостаточно остатка в партии', { available: formatQuantity(cur.q) });
      }
      await tx.insert(stockMovements).values({
        batchId,
        type: dto.type,
        delta,
        balanceAfter: updated.balance,
        reason: dto.reason,
        reference: dto.reference ?? null,
        employeeId: employee.id,
      });
      return this.getBatch(batchId, tx);
    });
  }

  private badRequest(message: string, path: string) {
    return new BadRequestException({ code: 'VALIDATION_ERROR', message, issues: [{ path, message }] });
  }

  private async resolveItem(tx: Tx, ref: ReceiveDto['item']) {
    if ('id' in ref) {
      const [item] = await tx.select().from(items).where(eq(items.id, ref.id)).limit(1);
      if (!item) throw notFound('ITEM_NOT_FOUND', 'Позиция номенклатуры не найдена');
      return item;
    }
    const find = () =>
      tx
        .select()
        .from(items)
        .where(and(eq(items.category, ref.category), sql`lower(${items.name}) = lower(${ref.name})`))
        .limit(1);
    let [item] = await find();
    if (!item) {
      await tx.insert(items).values({ name: ref.name, category: ref.category, unit: ref.unit }).onConflictDoNothing();
      [item] = await find();
    }
    if (item.unit !== ref.unit) {
      throw conflict('ITEM_UNIT_MISMATCH', `«${item.name}» уже заведена в единицах «${item.unit}», а не «${ref.unit}»`);
    }
    return item;
  }

  /** Код вида RM-0001; пропускает уже занятые вручную коды. */
  private async nextCode(tx: Tx, category: Category): Promise<string> {
    const prefix = CODE_PREFIX[category];
    for (let i = 0; i < 100; i++) {
      const [{ n }] = await tx
        .insert(batchCounters)
        .values({ prefix, lastValue: 1 })
        .onConflictDoUpdate({ target: batchCounters.prefix, set: { lastValue: sql`${batchCounters.lastValue} + 1` } })
        .returning({ n: batchCounters.lastValue });
      const code = `${prefix}-${String(n).padStart(4, '0')}`;
      const [taken] = await tx.select({ id: batches.id }).from(batches).where(eq(batches.code, code)).limit(1);
      if (!taken) return code;
    }
    throw conflict('CODE_GENERATION_FAILED', 'Не удалось подобрать свободный код партии, укажите его вручную');
  }
}

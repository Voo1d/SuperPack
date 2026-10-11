import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const ROLES = ['admin', 'storekeeper', 'production', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ACCESS_STATUSES = ['pending', 'active', 'blocked'] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

export const CATEGORIES = ['finished', 'raw', 'spares', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const MOVEMENT_TYPES = ['receipt', 'writeoff', 'correction'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Сотрудники. Доступ закрыт по умолчанию: новый сотрудник получает status = 'pending'. */
export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
    displayName: text('display_name').notNull(),
    username: text('username'),
    role: text('role').$type<Role>().notNull().default('viewer'),
    status: text('status').$type<AccessStatus>().notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('employees_telegram_id_uq').on(t.telegramId),
    check('employees_role_ck', sql`${t.role} in ('admin','storekeeper','production','viewer')`),
    check('employees_status_ck', sql`${t.status} in ('pending','active','blocked')`),
  ],
);

/** Номенклатура: товар или материал. Единица измерения закреплена за позицией. */
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    category: text('category').$type<Category>().notNull(),
    unit: text('unit').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('items_category_name_uq').on(t.category, sql`lower(${t.name})`),
    check('items_category_ck', sql`${t.category} in ('finished','raw','spares','other')`),
  ],
);

/** Партия: код уникален, остаток никогда не отрицательный. */
export const batches = pgTable(
  'batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    receivedAt: date('received_at', { mode: 'string' }).notNull(),
    unit: text('unit').notNull(),
    initialQuantity: numeric('initial_quantity', { precision: 18, scale: 3 }).notNull(),
    currentQuantity: numeric('current_quantity', { precision: 18, scale: 3 }).notNull(),
    supplier: text('supplier'),
    note: text('note'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => employees.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('batches_code_uq').on(t.code),
    index('batches_item_idx').on(t.itemId),
    index('batches_received_idx').on(t.receivedAt),
    check('batches_initial_positive_ck', sql`${t.initialQuantity} > 0`),
    check('batches_current_nonneg_ck', sql`${t.currentQuantity} >= 0`),
  ],
);

/** Движения по партии. Только добавляются; исправления — отдельными операциями. */
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => batches.id),
    type: text('type').$type<MovementType>().notNull(),
    delta: numeric('delta', { precision: 18, scale: 3 }).notNull(),
    balanceAfter: numeric('balance_after', { precision: 18, scale: 3 }).notNull(),
    reason: text('reason'),
    reference: text('reference'),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('stock_movements_batch_idx').on(t.batchId, t.createdAt),
    check('stock_movements_type_ck', sql`${t.type} in ('receipt','writeoff','correction')`),
    check('stock_movements_delta_nonzero_ck', sql`${t.delta} <> 0`),
    check('stock_movements_balance_nonneg_ck', sql`${t.balanceAfter} >= 0`),
  ],
);

/** Счётчики для автоматических кодов партий (по префиксу категории). */
export const batchCounters = pgTable('batch_counters', {
  prefix: text('prefix').primaryKey(),
  lastValue: integer('last_value').notNull().default(0),
});

import { z } from 'zod';
import { INTEGER_UNITS, positiveQuantity, signedNonZeroQuantity, UNITS } from '../common/quantity';
import { isValidIsoDate } from '../common/dates';
import { CATEGORIES } from '../db/schema';

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .union([text(max), z.null()])
    .optional()
    .transform((v) => (v ? v : undefined));

export const batchCode = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(v), 'Код партии: латинские буквы, цифры, «-», «_», «.», до 40 символов');

const isoDate = z.string().refine(isValidIsoDate, 'Дата в формате ГГГГ-ММ-ДД');

const itemRef = z.union([
  z.object({ id: z.uuid('Некорректный идентификатор позиции') }),
  z.object({
    name: text(160).min(2, 'Название — минимум 2 символа'),
    category: z.enum(CATEGORIES),
    unit: z.enum(UNITS),
  }),
]);

export const receiveSchema = z.object({
  code: z.union([z.literal(''), batchCode]).optional(),
  item: itemRef,
  receivedAt: isoDate.optional(),
  quantity: positiveQuantity,
  supplier: optionalText(160),
  note: optionalText(500),
});
export type ReceiveDto = z.infer<typeof receiveSchema>;

export const movementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('writeoff'),
    quantity: positiveQuantity,
    reason: text(300).min(3, 'Укажите причину'),
    reference: optionalText(120),
  }),
  z.object({
    type: z.literal('correction'),
    delta: signedNonZeroQuantity,
    reason: text(300).min(3, 'Укажите причину'),
    reference: optionalText(120),
  }),
]);
export type MovementDto = z.infer<typeof movementSchema>;

const boolParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const listQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
  inStock: boolParam,
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const itemsQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
});

export const isIntegerUnit = (unit: string) => INTEGER_UNITS.includes(unit);

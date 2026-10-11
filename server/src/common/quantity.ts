import { z } from 'zod';

/** Единицы измерения. Дробные — для сырья (кг, м, л); целые — для штучного учёта. */
export const UNITS = ['кг', 'м', 'л', 'шт.', 'пар', 'упак.'] as const;
export type Unit = (typeof UNITS)[number];
export const INTEGER_UNITS: readonly string[] = ['шт.', 'пар', 'упак.'];

/** Количества хранятся как numeric(18,3) и передаются строками, без float-арифметики. */
const POSITIVE_RE = /^\d{1,12}(\.\d{1,3})?$/;
const SIGNED_RE = /^-?\d{1,12}(\.\d{1,3})?$/;

const asString = z.union([z.string(), z.number()]).transform((v) => String(v).trim());

export const positiveQuantity = asString
  .refine((v) => POSITIVE_RE.test(v), 'Количество — положительное число не более чем с тремя знаками после запятой')
  .refine((v) => !/^0+(\.0+)?$/.test(v), 'Количество должно быть больше нуля');

export const signedNonZeroQuantity = asString
  .refine((v) => SIGNED_RE.test(v), 'Изменение — число не более чем с тремя знаками после запятой')
  .refine((v) => !/^-?0+(\.0+)?$/.test(v), 'Изменение не может быть нулевым');

export function isWholeNumber(v: string): boolean {
  const [, frac] = v.replace('-', '').split('.');
  return !frac || /^0+$/.test(frac);
}

/** "420.000" → "420", "12.500" → "12.5" (значение из numeric для ответа API). */
export function formatQuantity(v: string): string {
  if (!v.includes('.')) return v;
  return v.replace(/0+$/, '').replace(/\.$/, '');
}

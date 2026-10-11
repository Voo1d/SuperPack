import type { AccessStatus, Category, Movement, Role } from './types';

export const CATEGORIES: Category[] = ['finished', 'raw', 'spares', 'other'];
export const CATEGORY_LABELS: Record<Category, string> = {
  finished: 'Готовая продукция',
  raw: 'Сырьё',
  spares: 'Запчасти',
  other: 'Другое',
};
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Администратор',
  storekeeper: 'Кладовщик',
  production: 'Производство',
  viewer: 'Только просмотр',
};
export const STATUS_LABELS: Record<AccessStatus, string> = { pending: 'Ожидает', active: 'Активен', blocked: 'Заблокирован' };
export const MOVEMENT_LABELS: Record<Movement['type'], string> = {
  receipt: 'Поступление',
  writeoff: 'Списание',
  correction: 'Корректировка',
};

export const UNITS_FALLBACK = ['кг', 'м', 'л', 'шт.', 'пар', 'упак.'];
export const INTEGER_UNITS = ['шт.', 'пар', 'упак.'];

/** "1234.5" → "1 234,5" без преобразования через Number (точность numeric(18,3)). */
export function formatQty(v: string): string {
  const neg = v.startsWith('-');
  const [int, frac] = v.replace(/^[-+]/, '').split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '−' : '') + grouped + (frac ? ',' + frac : '');
}

export function formatDelta(v: string): string {
  return v.startsWith('-') ? formatQty(v) : '+' + formatQty(v);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

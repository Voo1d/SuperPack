import type { Request } from 'express';
import type { AccessStatus, Role } from '../db/schema';

export interface CurrentEmployee {
  id: string;
  telegramId: number;
  displayName: string;
  username: string | null;
  role: Role;
  status: AccessStatus;
  /** Администратор из ADMIN_TELEGRAM_IDS: роль и доступ не меняются через API. */
  protected: boolean;
}

export type AuthedRequest = Request & { employee: CurrentEmployee };

export type Permission = 'stock.read' | 'stock.write' | 'staff.manage';

export const PERMISSIONS: Record<Permission, readonly Role[]> = {
  'stock.read': ['admin', 'storekeeper', 'production', 'viewer'],
  'stock.write': ['admin', 'storekeeper'],
  'staff.manage': ['admin'],
};

export type Category = 'finished' | 'raw' | 'spares' | 'other';
export type Role = 'admin' | 'storekeeper' | 'production' | 'viewer';
export type AccessStatus = 'pending' | 'active' | 'blocked';

export interface Me {
  id: string;
  telegramId: number;
  displayName: string;
  username: string | null;
  role: Role;
  status: AccessStatus;
  permissions: Record<'stock.read' | 'stock.write' | 'staff.manage', boolean>;
}

export interface Batch {
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
  createdAt: string;
  status: 'in_stock' | 'depleted';
}

export interface Movement {
  id: string;
  type: 'receipt' | 'writeoff' | 'correction';
  delta: string;
  balanceAfter: string;
  reason: string | null;
  reference: string | null;
  employeeName: string;
  createdAt: string;
}

export type BatchDetail = Batch & { movements: Movement[] };

export interface Item {
  id: string;
  name: string;
  category: Category;
  unit: string;
}

export interface Employee {
  id: string;
  telegramId: number;
  displayName: string;
  username: string | null;
  role: Role;
  status: AccessStatus;
  protected: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

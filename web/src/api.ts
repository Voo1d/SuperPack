export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready(): void; expand(): void } };
  }
}

/**
 * Клиент отправляет только подписанные Telegram данные; сервер сам определяет пользователя.
 * Вне Telegram заголовка нет — это работает лишь при серверном DEV_AUTH=true.
 */
function authHeader(): Record<string, string> {
  const initData = window.Telegram?.WebApp?.initData;
  return initData ? { Authorization: `tma ${initData}` } : {};
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method: init.method ?? 'GET',
      headers: { ...authHeader(), ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Нет связи с сервером. Проверьте интернет и повторите.');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* не JSON */
  }
  if (!res.ok) {
    const d = (data ?? {}) as { code?: string; message?: string; issues?: { path: string; message: string }[] };
    throw new ApiError(res.status, d.code ?? 'ERROR', d.message ?? `Ошибка сервера (${res.status})`, d.issues ?? []);
  }
  return data as T;
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const details = e.issues.length ? ': ' + e.issues.map((i) => i.message).join('; ') : '';
    return e.message + details;
  }
  return 'Неожиданная ошибка';
}

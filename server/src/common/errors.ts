import { ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';

export const unauthorized = (code: string, message: string) => new UnauthorizedException({ code, message });
export const forbidden = (code: string, message: string) => new ForbiddenException({ code, message });
export const notFound = (code: string, message: string) => new NotFoundException({ code, message });
export const conflict = (code: string, message: string, extra?: Record<string, unknown>) =>
  new ConflictException({ code, message, ...extra });

/** Drizzle оборачивает ошибки pg в DrizzleQueryError с `cause`; проверяем оба уровня. */
export function pgErrorCode(err: unknown): { code?: string; constraint?: string } {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  return { code: e?.code ?? e?.cause?.code, constraint: e?.constraint ?? e?.cause?.constraint };
}

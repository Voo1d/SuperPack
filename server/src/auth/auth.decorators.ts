import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthedRequest, CurrentEmployee, Permission } from './auth.types';

export const PUBLIC_KEY = 'auth:public';
export const ALLOW_INACTIVE_KEY = 'auth:allowInactive';
export const PERMISSION_KEY = 'auth:permission';

/** Маршрут без аутентификации (только /health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Маршрут доступен подписанному пользователю без активного доступа (экран «ожидает подтверждения»). */
export const AllowInactive = () => SetMetadata(ALLOW_INACTIVE_KEY, true);
export const RequirePermission = (p: Permission) => SetMetadata(PERMISSION_KEY, p);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): CurrentEmployee => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().employee;
});

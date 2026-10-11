import { Controller, Get } from '@nestjs/common';
import { AllowInactive, CurrentUser } from './auth.decorators';
import { CurrentEmployee, PERMISSIONS } from './auth.types';

@Controller('me')
export class AuthController {
  /** Профиль и права текущего пользователя. Доступен и ожидающим/заблокированным — чтобы показать им статус. */
  @Get()
  @AllowInactive()
  me(@CurrentUser() e: CurrentEmployee) {
    const active = e.status === 'active';
    return {
      id: e.id,
      telegramId: e.telegramId,
      displayName: e.displayName,
      username: e.username,
      role: e.role,
      status: e.status,
      permissions: Object.fromEntries(
        Object.entries(PERMISSIONS).map(([p, roles]) => [p, active && roles.includes(e.role)]),
      ),
    };
  }
}

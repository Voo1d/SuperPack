import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { forbidden } from '../common/errors';
import { ALLOW_INACTIVE_KEY, PERMISSION_KEY, PUBLIC_KEY } from './auth.decorators';
import { AuthService } from './auth.service';
import { AuthedRequest, PERMISSIONS, Permission } from './auth.types';

/** Глобальный guard: все маршруты закрыты, пока явно не помечены @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const employee = await this.auth.authenticate(req.headers.authorization);
    req.employee = employee;

    if (!this.reflector.getAllAndOverride<boolean>(ALLOW_INACTIVE_KEY, targets)) {
      if (employee.status === 'pending') throw forbidden('ACCESS_PENDING', 'Доступ ещё не подтверждён администратором');
      if (employee.status === 'blocked') throw forbidden('ACCESS_BLOCKED', 'Доступ заблокирован администратором');
    }

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, targets);
    if (permission && !PERMISSIONS[permission].includes(employee.role)) {
      throw forbidden('FORBIDDEN', 'Недостаточно прав для этой операции');
    }
    return true;
  }
}

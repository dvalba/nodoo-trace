import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { MetaRoles, RolesRequired } from '../decorators/meta-roles.decorator.js';
import { MultiTenantRole } from '../../users/enums/roles.enum.js';
import { AuthUser } from '../interfaces/auth-user.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride(MetaRoles, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();

    if (!user) throw new UnauthorizedException('User not authenticated');

    const userRoles: MultiTenantRole[] = [
      ...user.platformRoles,
      ...user.roles,
    ];

    const groups = normalize(required);

    const passes = groups.some((g) => g.every((r) => userRoles.includes(r)));
    if (passes) return true;

    throw new ForbiddenException(
      `User ${user.email} does not satisfy: ${describe(groups)}`,
    );
  }
}

function normalize(args: RolesRequired []): MultiTenantRole[][] {
  return args.map((a) => (Array.isArray(a) ? a : [a]));
}

function describe(groups: MultiTenantRole[][]): string {
  return groups.map((g) => `(${g.join(' AND ')})`).join(' OR ');
}
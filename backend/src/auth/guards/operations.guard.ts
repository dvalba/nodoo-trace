import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { REQUIRES_OPERATION } from '../decorators/requires-operation.decorator.js';
import { AuthUser } from '../interfaces/auth-user.interface.js';
import { PlatformRole } from '../../users/enums/roles.enum.js';
import { Actor } from '../../actor/entities/actor.entity.js';

@Injectable()
export class OperationsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Actor)
    private readonly actorRepo: Repository<Actor>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRES_OPERATION,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();

    if (!user) throw new UnauthorizedException('User not authenticated');

    if (user.platformRoles.includes(PlatformRole.STAFF)) return true;

    if (!user.actorId) {
      throw new ForbiddenException(
        'User is not linked to an organization',
      );
    }

    const actor = await this.actorRepo.findOne({
      where: { id: user.actorId },
      relations: { activities: { operations: true } },
    });

    const allowed = new Set<string>();
    actor?.activities.forEach((a) =>
      a.operations.forEach((o) => allowed.add(o.code)),
    );

    const missing = required.filter((op) => !allowed.has(op));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Organization ${user.actorId} does not have permission for: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}

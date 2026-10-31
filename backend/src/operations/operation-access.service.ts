import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actor } from '../actor/entities/actor.entity.js';
import { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { PlatformRole } from '../users/enums/roles.enum.js';

@Injectable()
export class OperationAccessService {
  constructor(
    @InjectRepository(Actor)
    private readonly actorRepo: Repository<Actor>,
  ) {}

  async assertAllowed(user: AuthUser, operations: string[]): Promise<void> {
    if (!operations.length) return;

    if (user.platformRoles.includes(PlatformRole.STAFF)) return;

    if (!user.actorId) {
      throw new ForbiddenException('User is not linked to an organization');
    }

    const allowed = await this.allowedOperations(user.actorId);
    const missing = operations.filter((op) => !allowed.has(op));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Organization ${user.actorId} does not have permission for: ${missing.join(', ')}`,
      );
    }
  }

  async allowedOperations(actorId: string): Promise<Set<string>> {
    const actor = await this.actorRepo.findOne({
      where: { id: actorId },
      relations: { activities: { operations: true } },
    });

    const allowed = new Set<string>();
    actor?.activities.forEach((a) =>
      a.operations.forEach((o) => allowed.add(o.code)),
    );

    return allowed;
  }
}

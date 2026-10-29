import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { ActorStatus } from '../actor/enums/actor-status.enum.js';
import { ActorService } from '../actor/actor.service.js';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly actorService: ActorService,
    private readonly dataSource: DataSource,
  ) {}

  async approveActor(actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.actorService.updateStatus(
        actorId,
        ActorStatus.APPROVED,
        manager,
      );

      const { activated } = await this.usersService.activateAwaitingUsers(
        actorId,
        manager,
      );

      return {
        actorId,
        actorStatus: ActorStatus.APPROVED,
        activatedUsers: activated,
      };
    });
  }
}

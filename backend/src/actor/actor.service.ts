import { Injectable } from '@nestjs/common';
import { CreateActorDto } from './dto/create-actor.dto.js';
import { UpdateActorDto } from './dto/update-actor.dto.js';
import { EntityManager, QueryRunner, Repository } from 'typeorm';
import { Actor } from './entities/actor.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityTypesService } from '../activity-types/activity-types.service.js';
import { ActorStatus } from './enums/actor-status.enum.js';
import { throwNotFound } from '../common/helpers/crud-exceptions.helper.js';

@Injectable()
export class ActorService {
  constructor(
    @InjectRepository(Actor) private readonly actorRepo: Repository<Actor>,
    private readonly activityService: ActivityTypesService,
  ) {}

  async findByEmailInActor(email: string, actorId: string) {
    return this.actorRepo.findOne({
      where: { id: actorId, users: { email } },
      relations: { users: true },
    });
  }

  async findById(id: string) {
    return this.actorRepo.findOneBy({ id });
  }
  async findByIdOrFail(id: string): Promise<Actor> {
    const actor = await this.findById(id);
    if (!actor) throwNotFound('Actor', id);
    return actor;
  }

  async updateStatus(
    actorId: string,
    status: ActorStatus,
    manager?: EntityManager,
  ) {
    const m = manager ?? this.actorRepo.manager;

    const result = await m.update(Actor, actorId, { status });

    if (!result.affected) {
      throwNotFound('Actor', actorId);
      // en Postgres, affected=0 → no existe
    }
  }

  async createActor(
    dto: CreateActorDto,
    queryRunner?: QueryRunner,
  ): Promise<Actor> {
    const manager = queryRunner ? queryRunner.manager : this.actorRepo.manager;
    const { activityCodes, legalName } = dto;

    const activities = await this.activityService.findByCodes(activityCodes);

    const actor = manager.create(Actor, {
      name: legalName,
      status: ActorStatus.PENDING_APPROVAL,
      activities,
    });

    return manager.save(actor);
  }
}

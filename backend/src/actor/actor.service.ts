import { Injectable } from '@nestjs/common';
import { CreateActorDto } from './dto/create-actor.dto.js';
import { EntityManager, QueryRunner, Repository } from 'typeorm';
import { Actor } from './entities/actor.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { ActorStatus } from './enums/actor-status.enum.js';
import { throwNotFound } from '../common/helpers/crud-exceptions.helper.js';
import type { ActivityType } from '../activity-types/entities/activity-type.entity.js';
import { ActivityTypesService } from '../activity-types/activity-types.service.js';

@Injectable()
export class ActorService {
  constructor(
    @InjectRepository(Actor) private readonly actorRepo: Repository<Actor>,
    private readonly activityTypesService: ActivityTypesService,
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

  async findByIdWithActivities(id: string) {
    return this.actorRepo.findOne({ where: { id }, relations: { activities: true } });
  }

  async getReference(id: string) {
    const actor = await this.findByIdWithActivities(id);
    if (!actor) throwNotFound('Actor', id);

    return {
      id: actor.id,
      name: actor.name,
      activities: (actor.activities ?? []).map((a) => ({
        code: (a as ActivityType).code,
        name: (a as ActivityType).name,
      })),
    };
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
    }
  }

  async createActor(
    dto: CreateActorDto & { activityCodes?: string[] },
    queryRunner?: QueryRunner,
  ): Promise<Actor> {
    const manager = queryRunner ? queryRunner.manager : this.actorRepo.manager;
    const { legalName, organizationNumber, activityCodes } = dto;

    const activities =
      activityCodes && activityCodes.length > 0
        ? await this.activityTypesService.findWithOperationsByCodes(
            activityCodes,
          )
        : [];

    const actor = manager.create(Actor, {
      name: legalName,
      organizationNumber,
      status: ActorStatus.PENDING_APPROVAL,
      activities,
    });

    return manager.save(actor);
  }
}

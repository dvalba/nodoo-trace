import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { ActivityTypesService } from '../activity-types/activity-types.service.js';
import { ActivityType } from '../activity-types/entities/activity-type.entity.js';
import { Operation } from '../activity-types/entities/operation.entity.js';
import { OPERATIONS } from '../activity-types/constants/operations.constant.js';
import { Actor } from '../actor/entities/actor.entity.js';
import { SuggestOperationsDto } from './dto/suggest-operations.dto.js';
import { AcceptActivitiesDto } from './dto/accept-activities.dto.js';
import { CreateCustomActivityDto } from './dto/create-custom-activity.dto.js';

export interface ActivityRef {
  code: string;
  name: string;
}

export interface OperationSuggestion {
  activities: ActivityRef[];
  covered: string[];
  extras: string[];
}

const MAX_COMBO_SIZE = 3;
const TOP_N = 3;

const opOrder = new Map<string, number>(
  OPERATIONS.map((o) => [o.code, o.sortOrder]),
);

@Injectable()
export class OperationsService {
  constructor(
    private readonly activityService: ActivityTypesService,
    @InjectRepository(Actor)
    private readonly actorRepo: Repository<Actor>,
    private readonly dataSource: DataSource,
  ) {}

  list() {
    return this.activityService.listOperations();
  }

  async suggest(
    actorId: string,
    dto: SuggestOperationsDto,
  ): Promise<OperationSuggestion[]> {
    await this.assertActorExists(actorId);
    const builtins = await this.activityService.findBuiltinWithOperations();
    return suggestCoveringCombinations(builtins, dto.operations, {
      maxComboSize: MAX_COMBO_SIZE,
      topN: TOP_N,
    });
  }

  async accept(
    actorId: string,
    dto: AcceptActivitiesDto,
  ): Promise<{ actorId: string; activities: ActivityRef[] }> {
    const actor = await this.loadActorWithActivities(actorId);

    const activities = await this.activityService.findWithOperationsByCodes(
      dto.activityCodes,
    );

    const union = new Set(
      activities.flatMap((a) => a.operations.map((o) => o.code)),
    );
    const missing = dto.operations.filter((op) => !union.has(op));
    if (missing.length > 0) {
      throw new BadRequestException(
        `The selected activities do not cover these operations: ${missing.join(', ')}`,
      );
    }

    actor.activities = activities;
    await this.actorRepo.save(actor);

    return {
      actorId,
      activities: activities.map((a) => ({ code: a.code, name: a.name })),
    };
  }

  async createCustom(
    actorId: string,
    dto: CreateCustomActivityDto,
  ): Promise<{ actorId: string; activity: ActivityRef }> {
    return this.dataSource.transaction(async (manager) => {
      const actor = await manager.findOne(Actor, {
        where: { id: actorId },
        relations: { activities: true },
      });
      if (!actor) throw new NotFoundException('Actor not found');

      const distinctOps = new Set(dto.operations);
      const operations = await manager.findBy(Operation, {
        code: In([...distinctOps]),
      });
      if (operations.length !== distinctOps.size) {
        throw new BadRequestException(
          'Some of the selected operations do not exist',
        );
      }

      const [maxSort] = await manager.find(ActivityType, {
        order: { sortOrder: 'DESC' },
        take: 1,
      });

      const suffix = randomBytes(3).toString('base64url');
      const code = `custom-${slugifyCustomName(dto.name)}-${suffix}`;

      const activity = manager.create(ActivityType, {
        code,
        name: dto.name,
        description: 'Custom activity created by an organization owner',
        isCustom: true,
        isActive: true,
        sortOrder: (maxSort?.sortOrder ?? 0) + 1,
        operations,
      });
      const saved = await manager.save(activity);

      actor.activities = [saved];
      await manager.save(actor);

      return {
        actorId,
        activity: { code: saved.code, name: saved.name },
      };
    });
  }

  private async assertActorExists(actorId: string) {
    const actor = await this.actorRepo.findOneBy({ id: actorId });
    if (!actor) throw new NotFoundException('Actor not found');
  }

  private async loadActorWithActivities(actorId: string) {
    const actor = await this.actorRepo.findOne({
      where: { id: actorId },
      relations: { activities: true },
    });
    if (!actor) throw new NotFoundException('Actor not found');
    return actor;
  }
}

function suggestCoveringCombinations(
  builtins: ActivityType[],
  selected: string[],
  opts: { maxComboSize: number; topN: number },
): OperationSuggestion[] {
  const selectedSet = new Set(selected);
  const order = (codes: string[]) =>
    [...codes].sort((a, b) => opOrder.get(a)! - opOrder.get(b)!);

  const results: OperationSuggestion[] = [];

  for (let size = 1; size <= opts.maxComboSize; size++) {
    for (const combo of combinations(builtins, size)) {
      const union = new Set<string>();
      for (const a of combo) {
        for (const o of a.operations) union.add(o.code);
      }
      if ([...selectedSet].every((op) => union.has(op))) {
        const extras = order([...union].filter((op) => !selectedSet.has(op)));
        results.push({
          activities: combo.map((a) => ({ code: a.code, name: a.name })),
          covered: order([...selectedSet]),
          extras,
        });
      }
    }
  }

  results.sort(
    (a, b) =>
      a.activities.length - b.activities.length ||
      a.extras.length - b.extras.length ||
      (a.activities
        .map((x) => x.code)
        .sort()
        .join(',') < b.activities.map((x) => x.code).sort().join(',')
        ? -1
        : 1),
  );

  return results.slice(0, opts.topN);
}

function* combinations<T>(items: T[], k: number): Generator<T[]> {
  if (k > items.length) return;
  if (k === 1) {
    for (const item of items) yield [item];
    return;
  }
  for (let i = 0; i <= items.length - k; i++) {
    const rest = items.slice(i + 1);
    for (const tail of combinations(rest, k - 1)) {
      yield [items[i], ...tail];
    }
  }
}

function slugifyCustomName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'activity'
  );
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityType } from './entities/activity-type.entity.js';
import { Operation } from './entities/operation.entity.js';
import { In, Repository } from 'typeorm';
import { ACTIVITY_TYPES, PERMISSIONS } from './constants/activity-codes.constant.js';
import { OPERATIONS } from './constants/operations.constant.js';

@Injectable()
export class ActivityTypesService {
  private readonly logger = new Logger(ActivityTypesService.name);
  constructor(
    @InjectRepository(ActivityType)
    private activityTypeRepo: Repository<ActivityType>,
    @InjectRepository(Operation)
    private operationRepo: Repository<Operation>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedMissing();
    await this.seedOperations();
    await this.seedActivityOperations();
  }

  private async seedMissing(): Promise<void> {
    const existing = await this.activityTypeRepo.find({
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((a) => a.code));

    const missing = ACTIVITY_TYPES.filter((a) => !existingCodes.has(a.code));
    if (missing.length === 0) return;

    try {
      const activities = this.activityTypeRepo.create(
        missing.map(({ code, name, description }) => ({
          code,
          name,
          description,
        })),
      );

      await this.activityTypeRepo.save(activities);
      this.logger.log(
        `Seeded ${missing.length} activity type(s): ${missing.map((a) => a.code).join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to seed activity types: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async seedOperations(): Promise<void> {
    const existing = await this.operationRepo.find({ select: { code: true } });
    const existingCodes = new Set(existing.map((o) => o.code));

    const missing = OPERATIONS.filter((o) => !existingCodes.has(o.code));
    if (missing.length === 0) return;

    try {
      const operations = this.operationRepo.create(
        missing.map(({ code, label, group, sortOrder }) => ({
          code,
          label,
          group,
          sortOrder,
        })),
      );

      await this.operationRepo.save(operations);
      this.logger.log(
        `Seeded ${missing.length} operation(s): ${missing.map((o) => o.code).join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to seed operations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async seedActivityOperations(): Promise<void> {
    const operationCodes = Object.keys(PERMISSIONS);
    const operations = await this.operationRepo.findBy({
      code: In(operationCodes),
    });
    const operationByCode = new Map(operations.map((o) => [o.code, o]));

    const missingPairs: Array<{ activityCode: string; operation: Operation }> = [];
    for (const [operationCode, codes] of Object.entries(PERMISSIONS)) {
      const operation = operationByCode.get(operationCode);
      if (!operation) continue;
      for (const code of codes) {
        const activity = await this.activityTypeRepo.findOne({
          where: { code },
          relations: { operations: true },
        });
        if (!activity) continue;
        const has = activity.operations.some((o) => o.code === operationCode);
        if (!has) missingPairs.push({ activityCode: code, operation });
      }
    }

    if (missingPairs.length === 0) return;

    try {
      for (const { activityCode, operation } of missingPairs) {
        const activity = await this.activityTypeRepo.findOne({
          where: { code: activityCode },
          relations: { operations: true },
        });
        if (activity) {
          activity.operations.push(operation);
          await this.activityTypeRepo.save(activity);
        }
      }
      this.logger.log(
        `Seeded ${missingPairs.length} activity-operation link(s)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to seed activity-operation links: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async findBuiltinWithOperations(): Promise<ActivityType[]> {
    return this.activityTypeRepo.find({
      where: { isCustom: false },
      relations: { operations: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findAllWithOperations(): Promise<ActivityType[]> {
    return this.activityTypeRepo.find({
      relations: { operations: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async listOperations(): Promise<Operation[]> {
    return this.operationRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async findByCodes(codes: string[]): Promise<ActivityType[]> {
    if (!codes || codes.length === 0)
      throw new BadRequestException('Debe seleccionar al menos una actividad.');

    const activities = await this.activityTypeRepo.findBy({
      code: In(codes),
    });

    if (activities.length !== codes.length) {
      const foundCodes = activities.map((a) => a.code);
      const missingCodes = codes.filter((c) => !foundCodes.includes(c));
      throw new BadRequestException(
        `Los siguientes códigos de actividad no son válidos o no existen: ${missingCodes.join(', ')}`,
      );
    }

    return activities;
  }

  async findWithOperationsByCodes(codes: string[]): Promise<ActivityType[]> {
    const activities = await this.activityTypeRepo.find({
      where: { code: In(codes) },
      relations: { operations: true },
    });

    if (activities.length !== new Set(codes).size) {
      const foundCodes = activities.map((a) => a.code);
      const missingCodes = [...new Set(codes)].filter(
        (c) => !foundCodes.includes(c),
      );
      throw new BadRequestException(
        `Los siguientes códigos de actividad no son válidos o no existen: ${missingCodes.join(', ')}`,
      );
    }

    return activities;
  }
}

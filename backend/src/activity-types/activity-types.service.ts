import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActivityType } from './entities/activity-type.entity.js';
import { In, Repository } from 'typeorm';
import { ACTIVITY_TYPES } from './constants/activity-codes.constant.js';

@Injectable()
export class ActivityTypesService {
  private readonly logger = new Logger(ActivityTypesService.name);
  constructor(
    @InjectRepository(ActivityType)
    private activityTypeRepo: Repository<ActivityType>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedMissing();
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
  private humanize(code: string): string {
    return code
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
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
}

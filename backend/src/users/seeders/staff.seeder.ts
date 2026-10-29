// src/users/seeders/staff.seeder.ts
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../users.service.js';
import { PlatformRole } from '../enums/roles.enum.js';
import { UserStatus } from '../enums/user-status.enum.js';
import { CreateUserDto } from '../dto/create-user.dto.js';

@Injectable()
export class StaffSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(StaffSeeder.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.getOrThrow<string>('STAFF_EMAIL');
    const password = this.config.getOrThrow<string>('STAFF_PASSWORD');
    const fullName = this.config.getOrThrow<string>('STAFF_FULL_NAME') ?? 'Staff User';

    try {
      const existing = await this.usersService.findByEmail(email);
      if (existing) {
        this.logger.log(`Staff ${email} already exists, skipping.`);
        return;
      }

      await this.usersService.createUser({
        email,
        password,
        fullName,
        platformRoles: [PlatformRole.STAFF],
        roles: [],
        status: UserStatus.ACTIVE,
      });

      this.logger.log(`Staff ${email} created successfully.`);
    } catch (error) {
      this.logger.error(
        `Failed to seed staff ${email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
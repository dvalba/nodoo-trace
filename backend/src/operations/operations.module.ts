import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationsService } from './operations.service.js';
import { OperationsController } from './operations.controller.js';
import { OperationAccessService } from './operation-access.service.js';
import { ActivityTypesModule } from '../activity-types/activity-types.module.js';
import { ActorModule } from '../actor/actor.module.js';
import { Actor } from '../actor/entities/actor.entity.js';
import { ActivityType } from '../activity-types/entities/activity-type.entity.js';
import { Operation } from '../activity-types/entities/operation.entity.js';
import { OperationsGuard } from '../auth/guards/operations.guard.js';

@Module({
  controllers: [OperationsController],
  providers: [
    OperationsService,
    OperationAccessService,
    { provide: APP_GUARD, useClass: OperationsGuard },
  ],
  exports: [OperationAccessService],
  imports: [
    TypeOrmModule.forFeature([Actor, ActivityType, Operation]),
    ActivityTypesModule,
    ActorModule,
  ],
})
export class OperationsModule {}

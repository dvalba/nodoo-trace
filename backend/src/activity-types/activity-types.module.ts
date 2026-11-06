import { Module } from '@nestjs/common';
import { ActivityTypesService } from './activity-types.service.js';
import { ActivityTypesController } from './activity-types.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityType } from './entities/activity-type.entity.js';
import { Operation } from './entities/operation.entity.js';

@Module({
  controllers: [ActivityTypesController],
  providers: [ActivityTypesService],
  imports: [
    TypeOrmModule.forFeature([ActivityType, Operation]),
  ],
  exports: [
    ActivityTypesService,
    TypeOrmModule,
  ],
})
export class ActivityTypesModule {}

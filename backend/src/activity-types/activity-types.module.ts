import { Module } from '@nestjs/common';
import { ActivityTypesService } from './activity-types.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityType } from './entities/activity-type.entity.js';

@Module({
  controllers: [],
  providers: [ActivityTypesService],
  imports: [
    TypeOrmModule.forFeature([ActivityType]),   
  ],
  exports: [
    ActivityTypesService
  ],
})
export class ActivityTypesModule {}



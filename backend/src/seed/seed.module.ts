import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityTypesModule } from '../activity-types/activity-types.module.js';
import { ActorModule } from '../actor/actor.module.js';
import { UsersModule } from '../users/users.module.js';
import { Product } from '../products/entities/product.entity.js';
import { Batch } from '../products/entities/batch.entity.js';
import { EventLedgerModule } from '../event-ledger/event-ledger.module.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Batch]),
    ActivityTypesModule,
    ActorModule,
    UsersModule,
    EventLedgerModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}

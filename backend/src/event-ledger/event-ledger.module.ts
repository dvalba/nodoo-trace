import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '../products/products.module.js';
import { Batch } from '../products/entities/batch.entity.js';
import { Actor } from '../actor/entities/actor.entity.js';
import { EventLedgerService } from './event-ledger.service.js';
import { TwinProjector } from './twin-projector.js';
import { EpcsController } from './controllers/epcs.controller.js';
import { LedgerEvent } from './entities/ledger-event.entity.js';
import { EventEpc } from './entities/event-epc.entity.js';
import { Epc } from './entities/epc.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerEvent, EventEpc, Epc, Batch, Actor]),
    ProductsModule,
  ],
  controllers: [EpcsController],
  providers: [EventLedgerService, TwinProjector],
  exports: [EventLedgerService, TypeOrmModule],
})
export class EventLedgerModule {}

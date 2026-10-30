import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventLedgerService } from './event-ledger.service.js';
import { EventLedgerController } from './event-ledger.controller.js';
import { LedgerEvent } from './entities/ledger-event.entity.js';
import { EventEpc } from './entities/event-epc.entity.js';
import { Epc } from './entities/epc.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEvent, EventEpc, Epc])],
  controllers: [EventLedgerController],
  providers: [EventLedgerService],
  exports: [TypeOrmModule],
})
export class EventLedgerModule {}

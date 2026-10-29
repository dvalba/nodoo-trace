import { Module } from '@nestjs/common';
import { EventLedgerService } from './event-ledger.service.js';
import { EventLedgerController } from './event-ledger.controller.js';

@Module({
  controllers: [EventLedgerController],
  providers: [EventLedgerService],
})
export class EventLedgerModule {}

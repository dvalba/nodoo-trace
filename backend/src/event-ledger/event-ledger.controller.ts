import { Controller } from '@nestjs/common';
import { EventLedgerService } from './event-ledger.service.js';

@Controller('event-ledger')
export class EventLedgerController {
  constructor(private readonly eventLedgerService: EventLedgerService) {}
}

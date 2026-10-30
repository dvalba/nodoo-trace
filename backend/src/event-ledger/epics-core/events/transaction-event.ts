import { BaseEvent } from './base-event.js';
import { BizTransactionType } from '../enums/biz-transaction-type.enum.js';
import { EventType } from '../enums/event-type.enum.js';

export class TransactionEvent extends BaseEvent {
  type: EventType = EventType.TRANSACTION;
  epcList: string[];
  bizTransactionType: BizTransactionType | string;
  bizTransactionId: string;
}

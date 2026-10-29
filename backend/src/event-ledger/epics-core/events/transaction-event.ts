import { BaseEvent, BizTransactionType, EventType } from '../index.js';

export class TransactionEvent extends BaseEvent {
  type: EventType = EventType.TRANSACTION;
  epcList: string[];
  bizTransactionType: BizTransactionType | string;
  bizTransactionId: string;
}

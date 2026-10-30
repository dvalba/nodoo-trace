import { BaseEvent } from './base-event.js';
import { BizStep } from '../enums/biz-step.enum.js';
import { EpcStatus } from '../enums/epc-status.enum.js';
import { EventAction } from '../enums/event-action.enum.js';
import { EventType } from '../enums/event-type.enum.js';

export class ObjectEvent extends BaseEvent {
  type: EventType = EventType.OBJECT;
  epcList: string[];
  action: EventAction;
  bizStep: BizStep;
  disposition: EpcStatus;
}

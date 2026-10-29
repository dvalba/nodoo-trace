import {
  BaseEvent,
  BizStep,
  Disposition,
  EventAction,
  EventType,
} from '../index.js';

export class ObjectEvent extends BaseEvent {
  type: EventType = EventType.OBJECT;
  epcList: string[];
  action: EventAction;
  bizStep: BizStep;
  disposition: Disposition;
}

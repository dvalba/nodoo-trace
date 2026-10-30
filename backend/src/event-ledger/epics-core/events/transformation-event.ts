import { BaseEvent } from './base-event.js';
import { BizStep } from '../enums/biz-step.enum.js';
import { EventType } from '../enums/event-type.enum.js';

export class TransformationEvent extends BaseEvent {
  type: EventType = EventType.TRANSFORMATION;
  inputEPCList: string[];
  outputEPCList: string[];
  bizStep: BizStep = BizStep.TRANSFORMING;
}

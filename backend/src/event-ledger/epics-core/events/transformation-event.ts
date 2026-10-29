import { BaseEvent, BizStep, EventType } from '../index.js';

export class TransformationEvent extends BaseEvent {
  type: EventType = EventType.TRANSFORMATION;
  inputEPCList: string[];
  outputEPCList: string[];
  bizStep: BizStep = BizStep.TRANSFORMING;
}

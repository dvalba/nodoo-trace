import { BaseEvent, EventAction, EventType } from '../index.js';

export class AssociationEvent extends BaseEvent {
  type: EventType = EventType.ASSOCIATION;
  epc: string;
  associatedEPC: string;
  action: EventAction.ADD | EventAction.DELETE;
}

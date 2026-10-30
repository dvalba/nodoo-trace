import { BaseEvent } from './base-event.js';
import { EventAction } from '../enums/event-action.enum.js';
import { EventType } from '../enums/event-type.enum.js';

export class AssociationEvent extends BaseEvent {
  type: EventType = EventType.ASSOCIATION;
  epc: string;
  associatedEPC: string;
  action: EventAction.ADD | EventAction.DELETE;
}

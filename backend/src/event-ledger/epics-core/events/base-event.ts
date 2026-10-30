import { EventType } from '../enums/event-type.enum.js';

export abstract class BaseEvent {
  batchId: string;
  type: EventType;
  readPointId: string;
  actorId: string;
  eventTime: Date;
}

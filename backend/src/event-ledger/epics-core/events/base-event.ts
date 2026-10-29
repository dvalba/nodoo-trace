import { EventType } from '../index.js';

export abstract class BaseEvent {
  batchId: string;
  type: EventType;
  readPointId: string;
  actorId: string;
  eventTime: Date;
}

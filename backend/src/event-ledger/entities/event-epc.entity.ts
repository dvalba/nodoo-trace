import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { EventEpcRole } from '../enums/event-epc-role.enum.js';
import { Epc } from './epc.entity.js';
import type { LedgerEvent } from './ledger-event.entity.js';

@Entity('event_epcs')
@Index(['epcId', 'eventId'])
export class EventEpc {
  @PrimaryColumn({ name: 'event_id', type: 'bigint' })
  eventId: string;

  @PrimaryColumn({ name: 'epc_id', type: 'text' })
  epcId: string;

  @PrimaryColumn({ type: 'enum', enum: EventEpcRole })
  role: EventEpcRole;

  @ManyToOne('LedgerEvent', 'epcs')
  @JoinColumn({ name: 'event_id' })
  event: LedgerEvent;

  @ManyToOne(() => Epc)
  @JoinColumn({ name: 'epc_id' })
  epc: Epc;
}

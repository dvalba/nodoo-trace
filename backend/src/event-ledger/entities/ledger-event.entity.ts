import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BizStep } from '../epics-core/enums/biz-step.enum.js';
import { EpcStatus } from '../epics-core/enums/epc-status.enum.js';
import { EventType } from '../epics-core/enums/event-type.enum.js';
import type { EventEpc } from './event-epc.entity.js';

@Entity('ledger_events')
@Index(['eventTime', 'id'])
@Index(['type'])
@Index(['actorId'])
@Index(['batchId'])
@Index(['bizTransactionType', 'bizTransactionId'])
@Index('uq_ledger_events_event_uid', ['eventUid'], { unique: true })
export class LedgerEvent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'enum', enum: EventType })
  type: EventType;

  @Column({ name: 'event_time', type: 'timestamptz' })
  eventTime: Date;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId: string | null;

  @Column({ name: 'read_point_id', type: 'text', nullable: true })
  readPointId: string | null;

  @Column({ name: 'biz_step', type: 'enum', enum: BizStep, nullable: true })
  bizStep: BizStep | null;

  @Column({
    name: 'biz_transaction_type',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  bizTransactionType: string | null;

  @Column({ name: 'biz_transaction_id', type: 'text', nullable: true })
  bizTransactionId: string | null;

  @Column({ type: 'enum', enum: EpcStatus, nullable: true })
  disposition: EpcStatus | null;

  @Column({ type: 'varchar', length: 32, default: 'platform' })
  source: string;

  @Column({ name: 'event_uid', type: 'text', nullable: true })
  eventUid: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @OneToMany('EventEpc', 'event')
  epcs: EventEpc[];
}

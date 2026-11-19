import {
  Entity, PrimaryColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity.js';
import { Batch } from '../../products/entities/batch.entity.js';
import { EpcStatus } from '../epics-core/enums/epc-status.enum.js';

@Entity('epcs')
@Index(['productId'])
@Index(['batchId'])
@Index(['parentId'])
@Index(['ownerActorId'])
@Index(['custodianActorId'])
@Index(['producerActorId'])
@Index(['destinationActorId'])
export class Epc {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId: string | null;

  @ManyToOne(() => Batch, { nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch: Batch | null;

  @Column({ name: 'parent_id', type: 'text', nullable: true })
  parentId: string | null;

  @Column({ name: 'producer_actor_id', type: 'uuid' })
  producerActorId: string;

  @Column({ name: 'owner_actor_id', type: 'uuid', nullable: true })
  ownerActorId: string | null;

  @Column({ name: 'custodian_actor_id', type: 'uuid', nullable: true })
  custodianActorId: string | null;

  @Column({ name: 'destination_actor_id', type: 'uuid', nullable: true })
  destinationActorId: string | null;

  @Column({ type: 'enum', enum: EpcStatus, default: EpcStatus.ACTIVE })
  status: EpcStatus;

  @CreateDateColumn({ name: 'commissioned_at', type: 'timestamptz' })
  commissionedAt: Date;
}
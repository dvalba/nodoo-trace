import {
  Entity, PrimaryColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity.js';
import { Batch } from '../../products/entities/batch.entity.js';

export enum EpcStatus {
  ACTIVE = 'active',
  IN_TRANSIT = 'in_transit',
  CONSUMED = 'consumed',
  DAMAGED = 'damaged',
  EXPIRED = 'expired',
}

@Entity('epcs')
@Index(['productId'])
@Index(['batchId'])
@Index(['parentEpcId'])
@Index(['ownerActorId'])
@Index(['custodianActorId'])
@Index(['producerActorId'])
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

  @Column({ name: 'parent_epc_id', type: 'text', nullable: true })
  parentEpcId: string | null;

  @Column({ name: 'producer_actor_id', type: 'uuid' })
  producerActorId: string;

  @Column({ name: 'owner_actor_id', type: 'uuid', nullable: true })
  ownerActorId: string | null;

  @Column({ name: 'custodian_actor_id', type: 'uuid', nullable: true })
  custodianActorId: string | null;

  @Column({ type: 'enum', enum: EpcStatus, default: EpcStatus.ACTIVE })
  status: EpcStatus;

  @CreateDateColumn({ name: 'commissioned_at' })
  commissionedAt: Date;
}
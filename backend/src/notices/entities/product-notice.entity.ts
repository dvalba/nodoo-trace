import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity.js';
import { Batch } from '../../products/entities/batch.entity.js';
import { NoticeType } from '../enums/notice-type.enum.js';
import type { ProductNoticeEpc } from './product-notice-epc.entity.js';
import type { ProductNoticeAck } from './product-notice-ack.entity.js';

@Entity('product_notices')
@Index(['productId', 'createdAt'])
@Index(['batchId'])
export class ProductNotice {
  @PrimaryGeneratedColumn('uuid')
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

  @Column({ type: 'enum', enum: NoticeType })
  type: NoticeType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'created_by_actor_id', type: 'uuid' })
  createdByActorId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany('ProductNoticeEpc', 'notice')
  epcs: ProductNoticeEpc[];

  @OneToMany('ProductNoticeAck', 'notice')
  acks: ProductNoticeAck[];
}

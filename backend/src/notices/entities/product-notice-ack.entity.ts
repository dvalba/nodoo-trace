import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ProductNotice } from './product-notice.entity.js';

@Entity('product_notice_acks')
@Index(['noticeId', 'actorId'], { unique: true })
export class ProductNoticeAck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notice_id', type: 'uuid' })
  noticeId: string;

  @ManyToOne('ProductNotice', 'acks', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notice_id' })
  notice: ProductNotice;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @CreateDateColumn({ name: 'acknowledged_at', type: 'timestamptz' })
  acknowledgedAt: Date;
}

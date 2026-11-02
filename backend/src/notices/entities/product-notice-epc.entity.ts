import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Epc } from '../../event-ledger/entities/epc.entity.js';
import type { ProductNotice } from './product-notice.entity.js';

@Entity('product_notice_epcs')
@Index(['epcId'])
export class ProductNoticeEpc {
  @PrimaryColumn({ name: 'notice_id', type: 'uuid' })
  noticeId: string;

  @PrimaryColumn({ name: 'epc_id', type: 'text' })
  epcId: string;

  @ManyToOne('ProductNotice', 'epcs', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notice_id' })
  notice: ProductNotice;

  @ManyToOne(() => Epc)
  @JoinColumn({ name: 'epc_id' })
  epc: Epc;
}

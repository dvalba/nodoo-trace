import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import type { Product } from './product.entity.js';

@Entity('batches')
@Index(['productId', 'batchCode'], { unique: true })
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne('Product', 'batches')
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'batch_code', type: 'varchar', length: 128 })
  batchCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

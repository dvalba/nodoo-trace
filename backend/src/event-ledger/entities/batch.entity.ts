import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Product } from './product.entity.js';

@Entity('batches')
@Index(['productId', 'batchCode'], { unique: true })
export class Batch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.batches)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'batch_code', type: 'text' })
  batchCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
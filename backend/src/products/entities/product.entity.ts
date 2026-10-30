import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, OneToMany,
} from 'typeorm';
import type { Batch } from './batch.entity.js';

@Entity('products')
@Index(['createdByActorId', 'sku'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'created_by_actor_id', type: 'uuid' })
  createdByActorId: string;

  @Column({ type: 'varchar', length: 64 })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany('Batch', 'product')
  batches: Batch[];
}

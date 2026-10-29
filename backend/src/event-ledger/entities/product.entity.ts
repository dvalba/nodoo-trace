import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, OneToMany,
} from 'typeorm';
import { Batch } from './batch.entity.js';

@Entity('products')
@Index(['createdByActorId', 'sku'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'created_by_actor_id', type: 'uuid' })
  createdByActorId: string;

  @Column({ type: 'text', length: 64 })
  sku: string;

  @Column({ type: 'text', length: 255 })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Batch, (batch) => batch.product)
  batches: Batch[];
}
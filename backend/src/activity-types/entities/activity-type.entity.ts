import { Column, Entity, ManyToMany, PrimaryColumn, Relation } from 'typeorm';
import { Actor } from '../../actor/entities/actor.entity.js';

@Entity('activity_types')
export class ActivityType {
  static filter(arg0: (a: any) => boolean) {
    throw new Error('Method not implemented.');
  }
  @PrimaryColumn({ type: 'varchar', length: 50 })
  code: string;

  /** Nombre legible para mostrar en la UI (ej. 'Proveedor', 'Fabricante'). */
  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', generated: 'increment' })
  sortOrder: number;

  @ManyToMany(() => Actor, (actor) => actor.activities)
  actors: Relation<Actor>[];
}

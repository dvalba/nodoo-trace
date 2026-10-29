import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryColumn,
  Relation,
} from 'typeorm';
import { Actor } from '../../actor/entities/actor.entity.js';
import { Operation } from './operation.entity.js';

@Entity('activity_types')
export class ActivityType {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  code: string;

  /** Nombre legible para mostrar en la UI (ej. 'Proveedor', 'Fabricante'). */
  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ default: true })
  isActive: boolean;

  /** true para ActivityTypes creadas por un owner desde el onboarding. */
  @Column({ default: false })
  isCustom: boolean;

  @Column({ type: 'int', generated: 'increment' })
  sortOrder: number;

  @ManyToMany(() => Actor, (actor) => actor.activities)
  actors: Relation<Actor>[];

  @ManyToMany(() => Operation, (operation) => operation.activities)
  @JoinTable({
    name: 'activity_operations',
    joinColumn: { name: 'activityTypeCode', referencedColumnName: 'code' },
    inverseJoinColumn: { name: 'operationCode', referencedColumnName: 'code' },
  })
  operations: Relation<Operation>[];
}

import { Column, Entity, ManyToMany, PrimaryColumn, Relation } from 'typeorm';
import { ActivityType } from './activity-type.entity.js';

@Entity('operations')
export class Operation {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  code: string;

  /** Nombre legible para mostrar en la UI (ej. 'Dispatch products'). */
  @Column()
  label: string;

  /** Grupo para organizar los checkboxes en la UI (ej. 'Movement'). */
  @Column({ type: 'varchar', length: 50 })
  group: string;

  @Column({ type: 'int' })
  sortOrder: number;

  @ManyToMany(() => ActivityType, (activity) => activity.operations)
  activities: Relation<ActivityType>[];
}

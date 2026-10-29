import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, OneToMany, Relation, UpdateDateColumn } from "typeorm";
import { ActivityType } from "../../activity-types/entities/activity-type.entity.js";
import { ActorStatus } from "../enums/actor-status.enum.js";
import { User } from "../../users/entities/user.entity.js";

@Entity('actors')
export class Actor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column({
    type: 'enum',
    enum: ActorStatus,
    default: ActorStatus.PENDING_APPROVAL,
  })
  status: ActorStatus;

  @ManyToMany(() => ActivityType)
  @JoinTable({
    name: 'actor_activities',
    joinColumn: { name: 'actorId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'activityTypeCode', referencedColumnName: 'code' },
  })
  activities: Relation<ActivityType>[];

  @OneToMany(() => User, (user) => user.actor)
  users: Relation<User>[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
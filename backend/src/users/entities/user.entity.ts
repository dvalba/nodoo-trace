import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  PlatformRole,
  UserRole,
  UserStatus,
} from '../enums/index.js';
import { Actor } from '../../actor/entities/actor.entity.js';

import type { Relation } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({
    type: 'enum',
    enum: PlatformRole,
    array: true,
    default: [PlatformRole.USER],
  })
  platformRoles: PlatformRole[];

  @Column({
    type: 'enum',
    enum: UserRole,
    array: true,
    default: [UserRole.MEMBER],
  })
  roles: UserRole[];

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.EMAIL_UNVERIFIED,
  })
  status: UserStatus;

  @Column({ nullable: true })
  actorId: string;

  @ManyToOne(() => Actor, (actor) => actor.users, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'actorId' })
  actor: Relation<Actor>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeFields() {
    if (this.email) {
      this.email = this.email.trim().toLowerCase();
    }
  }
}

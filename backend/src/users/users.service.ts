import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, QueryRunner, Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
import * as bcrypt from 'bcrypt';
import { handleDbExceptions } from '../common/helpers/db-exception.helper.js';
import { throwNotFound } from '../common/helpers/crud-exceptions.helper.js';
import { UserRole } from './enums/roles.enum.js';
import { UserStatus } from './enums/user-status.enum.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findById(id: string) {
    return this.userRepo.findOneBy({ id });
  }
  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throwNotFound('User', id);
    return user;
  }
  async activateAwaitingUsers(actorId: string, manager?: EntityManager) {
    const m = manager ?? this.userRepo.manager;

    const result  = await m.update(
      User,
      { actorId, status: UserStatus.AWAITING_APPROVAL },
      { status: UserStatus.ACTIVE },
    );
    return { activated: result.affected ?? 0 };
  }
  async updateStatus(id: string, status: UserStatus) {
    await this.userRepo.update(id, { status });
  }
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.passwordHash')
      .getOne();
  }
  async findByEmailOrFail(email: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) throwNotFound('User', email, 'email');

    return user;
  }
  async findByEmailInActor(email: string, actorId: string) {
    return this.userRepo.findOne({ where: { email, actorId } });
  }

  async listMembers(actorId: string) {
    const users = await this.userRepo.find({
      where: { actorId },
      order: { createdAt: 'ASC' },
    });
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
      status: user.status,
      createdAt: user.createdAt,
    }));
  }

  async addMemberRoles(
    actorId: string,
    userId: string,
    callerId: string,
    roles: UserRole[],
  ) {
    const target = await this.findMember(actorId, userId);
    if (roles.includes(UserRole.OWNER)) {
      throw new BadRequestException(
        'The owner role cannot be assigned to another user',
      );
    }

    const current = target.roles ?? [];
    const merged = [...new Set([...current, ...roles])];
    if (merged.length === current.length) {
      throw new ConflictException(
        'The member already has all of these roles',
      );
    }

    target.roles = merged;
    await this.userRepo.save(target);

    return {
      id: target.id,
      email: target.email,
      fullName: target.fullName,
      roles: target.roles,
      status: target.status,
      createdAt: target.createdAt,
    };
  }

  async removeMember(actorId: string, userId: string, callerId: string) {
    const target = await this.findMember(actorId, userId);
    if (target.roles.includes(UserRole.OWNER)) {
      throw new ConflictException(
        'The organization owner cannot be removed',
      );
    }
    if (target.id === callerId) {
      throw new ConflictException('You cannot remove your own account');
    }

    await this.userRepo.delete(target.id);

    return { deleted: true, userId: target.id };
  }

  private async findMember(actorId: string, userId: string) {
    const target = await this.userRepo.findOne({
      where: { id: userId, actorId },
    });
    if (!target) {
      throw new NotFoundException('User not found in this organization');
    }
    return target;
  }

  async createUser(
    dto: CreateUserDto,
    queryRunner?: QueryRunner,
  ): Promise<User> {
    const { password, platformRoles, roles, status, ...rest } = dto;

    const manager = queryRunner ? queryRunner.manager : this.userRepo.manager;

    try {
      const passwordHash = await bcrypt.hash(password, 10);

      const user = this.userRepo.create({
        ...rest,
        passwordHash,
        platformRoles: platformRoles,
        roles: roles,
        status: status,
      });
      const saved = await manager.save(user);
      return saved;
    } catch (error) {
      handleDbExceptions(error);
    }
  }
}

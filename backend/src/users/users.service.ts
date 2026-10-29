import { Injectable } from '@nestjs/common';
import { EntityManager, QueryRunner, Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
import * as bcrypt from 'bcrypt';
import { handleDbExceptions } from '../common/helpers/db-exception.helper.js';
import { throwNotFound } from '../common/helpers/crud-exceptions.helper.js';
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

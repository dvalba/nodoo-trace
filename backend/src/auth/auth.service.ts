import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegisterActorDto } from './dto/register-actor-dto.js';
import { DataSource } from 'typeorm';
import { UsersService } from '../users/users.service.js';
import { ActorService } from '../actor/actor.service.js';
import { PlatformRole, UserRole } from '../users/enums/roles.enum.js';
import { UserStatus } from '../users/enums/user-status.enum.js';
import { ActorStatus } from '../actor/enums/actor-status.enum.js';
import type { ActivityType } from '../activity-types/entities/activity-type.entity.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import type { User } from '../users/entities/user.entity.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';


@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly actorService: ActorService,
    private readonly inviteService: InvitationsService,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterActorDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const demoMode = this.config.get<boolean>('DEMO_SEED') === true;

    try {
      const actor = await this.actorService.createActor(dto, queryRunner);

      if (demoMode) {
        await this.actorService.updateStatus(
          actor.id,
          ActorStatus.APPROVED,
          queryRunner.manager,
        );
        actor.status = ActorStatus.APPROVED;
      }

      const user = await this.userService.createUser(
        {
          email: dto.adminEmail,
          password: dto.adminPassword,
          fullName: dto.adminFullName,
          actorId: actor.id,
          platformRoles: [PlatformRole.USER],
          roles: [UserRole.OWNER],
          status: demoMode ? UserStatus.ACTIVE : UserStatus.EMAIL_UNVERIFIED,
        },
        queryRunner,
      );

      let emailSent = false;
      if (!demoMode) {
        const result = await this.inviteService.createOwnerVerification(
          actor.id,
          dto.adminEmail,
          actor.name,
          queryRunner,
        );
        emailSent = result.emailSent;
      }

      await queryRunner.commitTransaction();

      return {
        actor: {
          id: actor.id,
          name: actor.name,
          organizationNumber: actor.organizationNumber,
          status: actor.status,
          activities: (actor.activities ?? []).map((activity) => ({
            code: (activity as ActivityType).code,
            name: (activity as ActivityType).name,
          })),
        },
        user: this.publicUser(user),
        emailSent,
        demoMode,
        message: demoMode
          ? 'Organización creada y activada en modo demo. Inicia sesión y configura qué operaciones hace tu empresa.'
          : emailSent
            ? 'Registration successful. Verify your email, then sign in and configure your operations.'
            : 'Registration successful, but we could not send the verification email. Please use the resend endpoint.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      actorId: user.actorId,
      platformRoles: user.platformRoles,
      roles: user.roles,
      status: user.status,
    };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const email = dto.email.trim().toLowerCase();

    // 1. Buscar el user con el passwordHash (que por defecto no se selecciona)
    const user = await this.userService.findByEmailWithPassword(email);
    if (!user) {
      // Mismo mensaje que "password incorrecta" → no filtra si el email existe
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);

    // 2. Verificar password
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.EMAIL_UNVERIFIED) {
      throw new UnauthorizedException({
        code: 'EMAIL_UNVERIFIED',
        message:
          'Please verify your email. Check your inbox for the verification link.',
      });
    }

    if (user.status === UserStatus.AWAITING_APPROVAL) {
      throw new UnauthorizedException({
        code: 'AWAITING_APPROVAL',
        message:
          'Your organization is pending approval. We will notify you once it is active.',
      });
    }

    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.BANNED
    ) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Your account is not active. Please contact support.',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'Your account is not active. Please contact support.',
      });
    }

    if (user.actorId) {
      const actor = await this.actorService.findById(user.actorId);
      if (!actor || actor.status !== ActorStatus.APPROVED) {
        throw new UnauthorizedException({
          code: 'AWAITING_APPROVAL',
          message: 'Your organization is not active. Please contact support.',
        });
      }
    }

    const accessToken = await this.jwtService.signAsync({ sub: user.id });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        actorId: user.actorId,
        platformRoles: user.platformRoles,
        roles: user.roles,
      },
    };
  }

  async profile(user: { id: string; actorId: string | null }) {
    const [fullUser, actor] = await Promise.all([
      this.userService.findByIdOrFail(user.id),
      user.actorId ? this.actorService.findByIdWithActivities(user.actorId) : Promise.resolve(null),
    ]);

    return {
      user: {
        id: fullUser.id,
        email: fullUser.email,
        fullName: fullUser.fullName,
        actorId: fullUser.actorId,
        platformRoles: fullUser.platformRoles,
        roles: fullUser.roles,
      },
      actor: actor
        ? {
            id: actor.id,
            name: actor.name,
            activities: ((actor.activities ?? []) as ActivityType[]).map(
              (a) => ({ code: a.code, name: a.name }),
            ),
            operations: [
              ...new Set(
                ((actor.activities ?? []) as ActivityType[]).flatMap((a) =>
                  (a.operations ?? []).map((o) => o.code),
                ),
              ),
            ],
          }
        : null,
    };
  }
}



import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterActorDto } from './dto/register-actor-dto.js';
import { DataSource } from 'typeorm';
import { UsersService } from '../users/users.service.js';
import { ActorService } from '../actor/actor.service.js';
import { PlatformRole, UserRole } from '../users/enums/roles.enum.js';
import { UserStatus } from '../users/enums/user-status.enum.js';
import { AcceptInviteDto } from '../invitations/dto/accept-invite.dto.js';
import { ActorStatus } from '../actor/enums/actor-status.enum.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import { TokenService } from '../common/interfaces/token-service.interface.js';
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
  ) {}

  async register(dto: RegisterActorDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const actor = await this.actorService.createActor(dto, queryRunner);

      const user = await this.userService.createUser(
        {
          email: dto.adminEmail,
          password: dto.adminPassword,
          fullName: dto.adminFullName,
          actorId: actor.id,
          platformRoles: [PlatformRole.USER],
          roles: [UserRole.OWNER],
          status: UserStatus.EMAIL_UNVERIFIED,
        },
        queryRunner,
      );
      const result = await this.inviteService.createOwnerVerification(
        actor.id,
        dto.adminEmail,
        actor.name,
        queryRunner,
      );
      const emailSent = result.emailSent;

      await queryRunner.commitTransaction();
      return {
        actor,
        user,
        emailSent,
        message: emailSent
          ? 'Registration successful. Check your email to verify your account.'
          : 'Registration successful, but we could not send the verification email. Please use the resend endpoint.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
}



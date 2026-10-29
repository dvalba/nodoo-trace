import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { ActorService } from '../actor/actor.service.js';
import { InvitationsRepository } from './interfaces/invitations-repository.interface.js';
import { Invitation, InvitationStatus } from './entities/invitation.entity.js';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../common/interfaces/token-service.interface.js';
import { parseDurationMs } from '../common/helpers/parse-duration.js';
import { EmailSender } from '../common/interfaces/email-sender.js';
import { invitationEmailTemplate } from './templates/invitation-email.template.js';
import { InviteResponseDto } from './dto/invite.response.dto.js';
import { InvitePreviewDto } from './dto/invite-preview.response.dto.js';
import { QueryRunner } from 'typeorm';
import { PlatformRole, UserRole } from '../users/enums/roles.enum.js';
import { UsersService } from '../users/users.service.js';
import { Actor } from '../actor/entities/actor.entity.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { ActorStatus } from '../actor/enums/actor-status.enum.js';
import { UserStatus } from '../users/enums/user-status.enum.js';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);
  private readonly resendIntervalMs: number;
  private readonly expiresInMs: number;

  constructor(
    private readonly actorService: ActorService,
    @Inject(InvitationsRepository)
    private readonly inviteRepo: InvitationsRepository,
    @Inject(EmailSender)
    private readonly email: EmailSender,
    @Inject(TokenService)
    private readonly tokens: TokenService,
    private readonly userService: UsersService,
    private readonly config: ConfigService,
  ) {
    this.resendIntervalMs = parseDurationMs(
      this.config.getOrThrow<string>('INVITATION_RESEND_INTERVAL'),
    );
    this.expiresInMs = parseDurationMs(
      this.config.getOrThrow<string>('INVITATION_EXPIRES_IN'),
    );
  }

  async invite(caller: AuthUser, dto: InviteUserDto) {
    const email = dto.email.trim().toLowerCase();

    const globalUser = await this.userService.findByEmail(email);
    if (globalUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const existingUser = await this.actorService.findByEmailInActor(
      email,
      caller.actorId,
    );
    if (existingUser) {
      throw new ConflictException(
        'A user with this email already exists in your organization',
      );
    }

    const pending = await this.inviteRepo.findPendingByEmail(
      email,
      caller.actorId,
    );

    this.assertCooldownPassed(pending, this.resendIntervalMs);

    const rawToken = this.tokens.generate();
    const tokenHash = await this.tokens.hash(rawToken);
    const expiresAt = new Date(Date.now() + this.expiresInMs);

    const invitation = await this.inviteRepo.reissue(
      {
        actorId: caller.actorId,
        email,
        roles: dto.roles,
        invitedById: caller.id,
        tokenHash,
        expiresAt,
      },
      pending?.id,
    );

    const actor = await this.actorService.findByIdOrFail(caller.actorId);
    const actorName = actor?.name ?? 'your organization';

    const emailSent = await this.sendInvitationEmail(
      invitation,
      rawToken,
      caller.email,
      actorName,
    );
    return this.toResponse(invitation, caller, actor, emailSent);
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const { inviteId, actorId, actorStatus, email, roles, hasAccount } =
      await this.preview(dto.inviteToken);

    if (hasAccount) {
      throw new BadRequestException(
        'You already have an account. Please use the verification link.',
      );
    }

    if (actorStatus !== ActorStatus.APPROVED) {
      throw new ForbiddenException(
        'The organization is not active. Cannot accept this invitation.',
      );
    }
    const { password, fullName } = dto;

    const user = await this.userService.createUser({
      email,
      password,
      fullName,
      actorId,
      platformRoles: [PlatformRole.USER],
      roles,
      status: UserStatus.ACTIVE,
    });

    await this.markAccepted(inviteId, user.id);

    return {
      userId: user.id,
      email: user.email,
      created: true,
      userStatus: UserStatus.ACTIVE,
      actorStatus,
      message: 'Account created! You can now log in.',
    };
  }
  async verifyEmailToken(token: string) {
    const tokenHash = await this.tokens.hash(token);
    const invite = await this.inviteRepo.findByTokenHash(tokenHash);
    if (!invite) {
      throw new NotFoundException(
        'Invitation not found, expired or already used',
      );
    }
    const tokenOk = await this.tokens.verify(token, invite.tokenHash);
    if (!tokenOk) {
      throw new NotFoundException(
        'Invitation not found, expired or already used',
      );
    }

    const actor = await this.actorService.findById(invite.actorId);
    if (!actor) {
      throw new BadRequestException('Associated organization does not exist');
    }

    const existingUser = await this.userService.findByEmailInActor(
      invite.email,
      invite.actorId,
    );
    if (!existingUser) {
      throw new BadRequestException(
        'This invitation requires creating an account. Please use the registration form.',
      );
    }

    const status =
      actor.status === ActorStatus.APPROVED
        ? UserStatus.ACTIVE
        : UserStatus.AWAITING_APPROVAL;

    const message =
      status === UserStatus.ACTIVE
        ? 'Email verified! You can now log in.'
        : 'Email verified! Your organization is pending approval.';

    if (invite.status === InvitationStatus.Accepted) {
      return {
        userId: existingUser.id,
        email: invite.email,
        created: false,
        userStatus: status,
        actorStatus: actor.status,
        message,
      };
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('This invitation has expired.');
    }

    await this.userService.updateStatus(existingUser.id, status);
    await this.markAccepted(invite.id, existingUser.id);

    return {
      userId: existingUser.id,
      email: invite.email,
      created: false,
      userStatus: status,
      actorStatus: actor.status,
      message,
    };
  }

  async createOwnerVerification(
    actorId: string,
    email: string,
    actorName: string,
    queryRunner?: QueryRunner,
  ): Promise<{ invitation: Invitation; rawToken: string; emailSent: boolean }> {
    const rawToken = this.tokens.generate();
    const tokenHash = await this.tokens.hash(rawToken);
    const expiresAt = new Date(Date.now() + this.expiresInMs);

    const invitation = await this.inviteRepo.create(
      {
        actorId,
        email,
        roles: [UserRole.OWNER],
        tokenHash,
        expiresAt,
      },
      queryRunner,
    );

    const emailSent = await this.sendInvitationEmail(
      invitation,
      rawToken,
      actorName,
      null, // owner verification: sin invitador
    );

    return { invitation, rawToken, emailSent };
  }

  async findPendingByToken(rawToken: string): Promise<Invitation> {
    const tokenHash = await this.tokens.hash(rawToken);
    const invite = await this.inviteRepo.findPendingByTokenHash(tokenHash);

    if (!invite) {
      throw new NotFoundException(
        'Invitation not found, expired or already used',
      );
    }
    const tokenOk = await this.tokens.verify(rawToken, invite.tokenHash);
    if (!tokenOk) {
      throw new NotFoundException(
        'Invitation not found, expired or already used',
      );
    }

    return invite;
  }
  async preview(rawToken: string): Promise<InvitePreviewDto> {
    const invite = await this.findPendingByToken(rawToken);
    const actor = await this.actorService.findById(invite.actorId);

    if (!actor) {
      throw new BadRequestException('Associated organization does not exist');
    }

    const existingUser = await this.userService.findByEmailInActor(
      invite.email,
      invite.actorId,
    );

    return {
      inviteId: invite.id,
      actorId: actor?.id,
      actorName: actor?.name,
      actorStatus: actor.status,
      email: invite.email,
      roles: invite.roles,
      expiresAt: invite.expiresAt,
      hasAccount: existingUser !== null,
      userId: existingUser?.id,
    };
  }

  private assertCooldownPassed(
    pending: Invitation | null,
    resendIntervalMs: number,
  ): void {
    if (!pending) return;

    const elapsedMs = Date.now() - pending.createdAt.getTime();
    if (elapsedMs >= resendIntervalMs) return;

    const retryAfterMinutes = Math.ceil((resendIntervalMs - elapsedMs) / 60_000);

    throw new ConflictException({
      statusCode: 409,
      code: 'RETRY_LATER',
      message: `An invitation was sent recently. Try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? '' : 's'}.`,
      retryAfterMinutes,
    });
  }

  private async sendInvitationEmail(
    invitation: Invitation,
    rawToken: string,
    actorName: string,
    inviterEmail: string | null,
  ): Promise<boolean> {
    const front = this.config.getOrThrow<string>('HOST_FRONT');
    const platformName = this.config.getOrThrow<string>('PLATFORM_NAME');
    const isOwnerVerification = invitation.invitedById === null;

    const url = isOwnerVerification
      ? `${front}/invitations/verify/${rawToken}`
      : `${front}/invitations/${invitation.id}/${rawToken}`;

    const shortActor =
      actorName.length > 30 ? `${actorName.slice(0, 27)}...` : actorName;

    const subject = isOwnerVerification
      ? `Verify your email to activate ${shortActor} on ${platformName}`
      : `You have been invited to join ${shortActor} on ${platformName}`;

    try {
      const email = isOwnerVerification
        ? platformName
        : inviterEmail ?? platformName;

      await this.email.send({
        to: invitation.email,
        subject,
        html: invitationEmailTemplate({
          actorName,
          inviterEmail: email,
          roles: invitation.roles,
          inviteUrl: url,
          expiresAt: invitation.expiresAt,
          mode: isOwnerVerification ? 'verify' : 'invite',
        }),
        text: `You were invited to "${actorName}" by ${email}.`,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send ${isOwnerVerification ? 'owner-verification' : 'invitation'} email to ${invitation.email} (invitationId=${invitation.id}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private toResponse(
    invitation: Invitation,
    caller: AuthUser,
    actor: Actor,
    emailSent: boolean,
  ): InviteResponseDto {
    return {
      id: invitation.id,
      email: invitation.email,
      actorName: actor.name,
      actorStatus: actor.status,
      roles: invitation.roles,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      invitedBy: { id: caller.id, email: caller.email },
      emailSent,
    };
  }
  async markAccepted(id: string, acceptedById: string) {
    await this.inviteRepo.markAccepted(id, acceptedById);
  }
}

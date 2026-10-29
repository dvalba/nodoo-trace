import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service.js';
import { Caller } from '../auth/decorators/caller.decorator.js';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { UserRole } from '../users/enums/roles.enum.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly inviteService: InvitationsService) {}

  @Auth(UserRole.OWNER, UserRole.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Invite a user to the organization',
    description:
      'Creates (or reissues) a pending invitation and sends an email. Reuses an existing pending invitation if the resend cooldown has passed; rejects duplicates with 409.',
  })
  invite(@Caller() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.inviteService.invite(user, dto);
  }

  @Public()
  @Post('verify')
  @ApiOperation({
    summary: 'Verify the email of an existing account via invitation token',
    description:
      'Activates (or marks as awaiting approval) the user that already has an account. Idempotent: verifying an already-accepted token returns the previous result.',
  })
  verifyEmailToken(@Body() dto: VerifyEmailDto) {
    return this.inviteService.verifyEmailToken(dto.token);
  }

  @Public()
  @Get(':token/preview')
  @ApiOperation({
    summary: 'Preview invitation details from the token (for the frontend)',
    description:
      'Returns the invitation data shown before accepting or verifying: organization, roles, expiration and whether the email already has an account.',
  })
  preview(@Param('token') token: string) {
    return this.inviteService.preview(token);
  }

  @Public()
  @Post('accept')
  @ApiOperation({
    summary: 'Accept an invitation and create a new account',
    description:
      'Creates the user under the invited organization. Only allowed when the email does not have an account yet and the organization is approved.',
  })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.inviteService.acceptInvite(dto);
  }
}

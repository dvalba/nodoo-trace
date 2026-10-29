import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { InvitationsService } from './invitations.service.js';
import { Caller } from '../auth/decorators/caller.decorator.js';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { UserRole } from '../users/enums/roles.enum.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly inviteService: InvitationsService) {}

  @Auth(UserRole.OWNER, UserRole.ADMIN)
  @Post()
  invite(@Caller() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.inviteService.invite(user, dto);
  }

  @Public()
  @Post('verify')
  verifyEmailToken(@Body() dto: VerifyEmailDto) {
    return this.inviteService.verifyEmailToken(dto.token);
  }

  @Public()
  @Get(':token/preview')
  preview(@Param('token') token: string) {
    return this.inviteService.preview(token);
  }

  @Public()
  @Post('accept')
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.inviteService.acceptInvite(dto);
  }
}

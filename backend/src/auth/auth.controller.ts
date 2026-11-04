import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterActorDto } from './dto/register-actor-dto.js';
import { Public } from './decorators/public.decorator.js';
import { Auth } from './decorators/auth.decorator.js';
import { Caller } from './decorators/caller.decorator.js';
import type { AuthUser } from './interfaces/auth-user.interface.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new organization (actor) with its owner account',
    description:
      'Creates the actor, the owner user (pending email verification) and sends a verification email. All in a single transaction.',
  })
  registerActor(@Body() dto: RegisterActorDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Returns a JWT access token and the user profile. Fails if the account is unverified, pending approval, suspended or banned.',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Auth()
  @Get('me')
  @ApiOperation({
    summary: 'Get the authenticated user profile and its organization',
    description:
      'Returns the current user plus the actor (name and activity types) they belong to.',
  })
  me(@Caller() user: AuthUser) {
    return this.authService.profile(user);
  }

  // //TODO PONER UN GUARD PARA QUE SOLO LO HAGAN LOS USUARIOS ADMINS
  // @Post('/actor/members/invite')
  // @UseGuards(AuthGuard())
  // inviteMember(@Caller() user: AuthUser , @Body() dto: InviteMemberDto) {
  // }

  //   // userI
  //   validateEmail(){
  //   }

  //   @Post('accept-invite')
  //   acceptInvite(@Body() dto: AcceptInviteDto) {
  //     return this.authService.acceptInvite(dto);
  //   }
}

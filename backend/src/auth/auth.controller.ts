import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterActorDto } from './dto/register-actor-dto.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  registerActor(@Body() dto: RegisterActorDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ensureAuthenticated } from '../../common/helpers/ensure-authenticated.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../interfaces/auth-user.interface.js';
import { UsersService } from '../../users/users.service.js';
import { UserStatus } from '../../users/enums/index.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly userService: UsersService,
  ) {

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload):Promise<AuthUser> {
    const message = 'Your account is not available. Please contact support.';

    const user = await ensureAuthenticated(
      this.userService.findByIdOrFail(payload.sub),
      {
        catches: [{ match: (e) => e instanceof NotFoundException, message }],
        passes: [{ check: (u) => u.status === UserStatus.ACTIVE , message }],
      },
    );

    return {
      id: user.id,
      email: user.email,
      platformRoles: user.platformRoles,  
      roles : user.roles,
      actorId: user.actorId,
    };
  }
}





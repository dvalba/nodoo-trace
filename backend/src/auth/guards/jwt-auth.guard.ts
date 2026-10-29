import {
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { ConfigService } from '@nestjs/config';
import { MetaRoles } from '../decorators/meta-roles.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    const isProd = this.config.getOrThrow('NODE_ENV') === 'production';

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC,
      targets,
    );

    if (isPublic) return true;

    const hasAuth =
        this.reflector.getAllAndOverride(MetaRoles, targets) !== undefined;
    if (hasAuth) return super.canActivate(context);

    if (isProd) throw new NotFoundException();

    this.logger.warn(
      `Route ${context.getClass().name}.${context.getHandler().name} has no @Auth/@Public and NODE_ENV is not "production"; leaving it open (dev only).`,
    );
    return true;
  }
}

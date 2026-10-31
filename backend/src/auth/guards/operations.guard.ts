import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_OPERATION } from '../decorators/requires-operation.decorator.js';
import { AuthUser } from '../interfaces/auth-user.interface.js';
import { OperationAccessService } from '../../operations/operation-access.service.js';

@Injectable()
export class OperationsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly operationAccess: OperationAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRES_OPERATION,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();

    if (!user) throw new UnauthorizedException('User not authenticated');

    await this.operationAccess.assertAllowed(user, required);

    return true;
  }
}

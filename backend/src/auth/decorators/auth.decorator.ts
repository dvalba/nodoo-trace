import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { MetaRoles, RolesRequired } from './meta-roles.decorator.js';

export function Auth(...roles: RolesRequired[]) {
  return applyDecorators(
    MetaRoles(roles),
    ApiBearerAuth('jwt'),
  );
}

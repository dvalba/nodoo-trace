import { Reflector } from '@nestjs/core';
import { MultiTenantRole} from '../../users/enums/roles.enum.js';


export type RolesRequired = MultiTenantRole | MultiTenantRole[];


export const MetaRoles = Reflector.createDecorator<RolesRequired[]>();


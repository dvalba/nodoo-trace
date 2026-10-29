import { PlatformRole, UserRole } from '../../users/enums/roles.enum.js';

export interface AuthUser {
  id: string;
  email: string;
  roles: UserRole[];
  platformRoles: PlatformRole[];
  actorId: string;
}

import { PlatformRole, UserRole } from '../../users/enums/roles.enum.js';

export interface LoginResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    actorId: string;
    platformRoles: PlatformRole[];
    roles: UserRole[];
  };
}

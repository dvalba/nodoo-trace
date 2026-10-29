import { UserRole } from '../../users/enums/roles.enum.js';
import { ActorStatus } from '../../actor/enums/actor-status.enum.js';

export class InvitePreviewDto {
  inviteId: string;
  actorId: string;
  actorName: string;
  actorStatus: ActorStatus;
  email: string;
  roles: UserRole[];
  expiresAt: Date;
  hasAccount: boolean;
  userId?: string ;
}


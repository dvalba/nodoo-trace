import { ActorStatus } from "../../actor/enums/actor-status.enum.js";
import { UserRole } from "../../users/enums/roles.enum.js";
import { InvitationStatus } from "../entities/invitation.entity.js";

export class InvitedByDto {
  id: string;
  email: string;
}

export class InviteResponseDto {
  id: string;
  
  email: string;
  roles: UserRole[];

  actorName: string;
  actorStatus: ActorStatus;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: InvitedByDto;
  emailSent: boolean;
}
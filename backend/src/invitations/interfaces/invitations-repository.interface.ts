import { QueryRunner } from 'typeorm';
import { CreateInvitationDto } from '../dto/create-invitation.dto.js';
import { Invitation } from '../entities/invitation.entity.js';

export interface InvitationsRepository {
  create(
    dto: CreateInvitationDto,
    queryRunner?: QueryRunner,
  ): Promise<Invitation>;
  findPendingByEmail(email: string, actorId: string): Promise<Invitation | null>;
  findPendingByTokenHash(tokenHash: string): Promise<Invitation | null>;
  findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  reissue(data: CreateInvitationDto, pendingId?: string): Promise<Invitation>;
  markExpired(id: string): Promise<void>;
  markAccepted(id: string, acceptedById: string): Promise<void>;
}
export const InvitationsRepository = Symbol('InvitationsRepository');

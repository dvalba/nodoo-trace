import { DataSource, QueryRunner, Repository } from 'typeorm';
import { CreateInvitationDto } from '../dto/create-invitation.dto.js';
import { Invitation, InvitationStatus } from '../entities/invitation.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { InvitationsRepository } from '../interfaces/invitations-repository.interface.js';
import { handleDbExceptions } from '../../common/helpers/db-exception.helper.js';

@Injectable()
export class TypeOrmInvitationsRepository implements InvitationsRepository {
  constructor(
    @InjectRepository(Invitation)
    private readonly repo: Repository<Invitation>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateInvitationDto,
    queryRunner?: QueryRunner,
  ): Promise<Invitation> {
    const manager = queryRunner ? queryRunner.manager : this.repo.manager;

    try {
      const invitation = manager.create(Invitation, {
        ...dto,
        status: InvitationStatus.Pending,
      });

      return await manager.save(Invitation, invitation);
    } catch (error) {
      handleDbExceptions(error);
    }
  }

  async markExpired(id: string): Promise<void> {
    await this.repo.update(id, { status: InvitationStatus.Expired });
  }

  async markAccepted(id: string, acceptedById: string): Promise<void> {
    await this.repo.update(id, {
      status: InvitationStatus.Accepted,
      acceptedAt: new Date(),
      acceptedById,
    });
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  async findPendingByEmail(
    email: string,
    actorId: string,
  ): Promise<Invitation | null> {
    const invite = await this.repo.findOne({
      where: { email, actorId, status: InvitationStatus.Pending },
    });

    if (!invite) return null;

    if (invite.expiresAt < new Date()) {
      await this.markExpired(invite.id);
      return null;
    }
    return invite;
  }

  async findPendingByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const invite = await this.repo.findOne({
      where: { tokenHash, status: InvitationStatus.Pending },
    });
    if (!invite) return null;

    if (invite.expiresAt < new Date()) {
      await this.markExpired(invite.id);
      return null;
    }
    return invite;
  }

  async reissue(
    dto: CreateInvitationDto,
    pendingId?: string,
  ): Promise<Invitation> {
    return this.dataSource.transaction(async (tx) => {
      if (pendingId) {
        await tx.update(Invitation, pendingId, {
          status: InvitationStatus.Revoked,
        });
      }
      const invitation = tx.create(Invitation, {
        ...dto,
        status: InvitationStatus.Pending,
      });
      return tx.save(invitation);
    });
  }
}


import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service.js';
import { InvitationsController } from './invitations.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invitation } from './entities/invitation.entity.js';
import { InvitationsRepository } from './interfaces/invitations-repository.interface.js';
import { TypeOrmInvitationsRepository } from './repository/type-orm-invitations.repository.js';
import { ActorModule } from '../actor/actor.module.js';
import { EmailSender } from '../common/interfaces/email-sender.js';
import { FileEmailSender } from '../common/providers/file-email-sender.js';
import { TokenService } from '../common/interfaces/token-service.interface.js';
import { HmacTokenService } from '../common/providers/hmac-token.js';
import { UsersModule } from '../users/users.module.js';

// const useMocks = process.env.USE_MOCKS === 'true';

@Module({
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    {
      provide: InvitationsRepository,
      useClass: TypeOrmInvitationsRepository,
      // useClass: useMocks ?  InMemoryInvitationsRepository : TypeOrmInvitationsRepository,
    },
    {
      provide: EmailSender,
      useClass: FileEmailSender
    },
    {
      provide: TokenService,
      useClass: HmacTokenService
    }
  ],
  imports: [TypeOrmModule.forFeature([Invitation]), ActorModule,UsersModule],
  exports: [InvitationsService],
})
export class InvitationsModule {}

import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { UsersModule } from '../users/users.module.js';
import { ActorModule } from '../actor/actor.module.js';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [UsersModule,ActorModule]
})
export class AdminModule {}

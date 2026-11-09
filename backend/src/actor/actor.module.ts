import { Module } from '@nestjs/common';
import { ActorService } from './actor.service.js';
import { ActorController } from './controllers/actor.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actor } from './entities/actor.entity.js';

@Module({
  controllers: [ActorController],
  providers: [ActorService],
  imports: [TypeOrmModule.forFeature([Actor])],
  exports:[ActorService, TypeOrmModule]
})
export class ActorModule {}

import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ActorService } from '../actor.service.js';

@Controller('actor')
export class ActorController {
  constructor(private readonly actorService: ActorService) {}
}

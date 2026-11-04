import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator.js';
import { ActorService } from '../actor.service.js';

@ApiTags('actor')
@Controller('actor')
export class ActorController {
  constructor(private readonly actorService: ActorService) {}

  @Auth()
  @Get(':actorId')
  @ApiOperation({
    summary: 'Get an actor reference',
    description:
      'Returns the actor name and activities for a known actor id.',
  })
  get(@Param('actorId', ParseUUIDPipe) actorId: string) {
    return this.actorService.getReference(actorId);
  }
}

import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator.js';
import { Caller } from '../../auth/decorators/caller.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';
import { NoticesService } from '../notices.service.js';

@ApiTags('notices')
@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Auth()
  @Get(':noticeId')
  @ApiOperation({
    summary: 'Get a product notice',
    description:
      'Returns the notice to the product owner and to the actors related to its targeted EPCs.',
  })
  get(
    @Caller() user: AuthUser,
    @Param('noticeId', ParseUUIDPipe) noticeId: string,
  ) {
    return this.noticesService.getNotice(user.actorId, noticeId);
  }

  @Auth()
  @Post(':noticeId/ack')
  @ApiOperation({
    summary: 'Acknowledge a product notice',
    description:
      'Registers the caller acknowledgement. Repeated calls are idempotent.',
  })
  ack(
    @Caller() user: AuthUser,
    @Param('noticeId', ParseUUIDPipe) noticeId: string,
  ) {
    return this.noticesService.ackNotice(user.actorId, noticeId);
  }

  @Auth()
  @Get(':noticeId/acks')
  @ApiOperation({
    summary: 'List the acknowledgements of a notice',
    description: 'Only the product owner can list the acknowledgements.',
  })
  acks(
    @Caller() user: AuthUser,
    @Param('noticeId', ParseUUIDPipe) noticeId: string,
  ) {
    return this.noticesService.listAcks(user.actorId, noticeId);
  }
}

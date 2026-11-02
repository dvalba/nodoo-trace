import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator.js';
import { Caller } from '../../auth/decorators/caller.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';
import { NoticesService } from '../notices.service.js';
import { CreateNoticeDto } from '../dto/create-notice.dto.js';

@ApiTags('notices')
@Controller('products/:productId/notices')
export class ProductNoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Auth()
  @Post()
  @ApiOperation({
    summary: 'Publish a recall or advisory for a product',
    description:
      'Creates a notice targeting a batch and/or specific EPCs. Only the product owner can publish it.',
  })
  create(
    @Caller() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateNoticeDto,
  ) {
    return this.noticesService.createNotice(user.actorId, productId, dto);
  }

  @Auth()
  @Get()
  @ApiOperation({
    summary: 'List the notices of a product',
    description: 'Only the product owner can list its notices.',
  })
  list(
    @Caller() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.noticesService.listNotices(user.actorId, productId);
  }
}

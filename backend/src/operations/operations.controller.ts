import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OperationsService } from './operations.service.js';
import { Caller } from '../auth/decorators/caller.decorator.js';
import { Auth } from '../auth/decorators/auth.decorator.js';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { UserRole } from '../users/enums/roles.enum.js';
import { SuggestOperationsDto } from './dto/suggest-operations.dto.js';
import { AcceptActivitiesDto } from './dto/accept-activities.dto.js';
import { CreateCustomActivityDto } from './dto/create-custom-activity.dto.js';

@ApiTags('operations')
@Controller('actor/operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Auth(UserRole.OWNER)
  @Get()
  @ApiOperation({
    summary: 'List all operations available for the onboarding checkboxes',
    description:
      'Returns the operation catalog (code, label, group, sortOrder) grouped for the "what does your company do" view. Owner only.',
  })
  list() {
    return this.operationsService.list();
  }

  @Auth(UserRole.OWNER)
  @Post('suggestions')
  @ApiOperation({
    summary: 'Suggest activity type combinations that cover the selected operations',
    description:
      'Given the operations selected by the owner, returns the top 3 builtin activity type combinations (max 3 per combination) that cover all of them, most fitting first. Read-only: nothing is stored.',
  })
  suggest(@Caller() user: AuthUser, @Body() dto: SuggestOperationsDto) {
    return this.operationsService.suggest(user.actorId, dto);
  }

  @Auth(UserRole.OWNER)
  @Post('accept')
  @ApiOperation({
    summary: 'Assign the chosen activity types to the organization',
    description:
      'Validates that the chosen activity types cover all the selected operations and assigns them to the actor. Only allowed once (409 if the organization already has activities).',
  })
  accept(@Caller() user: AuthUser, @Body() dto: AcceptActivitiesDto) {
    return this.operationsService.accept(user.actorId, dto);
  }

  @Auth(UserRole.OWNER)
  @Post('custom')
  @ApiOperation({
    summary: 'Create a custom activity type with exactly the selected operations',
    description:
      'Creates a global custom activity type (owner-provided name) linked to exactly the selected operations and assigns it to the actor. Only allowed once (409 if the organization already has activities).',
  })
  createCustom(
    @Caller() user: AuthUser,
    @Body() dto: CreateCustomActivityDto,
  ) {
    return this.operationsService.createCustom(user.actorId, dto);
  }
}

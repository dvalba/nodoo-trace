import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { Caller } from '../auth/decorators/caller.decorator.js';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { UserRole } from './enums/roles.enum.js';
import { UpdateMemberRolesDto } from './dto/update-member-roles.dto.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Auth()
  @Get()
  @ApiOperation({
    summary: 'List the members of the caller organization',
    description:
      'Returns the users that belong to the caller organization, with their roles and status.',
  })
  list(@Caller() user: AuthUser) {
    return this.usersService.listMembers(user.actorId);
  }

  @Auth(UserRole.OWNER, UserRole.ADMIN)
  @Patch(':userId')
  @ApiOperation({
    summary: 'Add roles to an organization member',
    description:
      'OWNER or ADMIN of the organization. Adds roles to the member (additive only; the owner role cannot be assigned).',
  })
  updateRoles(
    @Caller() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRolesDto,
  ) {
    return this.usersService.addMemberRoles(
      user.actorId,
      userId,
      user.id,
      dto.roles,
    );
  }

  @Auth(UserRole.OWNER, UserRole.ADMIN)
  @Delete(':userId')
  @ApiOperation({
    summary: 'Remove a member from the organization',
    description:
      'OWNER or ADMIN of the organization. The owner and the caller themselves cannot be removed.',
  })
  remove(
    @Caller() user: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.usersService.removeMember(user.actorId, userId, user.id);
  }
}

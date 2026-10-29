import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { AdminService } from './admin.service.js';
import { PlatformRole } from '../users/enums/roles.enum.js';

@ApiTags('admin')
@Auth(PlatformRole.STAFF)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch('actors/:id/approval')
  @ApiOperation({
    summary: 'Approve an organization (actor)',
    description:
      'STAFF only. Approves the actor and activates all its pending (awaiting approval) users. Re-approving an already approved actor is a no-op.',
  })
  @ApiParam({ name: 'id', description: 'Actor (organization) UUID', format: 'uuid' })
  reviewActor(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminService.approveActor(id);
  }
}

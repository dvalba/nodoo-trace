import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { AdminService } from './admin.service.js';
import { PlatformRole } from '../users/enums/roles.enum.js';

@Auth(PlatformRole.STAFF)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Patch('actors/:id/approval')
  reviewActor(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminService.approveActor(id);
  }
}

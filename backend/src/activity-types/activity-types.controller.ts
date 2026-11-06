import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { ActivityTypesService } from './activity-types.service.js';

@ApiTags('activity-types')
@Controller('activity-types')
export class ActivityTypesController {
  constructor(private readonly activityTypesService: ActivityTypesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List the built-in activity types',
    description:
      'Used by the registration form so a new organization can declare what it does in the supply chain.',
  })
  async list() {
    const activities =
      await this.activityTypesService.findBuiltinWithOperations();

    return activities.map((activity) => ({
      code: activity.code,
      name: activity.name,
      description: activity.description,
    }));
  }
}

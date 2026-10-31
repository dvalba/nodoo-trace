import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator.js';
import { Caller } from '../../auth/decorators/caller.decorator.js';
import { RequiresOperation } from '../../auth/decorators/requires-operation.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';
import { EventLedgerService } from '../event-ledger.service.js';
import { CommissionEpcDto } from '../dto/commission-epc.dto.js';

@ApiTags('epcs')
@Controller('epcs')
export class EpcsController {
  constructor(private readonly eventLedgerService: EventLedgerService) {}

  @Auth()
  @RequiresOperation('object:commissioning')
  @Post()
  @ApiOperation({
    summary: 'Commission a new EPC (digital twin)',
    description:
      'Mints a platform EPC id, creates its digital twin and appends the commissioning event to the ledger.',
  })
  commission(@Caller() user: AuthUser, @Body() dto: CommissionEpcDto) {
    return this.eventLedgerService.commission(user.actorId, dto);
  }

  @Auth()
  @Get(':epc')
  @ApiOperation({
    summary: 'Get the EPC digital twin',
    description:
      'Returns the current projection of the EPC. Only its producer, owner or custodian organization can read it.',
  })
  get(@Caller() user: AuthUser, @Param('epc') epc: string) {
    return this.eventLedgerService.getEpc(user.actorId, epc);
  }
}

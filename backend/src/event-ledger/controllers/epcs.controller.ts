import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator.js';
import { Caller } from '../../auth/decorators/caller.decorator.js';
import { RequiresOperation } from '../../auth/decorators/requires-operation.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';
import { EventLedgerService } from '../event-ledger.service.js';
import { EventAction } from '../epics-core/enums/event-action.enum.js';
import { CommissionEpcDto } from '../dto/commission-epc.dto.js';
import { InvoiceEpcDto } from '../dto/invoice-epc.dto.js';
import { AggregateEpcDto } from '../dto/aggregate-epc.dto.js';
import { TransformEpcsDto } from '../dto/transform-epcs.dto.js';

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
  @RequiresOperation('object:receiving')
  @Post(':epc/receive')
  @ApiOperation({
    summary: 'Receive an EPC into custody',
    description:
      'Appends a receiving event and makes the caller the current custodian of the EPC.',
  })
  receive(@Caller() user: AuthUser, @Param('epc') epc: string) {
    return this.eventLedgerService.receive(user.actorId, epc);
  }

  @Auth()
  @RequiresOperation('object:shipping')
  @Post(':epc/ship')
  @ApiOperation({
    summary: 'Ship an EPC',
    description:
      'Appends a shipping event and marks the EPC as in transit.',
  })
  ship(@Caller() user: AuthUser, @Param('epc') epc: string) {
    return this.eventLedgerService.ship(user.actorId, epc);
  }

  @Auth()
  @RequiresOperation('transaction:inv')
  @Post(':epc/invoice')
  @ApiOperation({
    summary: 'Register an invoice for an EPC',
    description:
      'Appends an invoice transaction event and transfers ownership to the caller or to an explicit recipient.',
  })
  invoice(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: InvoiceEpcDto,
  ) {
    return this.eventLedgerService.invoice(user.actorId, epc, dto);
  }

  @Auth()
  @RequiresOperation('aggregation:ADD')
  @Post(':epc/aggregate')
  @ApiOperation({
    summary: 'Add EPCs to a parent container',
    description:
      'Appends an aggregation event and links the child EPCs to the parent EPC.',
  })
  aggregate(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: AggregateEpcDto,
  ) {
    return this.eventLedgerService.aggregate(
      user.actorId,
      epc,
      dto,
      EventAction.ADD,
    );
  }

  @Auth()
  @RequiresOperation('aggregation:DELETE')
  @Post(':epc/disaggregate')
  @ApiOperation({
    summary: 'Remove EPCs from a parent container',
    description:
      'Appends an aggregation event and unlinks the child EPCs from the parent EPC.',
  })
  disaggregate(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: AggregateEpcDto,
  ) {
    return this.eventLedgerService.aggregate(
      user.actorId,
      epc,
      dto,
      EventAction.DELETE,
    );
  }

  @Auth()
  @RequiresOperation('transformation:transforming')
  @Post('transform')
  @ApiOperation({
    summary: 'Transform EPCs into a new product',
    description:
      'Appends a transformation event, consumes the input EPCs and mints the output EPCs of the target product.',
  })
  transform(@Caller() user: AuthUser, @Body() dto: TransformEpcsDto) {
    return this.eventLedgerService.transform(user.actorId, dto);
  }

  @Auth()
  @Get()
  @ApiOperation({
    summary: 'List the EPCs visible to the caller',
    description:
      'Returns the EPCs the caller produced, owns or currently custodies, optionally filtered by product or batch.',
  })
  list(
    @Caller() user: AuthUser,
    @Query('productId') productId?: string,
    @Query('batchId') batchId?: string,
  ) {
    return this.eventLedgerService.listEpc(user.actorId, {
      productId,
      batchId,
    });
  }

  @Auth()
  @Get(':epc/history')
  @ApiOperation({
    summary: 'Get the EPC event history',
    description:
      'Returns the ledger events the EPC took part in, in chronological order. Only its producer, owner or custodian organization can read it.',
  })
  history(@Caller() user: AuthUser, @Param('epc') epc: string) {
    return this.eventLedgerService.getHistory(user.actorId, epc);
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

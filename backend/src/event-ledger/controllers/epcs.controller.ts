import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator.js';
import { Caller } from '../../auth/decorators/caller.decorator.js';
import { RequiresOperation } from '../../auth/decorators/requires-operation.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';
import { EventLedgerService } from '../event-ledger.service.js';
import { BizStep } from '../epics-core/enums/biz-step.enum.js';
import { BizTransactionType } from '../epics-core/enums/biz-transaction-type.enum.js';
import { EventAction } from '../epics-core/enums/event-action.enum.js';
import { CommissionEpcDto } from '../dto/commission-epc.dto.js';
import { InvoiceEpcDto } from '../dto/invoice-epc.dto.js';
import { AggregateEpcDto } from '../dto/aggregate-epc.dto.js';
import { TransformEpcsDto } from '../dto/transform-epcs.dto.js';
import { ShipEpcDto } from '../dto/ship-epc.dto.js';
import { InspectEpcDto } from '../dto/inspect-epc.dto.js';
import { TransactionEpcDto } from '../dto/transaction-epc.dto.js';
import { AssociateEpcDto } from '../dto/associate-epc.dto.js';

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
  @Get('search')
  @ApiOperation({
    summary: 'Search EPCs and catalog items',
    description:
      'Searches by term across EPC ids, SKUs, product names and batch codes. Returns the matching EPCs (cases) and the matching products and batches that have no readable case yet.',
  })
  search(@Caller() user: AuthUser, @Query('q') q?: string) {
    return this.eventLedgerService.search(user.actorId, q ?? '');
  }

  @Auth()
  @RequiresOperation('object:receiving')
  @Post(':epc/receive')
  @ApiOperation({
    summary: 'Receive an EPC into custody',
    description:
      'Appends a receiving event and makes the caller the current custodian of the EPC. Allowed for the owner, the current custodian or the organization the EPC was shipped to.',
  })
  receive(@Caller() user: AuthUser, @Param('epc') epc: string) {
    return this.eventLedgerService.receive(user.actorId, epc);
  }

  @Auth()
  @RequiresOperation('object:shipping')
  @Post(':epc/ship')
  @ApiOperation({
    summary: 'Ship an EPC to another organization',
    description:
      'Appends a shipping event, marks the EPC as in transit and records the destination actor. Only the destination, the owner or the custodian can receive it afterwards.',
  })
  ship(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: ShipEpcDto,
  ) {
    return this.eventLedgerService.ship(user.actorId, epc, dto);
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
  @RequiresOperation('transaction:po')
  @Post(':epc/purchase-order')
  @ApiOperation({
    summary: 'Register a purchase order for an EPC',
    description:
      'Appends a purchase order transaction event. Typically issued by the buyer before the goods are shipped.',
  })
  purchaseOrder(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: TransactionEpcDto,
  ) {
    return this.eventLedgerService.registerBusinessTransaction(
      user.actorId,
      epc,
      BizTransactionType.PO,
      dto,
    );
  }

  @Auth()
  @RequiresOperation('transaction:desadv')
  @Post(':epc/despatch-advice')
  @ApiOperation({
    summary: 'Register a despatch advice for an EPC',
    description:
      'Appends a despatch advice transaction event. Typically issued by the sender when dispatching the goods.',
  })
  despatchAdvice(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: TransactionEpcDto,
  ) {
    return this.eventLedgerService.registerBusinessTransaction(
      user.actorId,
      epc,
      BizTransactionType.DESADV,
      dto,
    );
  }

  @Auth()
  @RequiresOperation('transaction:bol')
  @Post(':epc/bill-of-lading')
  @ApiOperation({
    summary: 'Register a bill of lading for an EPC',
    description:
      'Appends a bill of lading transaction event for the transport of the EPC.',
  })
  billOfLading(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: TransactionEpcDto,
  ) {
    return this.eventLedgerService.registerBusinessTransaction(
      user.actorId,
      epc,
      BizTransactionType.BOL,
      dto,
    );
  }

  @Auth()
  @RequiresOperation('object:inspecting')
  @Post(':epc/inspect')
  @ApiOperation({
    summary: 'Inspect an EPC',
    description:
      'Appends an inspection event. A failed inspection marks the EPC as damaged; a passed inspection restores it to active.',
  })
  inspect(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: InspectEpcDto,
  ) {
    return this.eventLedgerService.inspect(user.actorId, epc, dto);
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
  @RequiresOperation('object:packing')
  @Post(':epc/pack')
  @ApiOperation({
    summary: 'Pack EPCs into a parent unit',
    description:
      'Appends a packing event (aggregation with the packing business step) and links the child EPCs to the parent EPC.',
  })
  pack(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: AggregateEpcDto,
  ) {
    return this.eventLedgerService.aggregate(
      user.actorId,
      epc,
      dto,
      EventAction.ADD,
      BizStep.PACKING,
    );
  }

  @Auth()
  @RequiresOperation('object:unpacking')
  @Post(':epc/unpack')
  @ApiOperation({
    summary: 'Unpack a parent unit',
    description:
      'Appends an unpacking event (aggregation removal with the unpacking business step) and unlinks the child EPCs from the parent EPC.',
  })
  unpack(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: AggregateEpcDto,
  ) {
    return this.eventLedgerService.aggregate(
      user.actorId,
      epc,
      dto,
      EventAction.DELETE,
      BizStep.UNPACKING,
    );
  }

  @Auth()
  @RequiresOperation('association:ADD')
  @Post(':epc/associate')
  @ApiOperation({
    summary: 'Associate related EPCs (certificates, warranties, …)',
    description:
      'Appends an association event linking the related EPCs to the main EPC.',
  })
  associate(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: AssociateEpcDto,
  ) {
    return this.eventLedgerService.associate(user.actorId, epc, dto);
  }

  @Auth()
  @RequiresOperation('association:DELETE')
  @Post(':epc/disassociate')
  @ApiOperation({
    summary: 'Disassociate related EPCs',
    description:
      'Appends a disassociation event unlinking the related EPCs from the main EPC.',
  })
  disassociate(
    @Caller() user: AuthUser,
    @Param('epc') epc: string,
    @Body() dto: AssociateEpcDto,
  ) {
    return this.eventLedgerService.disassociate(user.actorId, epc, dto);
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
      'Returns the EPCs the caller produced, owns, custodies or is the destination of, optionally filtered by product, batch or a free-text search on EPC id, SKU, product name or batch code.',
  })
  list(
    @Caller() user: AuthUser,
    @Query('productId') productId?: string,
    @Query('batchId') batchId?: string,
    @Query('q') q?: string,
  ) {
    return this.eventLedgerService.listEpc(user.actorId, {
      productId,
      batchId,
      q,
    });
  }

  @Auth()
  @Get(':epc/history')
  @ApiOperation({
    summary: 'Get the EPC event history',
    description:
      'Returns the ledger events the EPC took part in, in chronological order. Producers, owners, custodians and destinations get the full history; any other custodian in transit only gets their custody window.',
  })
  history(@Caller() user: AuthUser, @Param('epc') epc: string) {
    return this.eventLedgerService.getHistory(user.actorId, epc);
  }

  @Auth()
  @Get(':epc')
  @ApiOperation({
    summary: 'Get the EPC digital twin',
    description:
      'Returns the current projection of the EPC. Only its producer, owner, custodian or destination organization can read it.',
  })
  get(@Caller() user: AuthUser, @Param('epc') epc: string) {
    return this.eventLedgerService.getEpc(user.actorId, epc);
  }
}

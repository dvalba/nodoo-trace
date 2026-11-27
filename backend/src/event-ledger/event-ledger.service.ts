import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { throwNotFound } from '../common/helpers/crud-exceptions.helper.js';
import { Actor } from '../actor/entities/actor.entity.js';
import { ActorStatus } from '../actor/enums/actor-status.enum.js';
import { ProductsService } from '../products/products.service.js';
import { Batch } from '../products/entities/batch.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { BizStep } from './epics-core/enums/biz-step.enum.js';
import { BizTransactionType } from './epics-core/enums/biz-transaction-type.enum.js';
import { EpcStatus } from './epics-core/enums/epc-status.enum.js';
import { EventAction } from './epics-core/enums/event-action.enum.js';
import { EventType } from './epics-core/enums/event-type.enum.js';
import { EventEpcRole } from './enums/event-epc-role.enum.js';
import { Epc } from './entities/epc.entity.js';
import { EventEpc } from './entities/event-epc.entity.js';
import { LedgerEvent } from './entities/ledger-event.entity.js';
import { CommissionEpcDto } from './dto/commission-epc.dto.js';
import { InvoiceEpcDto } from './dto/invoice-epc.dto.js';
import { AggregateEpcDto } from './dto/aggregate-epc.dto.js';
import { TransformEpcsDto } from './dto/transform-epcs.dto.js';
import { ShipEpcDto } from './dto/ship-epc.dto.js';
import { InspectEpcDto } from './dto/inspect-epc.dto.js';
import { TransactionEpcDto } from './dto/transaction-epc.dto.js';
import { AssociateEpcDto } from './dto/associate-epc.dto.js';
import type { EpcView } from './dto/epc-view.type.js';
import {
  TwinProjector,
  type ProjectableLink,
  type TwinMutation,
} from './twin-projector.js';

const EPC_URN_PREFIX = 'urn:nodoo:epc:';

/**
 * FR-604 scope of an EPC row for the caller: the EPCs it owns, the ones it
 * custodies, and the in-transit cases addressed to it — minus the EPCs it
 * produced but is no longer the owner of (FR-D6: a producer that is no
 * longer the owner sees nothing, even if it still custodies the case).
 */
const EPC_SCOPE_CLAUSE =
  '((epc.ownerActorId = :actorId OR epc.custodianActorId = :actorId OR (epc.destinationActorId = :actorId AND epc.status = :inTransit))' +
  ' AND NOT (epc.producerActorId = :actorId AND epc.ownerActorId <> :actorId))';

function custodyTarget(
  payload: Record<string, unknown>,
): string | undefined {
  const transfer = payload.custodyTransfer;

  if (
    typeof transfer !== 'object' ||
    transfer === null ||
    Array.isArray(transfer)
  ) {
    return undefined;
  }

  const to = (transfer as Record<string, unknown>).to;

  return typeof to === 'string' ? to : undefined;
}

interface EventDraft {
  type: EventType;
  bizStep: BizStep | null;
  bizTransactionType: string | null;
  bizTransactionId: string | null;
  actorId: string;
  batchId: string | null;
  disposition: EpcStatus | null;
  payload: Record<string, unknown>;
}

interface AppendOptions {
  draft: EventDraft;
  links: ProjectableLink[];
  reloadIds: string[];
}

export interface EpcHistoryEntry {
  role: EventEpcRole;
  id: string;
  type: EventType;
  eventTime: Date;
  recordedAt: Date;
  actorId: string;
  batchId: string | null;
  readPointId: string | null;
  bizStep: BizStep | null;
  bizTransactionType: string | null;
  bizTransactionId: string | null;
  disposition: EpcStatus | null;
  source: string;
  eventUid: string | null;
  payload: Record<string, unknown>;
  epcs: { id: string; role: EventEpcRole }[];
}

export interface EpcSearchResult {
  cases: EpcView[];
  items: { product: Product; batches: Batch[] }[];
}

@Injectable()
export class EventLedgerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly projector: TwinProjector,
    @InjectRepository(Epc)
    private readonly epcRepo: Repository<Epc>,
    @InjectRepository(Batch)
    private readonly batchRepo: Repository<Batch>,
    @InjectRepository(EventEpc)
    private readonly eventEpcRepo: Repository<EventEpc>,
    @InjectRepository(Actor)
    private readonly actorRepo: Repository<Actor>,
  ) {}

  async commission(actorId: string, dto: CommissionEpcDto): Promise<Epc> {
    const product = await this.productsService.getProduct(
      actorId,
      dto.productId,
    );

    if (dto.batchId) {
      const batch = await this.batchRepo.findOneBy({
        id: dto.batchId,
        productId: product.id,
      });
      if (!batch) throwNotFound('Batch', dto.batchId);
    }

    return this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const epcId = this.mintEpcId();
      const batchId = dto.batchId ?? null;

      await manager.save(
        manager.create(Epc, {
          id: epcId,
          productId: product.id,
          batchId,
          parentId: null,
          producerActorId: actorId,
          ownerActorId: actorId,
          custodianActorId: actorId,
          status: EpcStatus.ACTIVE,
        }),
      );

      const event = await manager.save(
        manager.create(LedgerEvent, {
          type: EventType.OBJECT,
          eventTime: now,
          actorId,
          batchId,
          readPointId: null,
          bizStep: BizStep.COMMISSIONING,
          bizTransactionType: null,
          bizTransactionId: null,
          disposition: EpcStatus.ACTIVE,
          source: 'platform',
          eventUid: randomUUID(),
          payload: {
            type: EventType.OBJECT,
            bizStep: BizStep.COMMISSIONING,
            disposition: EpcStatus.ACTIVE,
            action: EventAction.ADD,
            epcList: [epcId],
            productId: product.id,
            batchId,
            readPointId: null,
            actorId,
            eventTime: now.toISOString(),
          },
        }),
      );

      await manager.save(
        manager.create(EventEpc, {
          eventId: event.id,
          epcId,
          role: EventEpcRole.OBSERVED,
        }),
      );

      const created = await manager.findOneBy(Epc, { id: epcId });
      if (!created) throwNotFound('Epc', epcId);

      return created;
    });
  }

  async receive(actorId: string, epcId: string): Promise<Epc> {
    return this.dataSource.transaction(async (manager) => {
      const epc = await this.findReceivableEpc(manager, actorId, epcId);

      const [updated] = await this.append(manager, {
        draft: {
          type: EventType.OBJECT,
          bizStep: BizStep.RECEIVING,
          bizTransactionType: null,
          bizTransactionId: null,
          actorId,
          batchId: epc.batchId,
          disposition: EpcStatus.ACTIVE,
          payload: {
            type: EventType.OBJECT,
            bizStep: BizStep.RECEIVING,
            disposition: EpcStatus.ACTIVE,
            action: EventAction.OBSERVE,
            epcList: [epcId],
            batchId: epc.batchId,
            readPointId: null,
            actorId,
          },
        },
        links: [{ epcId, role: EventEpcRole.OBSERVED }],
        reloadIds: [epcId],
      });

      return updated;
    });
  }

  async ship(actorId: string, epcId: string, dto: ShipEpcDto): Promise<Epc> {
    const destination = await this.actorRepo.findOneBy({
      id: dto.destinationActorId,
      status: ActorStatus.APPROVED,
    });

    if (!destination) {
      throw new BadRequestException(
        'The destination actor must be an approved organization.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const [epc] = await this.findCustodiedEpcs(manager, actorId, [epcId]);

      // Edge case (spec l.174): shipping a case already in transit -> 400.
      if (epc.status === EpcStatus.IN_TRANSIT) {
        throw new BadRequestException(
          'The EPC is already in transit and cannot be shipped again.',
        );
      }

      const [updated] = await this.append(manager, {
        draft: {
          type: EventType.OBJECT,
          bizStep: BizStep.SHIPPING,
          bizTransactionType: null,
          bizTransactionId: null,
          actorId,
          batchId: epc.batchId,
          disposition: EpcStatus.IN_TRANSIT,
          payload: {
            type: EventType.OBJECT,
            bizStep: BizStep.SHIPPING,
            disposition: EpcStatus.IN_TRANSIT,
            action: EventAction.OBSERVE,
            epcList: [epcId],
            batchId: epc.batchId,
            readPointId: null,
            actorId,
            destinationActorId: destination.id,
          },
        },
        links: [{ epcId, role: EventEpcRole.OBSERVED }],
        reloadIds: [epcId],
      });

      return updated;
    });
  }

  async invoice(
    actorId: string,
    epcId: string,
    dto: InvoiceEpcDto,
  ): Promise<Epc> {
    return this.dataSource.transaction(async (manager) => {
      const epc = await manager.findOne(Epc, {
        where: { id: epcId, ownerActorId: actorId },
      });
      if (!epc) throwNotFound('Epc', epcId);

      const ownershipTransfer = dto.ownershipTransferTo
        ? { to: dto.ownershipTransferTo }
        : undefined;

      const [updated] = await this.append(manager, {
        draft: {
          type: EventType.TRANSACTION,
          bizStep: null,
          bizTransactionType: BizTransactionType.INV,
          bizTransactionId: dto.bizTransactionId,
          actorId,
          batchId: epc.batchId,
          disposition: null,
          payload: {
            type: EventType.TRANSACTION,
            bizTransactionType: BizTransactionType.INV,
            bizTransactionId: dto.bizTransactionId,
            epcList: [epcId],
            batchId: epc.batchId,
            readPointId: null,
            actorId,
            ...(ownershipTransfer ? { ownershipTransfer } : {}),
          },
        },
        links: [{ epcId, role: EventEpcRole.OBSERVED }],
        reloadIds: [epcId],
      });

      return updated;
    });
  }

  async registerBusinessTransaction(
    actorId: string,
    epcId: string,
    bizTransactionType: BizTransactionType,
    dto: TransactionEpcDto,
  ): Promise<Epc> {
    return this.dataSource.transaction(async (manager) => {
      const epc = await this.findReadableEpc(manager, actorId, epcId);

      // FR-701: issuer role of each business document. A purchase order is
      // issued by a non-owner (the buyer); a despatch advice and a bill of
      // lading are issued by the current custodian.
      if (bizTransactionType === BizTransactionType.PO) {
        if (epc.ownerActorId === actorId) {
          throw new BadRequestException(
            'A purchase order cannot be issued by the owner of the EPC.',
          );
        }
      } else if (epc.custodianActorId !== actorId) {
        throw new BadRequestException(
          'A despatch advice or bill of lading can only be issued by the current custodian of the EPC.',
        );
      }

      const [updated] = await this.append(manager, {
        draft: {
          type: EventType.TRANSACTION,
          bizStep: null,
          bizTransactionType,
          bizTransactionId: dto.bizTransactionId,
          actorId,
          batchId: epc.batchId,
          disposition: null,
          payload: {
            type: EventType.TRANSACTION,
            bizTransactionType,
            bizTransactionId: dto.bizTransactionId,
            epcList: [epcId],
            batchId: epc.batchId,
            readPointId: null,
            actorId,
          },
        },
        links: [{ epcId, role: EventEpcRole.OBSERVED }],
        reloadIds: [epcId],
      });

      return updated;
    });
  }

  async inspect(
    actorId: string,
    epcId: string,
    dto: InspectEpcDto,
  ): Promise<Epc> {
    const status =
      dto.result === 'failed' ? EpcStatus.DAMAGED : EpcStatus.ACTIVE;

    return this.dataSource.transaction(async (manager) => {
      const [epc] = await this.findCustodiedEpcs(manager, actorId, [epcId]);

      const [updated] = await this.append(manager, {
        draft: {
          type: EventType.OBJECT,
          bizStep: BizStep.INSPECTING,
          bizTransactionType: null,
          bizTransactionId: null,
          actorId,
          batchId: epc.batchId,
          disposition: status,
          payload: {
            type: EventType.OBJECT,
            bizStep: BizStep.INSPECTING,
            disposition: status,
            action: EventAction.OBSERVE,
            epcList: [epcId],
            batchId: epc.batchId,
            readPointId: null,
            actorId,
            result: dto.result,
          },
        },
        links: [{ epcId, role: EventEpcRole.OBSERVED }],
        reloadIds: [epcId],
      });

      return updated;
    });
  }

  async aggregate(
    actorId: string,
    parentId: string,
    dto: AggregateEpcDto,
    action: EventAction.ADD | EventAction.DELETE,
    bizStep: BizStep | null = null,
  ): Promise<Epc[]> {
    const childIds = [...new Set(dto.childEpcs)];

    if (childIds.includes(parentId)) {
      throw new BadRequestException('An EPC cannot be its own child.');
    }

    return this.dataSource.transaction(async (manager) => {
      const epcs = await this.findCustodiedEpcs(manager, actorId, [
        parentId,
        ...childIds,
      ]);

      if (new Set(epcs.map((epc) => epc.productId)).size > 1) {
        throw new BadRequestException(
          'Parent and child EPCs must belong to the same product.',
        );
      }

      if (action === EventAction.ADD) {
        // FR-803: adding must never create a descent. The parent chain is a
        // simple chain (one parentId per EPC), so an EPC is a descendant of
        // another when walking the parent links from it reaches the other.
        const parentAncestors = await this.ancestorIds(manager, parentId);
        for (const childId of childIds) {
          if (parentAncestors.has(childId)) {
            throw new BadRequestException(
              'The parent is a descendant of this child; adding it would create a cycle in the aggregation.',
            );
          }
        }

        for (const childId of childIds) {
          const childAncestors = await this.ancestorIds(manager, childId);
          if (childAncestors.has(parentId)) {
            throw new BadRequestException(
              'This EPC is already a descendant of the parent and cannot be added again.',
            );
          }
        }
      }

      return this.append(manager, {
        draft: {
          type: EventType.AGGREGATION,
          bizStep,
          bizTransactionType: null,
          bizTransactionId: null,
          actorId,
          batchId: null,
          disposition: null,
          payload: {
            type: EventType.AGGREGATION,
            ...(bizStep ? { bizStep } : {}),
            action,
            parentID: parentId,
            childEPCs: childIds,
            batchId: null,
            readPointId: null,
            actorId,
          },
        },
        links: [
          { epcId: parentId, role: EventEpcRole.PARENT },
          ...childIds.map((epcId) => ({
            epcId,
            role: EventEpcRole.CHILD,
          })),
        ],
        reloadIds: childIds,
      });
    });
  }

  async associate(
    actorId: string,
    epcId: string,
    dto: AssociateEpcDto,
  ): Promise<Epc> {
    return this.applyAssociation(actorId, epcId, dto, EventAction.ADD);
  }

  async disassociate(
    actorId: string,
    epcId: string,
    dto: AssociateEpcDto,
  ): Promise<Epc> {
    return this.applyAssociation(actorId, epcId, dto, EventAction.DELETE);
  }

  async transform(actorId: string, dto: TransformEpcsDto): Promise<Epc[]> {
    const inputIds = [...new Set(dto.inputEpcs)];

    await this.productsService.getProduct(actorId, dto.outputProductId);

    if (dto.outputBatchId) {
      const batch = await this.batchRepo.findOneBy({
        id: dto.outputBatchId,
        productId: dto.outputProductId,
      });
      if (!batch) throwNotFound('Batch', dto.outputBatchId);
    }

    return this.dataSource.transaction(async (manager) => {
      await this.findCustodiedEpcs(manager, actorId, inputIds);

      const outputIds = Array.from({ length: dto.outputCount ?? 1 }, () =>
        this.mintEpcId(),
      );
      const batchId = dto.outputBatchId ?? null;

      return this.append(manager, {
        draft: {
          type: EventType.TRANSFORMATION,
          bizStep: BizStep.TRANSFORMING,
          bizTransactionType: null,
          bizTransactionId: null,
          actorId,
          batchId,
          disposition: null,
          payload: {
            type: EventType.TRANSFORMATION,
            bizStep: BizStep.TRANSFORMING,
            action: EventAction.ADD,
            inputEPCList: inputIds,
            outputEPCList: outputIds,
            outputProductId: dto.outputProductId,
            outputBatchId: batchId,
            batchId,
            readPointId: null,
            actorId,
          },
        },
        links: [
          ...inputIds.map((epcId) => ({
            epcId,
            role: EventEpcRole.INPUT,
          })),
          ...outputIds.map((epcId) => ({
            epcId,
            role: EventEpcRole.OUTPUT,
          })),
        ],
        reloadIds: outputIds,
      });
    });
  }

  async listEpc(
    actorId: string,
    filter: { productId?: string; batchId?: string; q?: string } = {},
  ): Promise<EpcView[]> {
    const query = this.epcRepo
      .createQueryBuilder('epc')
      .innerJoinAndSelect('epc.product', 'product')
      .leftJoinAndSelect('epc.batch', 'batch')
      // FR-604: the caller sees the EPCs of their scope only.
      .where(EPC_SCOPE_CLAUSE, {
        actorId,
        inTransit: EpcStatus.IN_TRANSIT,
      });

    if (filter.productId) {
      query.andWhere('epc.productId = :productId', {
        productId: filter.productId,
      });
    }

    if (filter.batchId) {
      query.andWhere('epc.batchId = :batchId', { batchId: filter.batchId });
    }

    const term = filter.q?.trim();
    if (term) {
      query.andWhere(
        '(epc.id ILIKE :pattern OR product.sku ILIKE :pattern OR product.name ILIKE :pattern OR batch.batchCode ILIKE :pattern)',
        { pattern: `%${term}%` },
      );
    }

    const rows = await query.orderBy('epc.commissionedAt', 'DESC').getMany();

    // FR-605: the twin is filtered by scope in the list as well — a
    // custodian row never exposes the producer, a destination row exposes
    // only the EPC and its product.
    return rows
      .map((row) => this.scopedView(row, actorId))
      .filter((view): view is EpcView => view !== null);
  }

  async search(actorId: string, q: string): Promise<EpcSearchResult> {
    const term = q.trim();

    if (!term) {
      return { cases: [], items: [] };
    }

    const cases = await this.listEpc(actorId, { q: term });

    const rows = await this.epcRepo
      .createQueryBuilder('epc')
      // Same scope as listEpc (FR-604), used to tell which catalog items
      // already have a readable case.
      .where(EPC_SCOPE_CLAUSE, { actorId, inTransit: EpcStatus.IN_TRANSIT })
      .select('epc.productId', 'productId')
      .addSelect('epc.batchId', 'batchId')
      .getRawMany<{ productId: string; batchId: string | null }>();

    const readableProductIds = new Set(
      rows
        .map((row) => row.productId)
        .filter((value): value is string => Boolean(value)),
    );
    const readableBatchIds = new Set(
      rows
        .map((row) => row.batchId)
        .filter((value): value is string => Boolean(value)),
    );

    const [products, batches] = await Promise.all([
      this.productsService.searchProducts(actorId, term),
      this.productsService.searchBatches(actorId, term),
    ]);

    const items = new Map<string, { product: Product; batches: Batch[] }>();

    for (const product of products) {
      if (!readableProductIds.has(product.id)) {
        items.set(product.id, { product, batches: [] });
      }
    }

    for (const batch of batches) {
      if (readableBatchIds.has(batch.id)) continue;

      const product =
        batch.product ??
        (await this.productsService.findProductById(batch.productId));
      const item = items.get(product.id) ?? { product, batches: [] };
      item.batches.push(batch);
      items.set(product.id, item);
    }

    return { cases, items: [...items.values()] };
  }

  async getEpc(actorId: string, epcId: string): Promise<EpcView> {
    const epc = await this.epcRepo.findOne({
      where: { id: epcId },
      relations: { product: true, batch: true },
    });

    if (!epc) throwNotFound('Epc', epcId);

    const view = this.scopedView(epc, actorId);
    if (!view) {
      // FR-D2/FR-D6: no readable scope (producer no longer the owner, or
      // unrelated organization) -> 404, never 403.
      throwNotFound('Epc', epcId);
    }

    return view;
  }

  async getHistory(
    actorId: string,
    epcId: string,
  ): Promise<EpcHistoryEntry[]> {
    const epc = await this.epcRepo.findOne({ where: { id: epcId } });
    if (!epc) throwNotFound('Epc', epcId);

    const scope = this.twinScope(epc, actorId);

    if (scope === 'full') {
      // FR-606: the owner gets the entire chain.
      return this.readHistory(epcId);
    }

    if (scope === 'destination') {
      // FR-606: the destination of an in-transit case gets 404 until it
      // receives (after receiving, it becomes the custodian of its window).
      throwNotFound('Epc', epcId);
    }

    if (scope === 'none' && epc.producerActorId === actorId) {
      // FR-D6: a producer that is no longer the owner sees nothing about
      // the EPC, even though the commissioning gave it a first custody
      // window in the ledger.
      throwNotFound('Epc', epcId);
    }

    // 'custody' (current custodian) or 'none' with a past window (former
    // custodian): FR-D4/FR-606 give only the events of the actor's own
    // custody window, never the upstream chain. An unrelated organization
    // has no window and gets 404 (FR-D2).
    const history = await this.readHistory(epcId);
    const window = this.custodianWindow(history, actorId);
    if (window.length === 0) throwNotFound('Epc', epcId);

    return window;
  }

  private async applyAssociation(
    actorId: string,
    epcId: string,
    dto: AssociateEpcDto,
    action: EventAction.ADD | EventAction.DELETE,
  ): Promise<Epc> {
    const relatedIds = [...new Set(dto.relatedEpcs)];

    return this.dataSource.transaction(async (manager) => {
      const [target] = await this.findCustodiedEpcs(manager, actorId, [epcId]);

      const related = await manager.find(Epc, {
        where: { id: In(relatedIds) },
      });
      const relatedById = new Map(related.map((epc) => [epc.id, epc]));

      for (const id of relatedIds) {
        const epc = relatedById.get(id);
        if (!epc || !this.canRead(epc, actorId)) throwNotFound('Epc', id);
      }

      const [updated] = await this.append(manager, {
        draft: {
          type: EventType.ASSOCIATION,
          bizStep: null,
          bizTransactionType: null,
          bizTransactionId: null,
          actorId,
          batchId: target.batchId,
          disposition: null,
          payload: {
            type: EventType.ASSOCIATION,
            action,
            epcList: [epcId],
            associatedEPCs: relatedIds,
            readPointId: null,
            actorId,
          },
        },
        links: [
          { epcId, role: EventEpcRole.OBSERVED },
          ...relatedIds.map((id) => ({
            epcId: id,
            role: EventEpcRole.ASSOCIATED,
          })),
        ],
        reloadIds: [epcId],
      });

      return updated;
    });
  }

  private async readHistory(epcId: string): Promise<EpcHistoryEntry[]> {
    const links = await this.eventEpcRepo
      .createQueryBuilder('link')
      .innerJoinAndSelect('link.event', 'event')
      .where('link.epcId = :epcId', { epcId })
      .orderBy('event.eventTime', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .getMany();

    const eventIds = [...new Set(links.map((link) => link.eventId))];

    if (eventIds.length === 0) return [];

    const allLinks = await this.eventEpcRepo
      .createQueryBuilder('link')
      .where('link.eventId IN (:...eventIds)', { eventIds })
      .getMany();

    const epcsByEvent = new Map<string, { id: string; role: EventEpcRole }[]>();
    for (const link of allLinks) {
      const list = epcsByEvent.get(link.eventId) ?? [];
      list.push({ id: link.epcId, role: link.role });
      epcsByEvent.set(link.eventId, list);
    }

    return links.map((link) => ({
      ...this.toHistoryEntry(link),
      epcs: epcsByEvent.get(link.eventId) ?? [{ id: link.epcId, role: link.role }],
    }));
  }

  private custodianWindow(
    history: EpcHistoryEntry[],
    actorId: string,
  ): EpcHistoryEntry[] {
    let custodian: string | null = null;
    const window: EpcHistoryEntry[] = [];

    for (const entry of history) {
      const before: string | null = custodian;
      custodian = this.custodianAfter(entry, custodian);

      if (before === actorId || custodian === actorId) {
        window.push(entry);
      }
    }

    return window;
  }

  private custodianAfter(
    entry: EpcHistoryEntry,
    current: string | null,
  ): string | null {
    const mintedHere =
      (entry.role === EventEpcRole.OBSERVED &&
        entry.bizStep === BizStep.COMMISSIONING) ||
      (entry.role === EventEpcRole.OUTPUT &&
        entry.type === EventType.TRANSFORMATION);

    let custodian = mintedHere ? entry.actorId : current;

    if (entry.bizStep === BizStep.RECEIVING) {
      custodian = entry.actorId;
    }

    return custodyTarget(entry.payload) ?? custodian;
  }

  private toHistoryEntry(link: EventEpc): EpcHistoryEntry {
    const event = link.event;

    return {
      role: link.role,
      id: event.id,
      type: event.type,
      eventTime: event.eventTime,
      recordedAt: event.recordedAt,
      actorId: event.actorId,
      batchId: event.batchId,
      readPointId: event.readPointId,
      bizStep: event.bizStep,
      bizTransactionType: event.bizTransactionType,
      bizTransactionId: event.bizTransactionId,
      disposition: event.disposition,
      source: event.source,
      eventUid: event.eventUid,
      payload: event.payload,
      epcs: [{ id: link.epcId, role: link.role }],
    };
  }

  private async append(
    manager: EntityManager,
    options: AppendOptions,
  ): Promise<Epc[]> {
    const eventTime = new Date();
    const payload = {
      ...options.draft.payload,
      eventTime: eventTime.toISOString(),
    };

    const event = await manager.save(
      manager.create(LedgerEvent, {
        type: options.draft.type,
        eventTime,
        actorId: options.draft.actorId,
        batchId: options.draft.batchId,
        readPointId: null,
        bizStep: options.draft.bizStep,
        bizTransactionType: options.draft.bizTransactionType,
        bizTransactionId: options.draft.bizTransactionId,
        disposition: options.draft.disposition,
        source: 'platform',
        eventUid: randomUUID(),
        payload,
      }),
    );

    const mutations = this.projector.project(
      {
        type: options.draft.type,
        bizStep: options.draft.bizStep,
        bizTransactionType: options.draft.bizTransactionType,
        disposition: options.draft.disposition,
        actorId: options.draft.actorId,
        batchId: options.draft.batchId,
        eventTime,
        payload,
      },
      options.links,
    );

    await this.applyMutations(manager, mutations);

    await manager.save(
      options.links.map((link) =>
        manager.create(EventEpc, {
          eventId: event.id,
          epcId: link.epcId,
          role: link.role,
        }),
      ),
    );

    return manager.find(Epc, {
      where: { id: In(options.reloadIds) },
      relations: { product: true, batch: true },
    });
  }

  /**
   * Applies twin mutations from a projector. Public so external ingestion
   * (US15, FR-2004) projects imported events with the exact same rules as
   * local ones; callers must drop `create` mutations for EPCs that already
   * exist (see `dropCreateMutationsForExisting`).
   */
  public async applyMutations(
    manager: EntityManager,
    mutations: TwinMutation[],
  ): Promise<void> {
    for (const mutation of mutations) {
      if (mutation.create) {
        await this.createTwin(manager, mutation);
      } else {
        await this.updateTwin(manager, mutation);
      }
    }
  }

  private async createTwin(
    manager: EntityManager,
    mutation: TwinMutation,
  ): Promise<void> {
    if (!mutation.productId || !mutation.producerActorId) {
      throw new InternalServerErrorException(
        'Incomplete twin mutation for creation.',
      );
    }

    const epc = manager.create(Epc, {
      id: mutation.id,
      productId: mutation.productId,
      batchId: mutation.batchId ?? null,
      parentId: mutation.parentId ?? null,
      producerActorId: mutation.producerActorId,
      ownerActorId: mutation.ownerActorId ?? null,
      custodianActorId: mutation.custodianActorId ?? null,
      status: mutation.status ?? EpcStatus.ACTIVE,
    });

    if (mutation.commissionedAt) {
      epc.commissionedAt = mutation.commissionedAt;
    }

    await manager.save(epc);
  }

  private async updateTwin(
    manager: EntityManager,
    mutation: TwinMutation,
  ): Promise<void> {
    const patch: Partial<Epc> = {};

    if (mutation.batchId !== undefined) patch.batchId = mutation.batchId;
    if (mutation.parentId !== undefined) patch.parentId = mutation.parentId;
    if (mutation.ownerActorId !== undefined) {
      patch.ownerActorId = mutation.ownerActorId;
    }
    if (mutation.custodianActorId !== undefined) {
      patch.custodianActorId = mutation.custodianActorId;
    }
    if (mutation.destinationActorId !== undefined) {
      patch.destinationActorId = mutation.destinationActorId;
    }
    if (mutation.status !== undefined) patch.status = mutation.status;

    if (Object.keys(patch).length === 0) return;

    await manager.update(Epc, { id: mutation.id }, patch);
  }

  private async findReceivableEpc(
    manager: EntityManager,
    actorId: string,
    epcId: string,
  ): Promise<Epc> {
    const epc = await manager.findOne(Epc, { where: { id: epcId } });

    if (!epc) throwNotFound('Epc', epcId);

    // FR-D2: an organization with no relation to the EPC gets 404.
    const hasRelation =
      epc.ownerActorId === actorId ||
      epc.custodianActorId === actorId ||
      epc.producerActorId === actorId ||
      epc.destinationActorId === actorId;

    if (!hasRelation) throwNotFound('Epc', epcId);

    // FR-602: only the destination of an in-transit case can receive it.
    // Edge cases (spec l.173): receiving a case without a destination or
    // one already received -> 400.
    if (
      epc.destinationActorId !== actorId ||
      epc.status !== EpcStatus.IN_TRANSIT
    ) {
      throw new BadRequestException(
        'The EPC is not in transit to the caller and cannot be received.',
      );
    }

    return epc;
  }

  private async findReadableEpc(
    manager: EntityManager,
    actorId: string,
    epcId: string,
  ): Promise<Epc> {
    const epc = await manager.findOne(Epc, { where: { id: epcId } });

    if (!epc || !this.canRead(epc, actorId)) throwNotFound('Epc', epcId);

    return epc;
  }

  private async findCustodiedEpcs(
    manager: EntityManager,
    actorId: string,
    epcIds: string[],
  ): Promise<Epc[]> {
    const ids = [...new Set(epcIds)];
    const epcs = await manager.find(Epc, {
      where: { id: In(ids), custodianActorId: actorId },
    });

    if (epcs.length !== ids.length) {
      const found = new Set(epcs.map((epc) => epc.id));
      const missing = ids.find((id) => !found.has(id));
      throwNotFound('Epc', missing);
    }

    return epcs;
  }

  /**
   * Ids of the parent chain above an EPC (excluding the EPC itself),
   * following the single `parentId` link. Bounded by a `seen` guard in case
   * the ledger contains a cycle created before the descent check existed.
   */
  private async ancestorIds(
    manager: EntityManager,
    startId: string,
  ): Promise<Set<string>> {
    const ancestors = new Set<string>();
    const seen = new Set<string>();
    let cursor = startId;

    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const row = await manager.findOne(Epc, {
        where: { id: cursor },
        select: { id: true, parentId: true },
      });
      if (!row || !row.parentId) break;
      ancestors.add(row.parentId);
      cursor = row.parentId;
    }

    return ancestors;
  }

  private mintEpcId(): string {
    return `${EPC_URN_PREFIX}${randomUUID()}`;
  }

  /**
   * Visibility scope of an EPC's digital twin for an actor (FR-D2..FR-D6,
   * FR-604/FR-605):
   *
   * - 'full': the owner reads the twin and the whole history.
   * - 'custody': the current custodian reads the twin without the producer
   *   and the history limited to its custody window.
   * - 'destination': the destination of an in-transit case reads only the
   *   EPC + product; the history stays 404 until it receives.
   * - 'none': everything else, including a producer that is no longer the
   *   owner (FR-D6) and unrelated organizations (404 per FR-D2).
   *
   * A former custodian (not the producer) resolves to 'none' here but is
   * served its custody window by getHistory.
   */
  private twinScope(
    epc: Epc,
    actorId: string,
  ): 'full' | 'custody' | 'destination' | 'none' {
    if (epc.ownerActorId === actorId) return 'full';
    if (epc.producerActorId === actorId) return 'none';
    if (epc.custodianActorId === actorId) return 'custody';
    if (
      epc.destinationActorId === actorId &&
      epc.status === EpcStatus.IN_TRANSIT
    ) {
      return 'destination';
    }
    return 'none';
  }

  /**
   * The digital twin of an EPC as seen by a given actor (FR-605), or null
   * when the actor has no readable scope for it (404 per FR-D2/FR-D6).
   */
  private scopedView(epc: Epc, actorId: string): EpcView | null {
    switch (this.twinScope(epc, actorId)) {
      case 'full':
        return epc;
      case 'custody':
        // FR-605/FR-D4: the custodian sees the twin without the producer or
        // any upstream reference; the owner identity is kept (FR-D4).
        return { ...epc, producerActorId: null };
      case 'destination':
        // FR-605/FR-D5: the destination of an in-transit case sees only the
        // EPC and its product (plus the transit state that makes it a
        // shipment addressed to them).
        return {
          ...epc,
          producerActorId: null,
          ownerActorId: null,
          custodianActorId: null,
          batchId: null,
          batch: null,
          parentId: null,
          commissionedAt: null,
        };
      default:
        return null;
    }
  }

  private canRead(epc: Epc, actorId: string): boolean {
    return this.twinScope(epc, actorId) !== 'none';
  }
}

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
import {
  TwinProjector,
  type ProjectableLink,
  type TwinMutation,
} from './twin-projector.js';

const EPC_URN_PREFIX = 'urn:nodoo:epc:';

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
  cases: Epc[];
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
          eventUid: null,
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
  ): Promise<Epc[]> {
    const query = this.epcRepo
      .createQueryBuilder('epc')
      .innerJoinAndSelect('epc.product', 'product')
      .leftJoinAndSelect('epc.batch', 'batch')
      .where(
        '(epc.producerActorId = :actorId OR epc.ownerActorId = :actorId OR epc.custodianActorId = :actorId OR epc.destinationActorId = :actorId)',
        { actorId },
      );

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

    return query.orderBy('epc.commissionedAt', 'DESC').getMany();
  }

  async search(actorId: string, q: string): Promise<EpcSearchResult> {
    const term = q.trim();

    if (!term) {
      return { cases: [], items: [] };
    }

    const cases = await this.listEpc(actorId, { q: term });

    const rows = await this.epcRepo
      .createQueryBuilder('epc')
      .where(
        '(epc.producerActorId = :actorId OR epc.ownerActorId = :actorId OR epc.custodianActorId = :actorId OR epc.destinationActorId = :actorId)',
        { actorId },
      )
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

  async getEpc(actorId: string, epcId: string): Promise<Epc> {
    const epc = await this.epcRepo.findOne({
      where: { id: epcId },
      relations: { product: true, batch: true },
    });

    if (!epc || !this.canRead(epc, actorId)) {
      throwNotFound('Epc', epcId);
    }

    return epc;
  }

  async getHistory(
    actorId: string,
    epcId: string,
  ): Promise<EpcHistoryEntry[]> {
    const epc = await this.epcRepo.findOne({ where: { id: epcId } });
    if (!epc) throwNotFound('Epc', epcId);

    if (this.canRead(epc, actorId)) {
      return this.readHistory(epcId);
    }

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
        eventUid: null,
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

  private async applyMutations(
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
    const epc = await manager.findOne(Epc, {
      where: [
        { id: epcId, ownerActorId: actorId },
        { id: epcId, custodianActorId: actorId },
        { id: epcId, destinationActorId: actorId },
      ],
    });

    if (!epc) throwNotFound('Epc', epcId);

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

  private mintEpcId(): string {
    return `${EPC_URN_PREFIX}${randomUUID()}`;
  }

  private canRead(epc: Epc, actorId: string): boolean {
    return (
      epc.ownerActorId === actorId ||
      epc.custodianActorId === actorId ||
      epc.producerActorId === actorId ||
      epc.destinationActorId === actorId
    );
  }
}

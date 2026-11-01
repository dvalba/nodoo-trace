import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { throwNotFound } from '../common/helpers/crud-exceptions.helper.js';
import { ProductsService } from '../products/products.service.js';
import { Batch } from '../products/entities/batch.entity.js';
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
import {
  TwinProjector,
  type ProjectableLink,
  type TwinMutation,
} from './twin-projector.js';

const EPC_URN_PREFIX = 'urn:nodoo:epc:';

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

  async ship(actorId: string, epcId: string): Promise<Epc> {
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

  async aggregate(
    actorId: string,
    parentId: string,
    dto: AggregateEpcDto,
    action: EventAction.ADD | EventAction.DELETE,
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
          bizStep: null,
          bizTransactionType: null,
          bizTransactionId: null,
          actorId,
          batchId: null,
          disposition: null,
          payload: {
            type: EventType.AGGREGATION,
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
    await this.getEpc(actorId, epcId);

    const links = await this.eventEpcRepo
      .createQueryBuilder('link')
      .innerJoinAndSelect('link.event', 'event')
      .where('link.epcId = :epcId', { epcId })
      .orderBy('event.eventTime', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .getMany();

    return links.map((link) => this.toHistoryEntry(link));
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
      ],
    });

    if (!epc) throwNotFound('Epc', epcId);

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
      epc.producerActorId === actorId
    );
  }
}

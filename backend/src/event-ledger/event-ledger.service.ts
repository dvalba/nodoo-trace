import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { throwNotFound } from '../common/helpers/crud-exceptions.helper.js';
import { ProductsService } from '../products/products.service.js';
import { Batch } from '../products/entities/batch.entity.js';
import { BizStep } from './epics-core/enums/biz-step.enum.js';
import { EpcStatus } from './epics-core/enums/epc-status.enum.js';
import { EventAction } from './epics-core/enums/event-action.enum.js';
import { EventType } from './epics-core/enums/event-type.enum.js';
import { EventEpcRole } from './enums/event-epc-role.enum.js';
import { Epc } from './entities/epc.entity.js';
import { EventEpc } from './entities/event-epc.entity.js';
import { LedgerEvent } from './entities/ledger-event.entity.js';
import { CommissionEpcDto } from './dto/commission-epc.dto.js';

const EPC_URN_PREFIX = 'urn:nodoo:epc:';

@Injectable()
export class EventLedgerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    @InjectRepository(Epc)
    private readonly epcRepo: Repository<Epc>,
    @InjectRepository(Batch)
    private readonly batchRepo: Repository<Batch>,
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
      const epcId = `${EPC_URN_PREFIX}${randomUUID()}`;
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

  private canRead(epc: Epc, actorId: string): boolean {
    return (
      epc.ownerActorId === actorId ||
      epc.custodianActorId === actorId ||
      epc.producerActorId === actorId
    );
  }
}

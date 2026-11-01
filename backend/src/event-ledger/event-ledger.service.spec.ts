import { describe, expect, it, vi } from 'vitest';
import { DataSource, Repository } from 'typeorm';
import { EventLedgerService } from './event-ledger.service.js';
import { ProductsService } from '../products/products.service.js';
import { TwinProjector } from './twin-projector.js';
import { Epc } from './entities/epc.entity.js';
import { Batch } from '../products/entities/batch.entity.js';
import { EventEpc } from './entities/event-epc.entity.js';
import { BizStep } from './epics-core/enums/biz-step.enum.js';
import { EpcStatus } from './epics-core/enums/epc-status.enum.js';
import { EventAction } from './epics-core/enums/event-action.enum.js';
import { EventType } from './epics-core/enums/event-type.enum.js';
import { EventEpcRole } from './enums/event-epc-role.enum.js';

const EPC_ID = 'urn:nodoo:epc:1';
const ACTOR = 'actor-1';

function makeService(epc: Partial<Epc> | null, links: unknown[]) {
  const findOne = vi.fn().mockResolvedValue(epc);
  const getMany = vi.fn().mockResolvedValue(links);
  const builder = {
    innerJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getMany,
  };
  const createQueryBuilder = vi.fn().mockReturnValue(builder);

  const service = new EventLedgerService(
    {} as DataSource,
    {} as ProductsService,
    {} as TwinProjector,
    { findOne } as unknown as Repository<Epc>,
    {} as Repository<Batch>,
    { createQueryBuilder } as unknown as Repository<EventEpc>,
  );

  return { service, findOne, createQueryBuilder, builder, getMany };
}

describe('EventLedgerService.getHistory', () => {
  it('returns the events of a readable EPC in chronological order', async () => {
    const event = {
      id: '10',
      type: EventType.OBJECT,
      eventTime: new Date('2026-10-31T10:00:00.000Z'),
      recordedAt: new Date('2026-10-31T10:00:01.000Z'),
      actorId: ACTOR,
      batchId: null,
      readPointId: null,
      bizStep: BizStep.SHIPPING,
      bizTransactionType: null,
      bizTransactionId: null,
      disposition: EpcStatus.IN_TRANSIT,
      source: 'platform',
      eventUid: null,
      payload: { action: EventAction.OBSERVE },
    };
    const { service, findOne, createQueryBuilder, builder } = makeService(
      {
        ownerActorId: ACTOR,
        producerActorId: 'producer-1',
        custodianActorId: null,
      },
      [{ role: EventEpcRole.OBSERVED, event }],
    );

    const history = await service.getHistory(ACTOR, EPC_ID);

    expect(findOne).toHaveBeenCalledWith({
      where: { id: EPC_ID },
      relations: { product: true, batch: true },
    });
    expect(createQueryBuilder).toHaveBeenCalledWith('link');
    expect(builder.where).toHaveBeenCalledWith('link.epcId = :epcId', {
      epcId: EPC_ID,
    });
    expect(builder.orderBy).toHaveBeenCalledWith('event.eventTime', 'ASC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('event.id', 'ASC');
    expect(history).toEqual([
      { role: EventEpcRole.OBSERVED, ...event },
    ]);
  });

  it('hides the history from unrelated actors', async () => {
    const { service, createQueryBuilder } = makeService(
      {
        ownerActorId: 'other',
        producerActorId: 'producer-1',
        custodianActorId: null,
      },
      [],
    );

    await expect(service.getHistory(ACTOR, EPC_ID)).rejects.toThrow(
      'Epc not found',
    );
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });

  it('hides the history when the EPC does not exist', async () => {
    const { service, createQueryBuilder } = makeService(null, []);

    await expect(service.getHistory(ACTOR, EPC_ID)).rejects.toThrow(
      'Epc not found',
    );
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });
});

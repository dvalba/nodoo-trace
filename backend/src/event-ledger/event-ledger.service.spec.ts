import { describe, expect, it, vi } from 'vitest';
import { DataSource, Repository } from 'typeorm';
import { EventLedgerService } from './event-ledger.service.js';
import { ProductsService } from '../products/products.service.js';
import { TwinProjector } from './twin-projector.js';
import { Epc } from './entities/epc.entity.js';
import { Batch } from '../products/entities/batch.entity.js';
import { EventEpc } from './entities/event-epc.entity.js';
import { Actor } from '../actor/entities/actor.entity.js';
import { BizStep } from './epics-core/enums/biz-step.enum.js';
import { EventType } from './epics-core/enums/event-type.enum.js';
import { EventEpcRole } from './enums/event-epc-role.enum.js';

const EPC_ID = 'urn:nodoo:epc:1';
const ACTOR = 'actor-1';
const PRODUCER = 'producer-1';
const CUSTODIAN_B = 'custodian-b';
const CUSTODIAN_C = 'custodian-c';

interface LinkOptions {
  id: string;
  actorId: string;
  role: EventEpcRole;
  type?: EventType;
  bizStep?: BizStep | null;
  payload?: Record<string, unknown>;
  eventTime?: Date;
}

function makeLink(options: LinkOptions) {
  return {
    epcId: EPC_ID,
    role: options.role,
    event: {
      id: options.id,
      type: options.type ?? EventType.OBJECT,
      eventTime: options.eventTime ?? new Date('2026-10-31T10:00:00.000Z'),
      recordedAt: new Date('2026-10-31T10:00:01.000Z'),
      actorId: options.actorId,
      batchId: null,
      readPointId: null,
      bizStep: options.bizStep ?? null,
      bizTransactionType: null,
      bizTransactionId: null,
      disposition: null,
      source: 'platform',
      eventUid: null,
      payload: options.payload ?? {},
    },
  };
}

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
    {} as Repository<Actor>,
  );

  return { service, findOne, createQueryBuilder, builder };
}

function custodyLinks() {
  return [
    makeLink({
      id: '1',
      actorId: PRODUCER,
      role: EventEpcRole.OBSERVED,
      bizStep: BizStep.COMMISSIONING,
    }),
    makeLink({
      id: '2',
      actorId: PRODUCER,
      role: EventEpcRole.OBSERVED,
      bizStep: BizStep.SHIPPING,
    }),
    makeLink({
      id: '3',
      actorId: PRODUCER,
      role: EventEpcRole.OBSERVED,
      type: EventType.TRANSACTION,
      payload: { custodyTransfer: { to: CUSTODIAN_B } },
    }),
    makeLink({
      id: '4',
      actorId: CUSTODIAN_B,
      role: EventEpcRole.OBSERVED,
      bizStep: BizStep.SHIPPING,
    }),
    makeLink({
      id: '5',
      actorId: CUSTODIAN_C,
      role: EventEpcRole.OBSERVED,
      bizStep: BizStep.RECEIVING,
    }),
  ];
}

describe('EventLedgerService.getHistory', () => {
  it('returns the events of a readable EPC in chronological order', async () => {
    const link = makeLink({
      id: '10',
      actorId: ACTOR,
      role: EventEpcRole.OBSERVED,
      bizStep: BizStep.SHIPPING,
    });
    const { service, findOne, createQueryBuilder, builder } = makeService(
      { ownerActorId: ACTOR, producerActorId: PRODUCER, custodianActorId: null },
      [link],
    );

    const history = await service.getHistory(ACTOR, EPC_ID);

    expect(findOne).toHaveBeenCalledWith({ where: { id: EPC_ID } });
    expect(createQueryBuilder).toHaveBeenCalledWith('link');
    expect(builder.where).toHaveBeenCalledWith('link.epcId = :epcId', {
      epcId: EPC_ID,
    });
    expect(builder.orderBy).toHaveBeenCalledWith('event.eventTime', 'ASC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('event.id', 'ASC');
    expect(history).toEqual([
      {
        role: link.role,
        ...link.event,
        epcs: [{ id: EPC_ID, role: link.role }],
      },
    ]);
  });

  it('gives the owner and the producer the full history', async () => {
    const { service } = makeService(
      {
        ownerActorId: 'owner-1',
        producerActorId: PRODUCER,
        custodianActorId: CUSTODIAN_C,
      },
      custodyLinks(),
    );

    expect(await service.getHistory('owner-1', EPC_ID)).toHaveLength(5);
    expect(await service.getHistory(PRODUCER, EPC_ID)).toHaveLength(5);
  });

  it('limits a former custodian to their window, including the handover', async () => {
    const { service } = makeService(
      {
        ownerActorId: PRODUCER,
        producerActorId: PRODUCER,
        custodianActorId: CUSTODIAN_C,
      },
      custodyLinks(),
    );

    const history = await service.getHistory(CUSTODIAN_B, EPC_ID);

    expect(history.map((entry) => entry.id)).toEqual(['3', '4', '5']);
  });

  it('gives the current custodian the full history', async () => {
    const { service } = makeService(
      {
        ownerActorId: PRODUCER,
        producerActorId: PRODUCER,
        custodianActorId: CUSTODIAN_C,
      },
      custodyLinks(),
    );

    const history = await service.getHistory(CUSTODIAN_C, EPC_ID);

    expect(history.map((entry) => entry.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('hides the history from actors with no custody relation', async () => {
    const { service, createQueryBuilder } = makeService(
      {
        ownerActorId: PRODUCER,
        producerActorId: PRODUCER,
        custodianActorId: CUSTODIAN_C,
      },
      custodyLinks(),
    );

    await expect(service.getHistory('stranger', EPC_ID)).rejects.toThrow(
      'Epc not found',
    );
    expect(createQueryBuilder).toHaveBeenCalled();
  });

  it('hides the history when the EPC does not exist', async () => {
    const { service, createQueryBuilder } = makeService(null, []);

    await expect(service.getHistory(ACTOR, EPC_ID)).rejects.toThrow(
      'Epc not found',
    );
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });
});

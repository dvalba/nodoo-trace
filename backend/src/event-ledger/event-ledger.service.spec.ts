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
import { EpcStatus } from './epics-core/enums/epc-status.enum.js';
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

  it('gives the owner the full history (FR-606)', async () => {
    const { service } = makeService(
      {
        ownerActorId: 'owner-1',
        producerActorId: PRODUCER,
        custodianActorId: CUSTODIAN_C,
      },
      custodyLinks(),
    );

    const history = await service.getHistory('owner-1', EPC_ID);

    expect(history.map((entry) => entry.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('hides the history from a producer that is no longer the owner, even while it custodies the EPC (FR-D6)', async () => {
    const { service } = makeService(
      {
        ownerActorId: 'owner-1',
        producerActorId: PRODUCER,
        custodianActorId: PRODUCER,
      },
      custodyLinks(),
    );

    await expect(service.getHistory(PRODUCER, EPC_ID)).rejects.toThrow(
      'Epc not found',
    );
  });

  it('limits a former custodian to their window, including the handover (FR-D4)', async () => {
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

  it('limits the current custodian to their own custody window (FR-D4/FR-606)', async () => {
    const { service } = makeService(
      {
        ownerActorId: PRODUCER,
        producerActorId: PRODUCER,
        custodianActorId: CUSTODIAN_C,
      },
      custodyLinks(),
    );

    const history = await service.getHistory(CUSTODIAN_C, EPC_ID);

    expect(history.map((entry) => entry.id)).toEqual(['5']);
  });

  it('hides the history from the destination of an in-transit case until it receives (FR-606)', async () => {
    const { service } = makeService(
      {
        ownerActorId: PRODUCER,
        producerActorId: PRODUCER,
        custodianActorId: PRODUCER,
        destinationActorId: CUSTODIAN_C,
        status: EpcStatus.IN_TRANSIT,
      },
      custodyLinks(),
    );

    await expect(service.getHistory(CUSTODIAN_C, EPC_ID)).rejects.toThrow(
      'Epc not found',
    );
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

describe('EventLedgerService.getEpc', () => {
  it('gives the owner the whole twin (FR-605)', async () => {
    const { service } = makeService(
      {
        id: EPC_ID,
        ownerActorId: 'owner-1',
        producerActorId: PRODUCER,
        custodianActorId: 'owner-1',
        status: EpcStatus.ACTIVE,
      },
      [],
    );

    const twin = await service.getEpc('owner-1', EPC_ID);

    expect(twin.producerActorId).toBe(PRODUCER);
    expect(twin.ownerActorId).toBe('owner-1');
    expect(twin.custodianActorId).toBe('owner-1');
  });

  it('hides the producer from the current custodian (FR-605/FR-D4)', async () => {
    const { service } = makeService(
      {
        id: EPC_ID,
        ownerActorId: 'owner-1',
        producerActorId: PRODUCER,
        custodianActorId: CUSTODIAN_B,
        status: EpcStatus.ACTIVE,
      },
      [],
    );

    const twin = await service.getEpc(CUSTODIAN_B, EPC_ID);

    expect(twin.producerActorId).toBeNull();
    expect(twin.ownerActorId).toBe('owner-1');
    expect(twin.custodianActorId).toBe(CUSTODIAN_B);
  });

  it('gives the destination of an in-transit case only the EPC and its product (FR-605/FR-D5)', async () => {
    const { service } = makeService(
      {
        id: EPC_ID,
        ownerActorId: 'owner-1',
        producerActorId: PRODUCER,
        custodianActorId: 'owner-1',
        destinationActorId: CUSTODIAN_C,
        batchId: 'batch-1',
        parentId: `${EPC_ID}-parent`,
        commissionedAt: new Date('2026-10-01T00:00:00.000Z'),
        status: EpcStatus.IN_TRANSIT,
      },
      [],
    );

    const twin = await service.getEpc(CUSTODIAN_C, EPC_ID);

    expect(twin.id).toBe(EPC_ID);
    expect(twin.status).toBe(EpcStatus.IN_TRANSIT);
    expect(twin.destinationActorId).toBe(CUSTODIAN_C);
    expect(twin.producerActorId).toBeNull();
    expect(twin.ownerActorId).toBeNull();
    expect(twin.custodianActorId).toBeNull();
    expect(twin.batchId).toBeNull();
    expect(twin.parentId).toBeNull();
    expect(twin.commissionedAt).toBeNull();
  });

  it('hides the twin from a producer that is no longer the owner (FR-D6)', async () => {
    const { service } = makeService(
      {
        id: EPC_ID,
        ownerActorId: 'owner-1',
        producerActorId: PRODUCER,
        custodianActorId: CUSTODIAN_B,
        status: EpcStatus.ACTIVE,
      },
      [],
    );

    await expect(service.getEpc(PRODUCER, EPC_ID)).rejects.toThrow(
      'Epc not found',
    );
  });

  it('hides the twin from unrelated organizations (FR-D2)', async () => {
    const { service } = makeService(
      {
        id: EPC_ID,
        ownerActorId: 'owner-1',
        producerActorId: PRODUCER,
        custodianActorId: CUSTODIAN_B,
        status: EpcStatus.ACTIVE,
      },
      [],
    );

    await expect(service.getEpc('stranger', EPC_ID)).rejects.toThrow(
      'Epc not found',
    );
  });

  it('hides the twin when the EPC does not exist', async () => {
    const { service } = makeService(null, []);

    await expect(service.getEpc(ACTOR, EPC_ID)).rejects.toThrow(
      'Epc not found',
    );
  });
});

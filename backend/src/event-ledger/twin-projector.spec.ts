import { describe, expect, it } from 'vitest';
import { TwinProjector, type ProjectableEvent } from './twin-projector.js';
import { BizStep } from './epics-core/enums/biz-step.enum.js';
import { BizTransactionType } from './epics-core/enums/biz-transaction-type.enum.js';
import { EpcStatus } from './epics-core/enums/epc-status.enum.js';
import { EventAction } from './epics-core/enums/event-action.enum.js';
import { EventType } from './epics-core/enums/event-type.enum.js';
import { EventEpcRole } from './enums/event-epc-role.enum.js';

const ACTOR = 'actor-1';
const EPC = 'urn:nodoo:epc:1';
const EVENT_TIME = new Date('2026-10-29T12:00:00.000Z');

const projector = new TwinProjector();

function makeEvent(
  overrides: Partial<ProjectableEvent> = {},
): ProjectableEvent {
  return {
    type: EventType.OBJECT,
    bizStep: null,
    bizTransactionType: null,
    disposition: null,
    actorId: ACTOR,
    batchId: null,
    eventTime: EVENT_TIME,
    payload: {},
    ...overrides,
  };
}

function observed(...epcIds: string[]) {
  return epcIds.map((epcId) => ({ epcId, role: EventEpcRole.OBSERVED }));
}

describe('TwinProjector', () => {
  it('creates the twin on commissioning', () => {
    const mutations = projector.project(
      makeEvent({
        bizStep: BizStep.COMMISSIONING,
        batchId: 'batch-1',
        payload: { productId: 'product-1' },
      }),
      observed(EPC),
    );

    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({
      id: EPC,
      create: true,
      productId: 'product-1',
      batchId: 'batch-1',
      parentId: null,
      producerActorId: ACTOR,
      ownerActorId: ACTOR,
      custodianActorId: ACTOR,
      status: EpcStatus.ACTIVE,
    });
    expect(mutations[0].commissionedAt).toEqual(EVENT_TIME);
  });

  it('assigns custody and reactivates the twin on receiving', () => {
    const mutations = projector.project(
      makeEvent({ bizStep: BizStep.RECEIVING }),
      observed(EPC),
    );

    expect(mutations[0]).toMatchObject({
      id: EPC,
      create: false,
      custodianActorId: ACTOR,
      status: EpcStatus.ACTIVE,
    });
  });

  it('marks the twin in transit on shipping', () => {
    const mutations = projector.project(
      makeEvent({ bizStep: BizStep.SHIPPING }),
      observed(EPC),
    );

    expect(mutations[0]).toMatchObject({
      id: EPC,
      status: EpcStatus.IN_TRANSIT,
    });
  });

  it('does not mutate the twin on inspecting', () => {
    expect(
      projector.project(
        makeEvent({ bizStep: BizStep.INSPECTING }),
        observed(EPC),
      ),
    ).toEqual([]);
  });

  it('transfers ownership on an invoice, honouring an explicit override', () => {
    const byDefault = projector.project(
      makeEvent({
        type: EventType.TRANSACTION,
        bizTransactionType: BizTransactionType.INV,
      }),
      observed(EPC),
    );

    expect(byDefault[0]).toMatchObject({ ownerActorId: ACTOR });

    const explicit = projector.project(
      makeEvent({
        type: EventType.TRANSACTION,
        bizTransactionType: BizTransactionType.INV,
        payload: { ownershipTransfer: { to: 'buyer-1' } },
      }),
      observed(EPC),
    );

    expect(explicit[0]).toMatchObject({ ownerActorId: 'buyer-1' });
  });

  it('applies an explicit custody transfer override', () => {
    const mutations = projector.project(
      makeEvent({
        bizStep: BizStep.RECEIVING,
        payload: { custodyTransfer: { to: 'custodian-1' } },
      }),
      observed(EPC),
    );

    expect(mutations[0]).toMatchObject({ custodianActorId: 'custodian-1' });
  });

  it('sets and clears the parent on aggregation add/delete', () => {
    const links = [
      { epcId: 'parent-1', role: EventEpcRole.PARENT },
      { epcId: 'child-1', role: EventEpcRole.CHILD },
    ];

    const added = projector.project(
      makeEvent({
        type: EventType.AGGREGATION,
        payload: { action: EventAction.ADD },
      }),
      links,
    );

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ id: 'child-1', parentId: 'parent-1' });

    const removed = projector.project(
      makeEvent({
        type: EventType.AGGREGATION,
        payload: { action: EventAction.DELETE },
      }),
      links,
    );

    expect(removed[0]).toMatchObject({ id: 'child-1', parentId: null });
  });

  it('consumes inputs and mints outputs on transformation', () => {
    const mutations = projector.project(
      makeEvent({
        type: EventType.TRANSFORMATION,
        batchId: 'batch-out',
        payload: { outputProductId: 'product-out' },
      }),
      [
        { epcId: 'input-1', role: EventEpcRole.INPUT },
        { epcId: 'output-1', role: EventEpcRole.OUTPUT },
      ],
    );

    expect(mutations).toHaveLength(2);
    expect(mutations.find((m) => m.id === 'input-1')).toMatchObject({
      status: EpcStatus.CONSUMED,
      create: false,
    });
    expect(mutations.find((m) => m.id === 'output-1')).toMatchObject({
      create: true,
      productId: 'product-out',
      batchId: 'batch-out',
      producerActorId: ACTOR,
      ownerActorId: ACTOR,
      custodianActorId: ACTOR,
      status: EpcStatus.ACTIVE,
    });
  });

  it('records association events without mutating twins', () => {
    expect(
      projector.project(makeEvent({ type: EventType.ASSOCIATION }), [
        { epcId: 'epc-a', role: EventEpcRole.SOURCE },
        { epcId: 'epc-b', role: EventEpcRole.ASSOCIATED },
      ]),
    ).toEqual([]);
  });
});

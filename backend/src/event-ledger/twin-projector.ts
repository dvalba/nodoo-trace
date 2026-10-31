import { Injectable } from '@nestjs/common';
import { BizStep } from './epics-core/enums/biz-step.enum.js';
import { BizTransactionType } from './epics-core/enums/biz-transaction-type.enum.js';
import { EpcStatus } from './epics-core/enums/epc-status.enum.js';
import { EventAction } from './epics-core/enums/event-action.enum.js';
import { EventType } from './epics-core/enums/event-type.enum.js';
import { EventEpcRole } from './enums/event-epc-role.enum.js';

export interface ProjectableEvent {
  type: EventType;
  bizStep: BizStep | null;
  bizTransactionType: string | null;
  actorId: string;
  batchId: string | null;
  eventTime: Date;
  payload: Record<string, unknown>;
}

export interface ProjectableLink {
  epcId: string;
  role: EventEpcRole;
}

export interface TwinMutation {
  id: string;
  create: boolean;
  productId?: string;
  batchId?: string | null;
  parentId?: string | null;
  producerActorId?: string;
  ownerActorId?: string | null;
  custodianActorId?: string | null;
  status?: EpcStatus;
  commissionedAt?: Date;
}

type SetMutation = (
  id: string,
  patch: Partial<Omit<TwinMutation, 'id'>>,
) => void;

type IdsByRole = (role: EventEpcRole) => string[];

@Injectable()
export class TwinProjector {
  project(event: ProjectableEvent, links: ProjectableLink[]): TwinMutation[] {
    const mutations = new Map<string, TwinMutation>();

    const set: SetMutation = (id, patch) => {
      const prev = mutations.get(id);
      mutations.set(id, {
        id,
        create: prev?.create ?? false,
        ...prev,
        ...patch,
      });
    };

    const idsByRole: IdsByRole = (role) =>
      links.filter((link) => link.role === role).map((link) => link.epcId);

    switch (event.type) {
      case EventType.OBJECT:
        this.projectObject(event, idsByRole, set);
        break;
      case EventType.TRANSACTION:
        this.projectTransaction(event, idsByRole, set);
        break;
      case EventType.AGGREGATION:
        this.projectAggregation(event, idsByRole, set);
        break;
      case EventType.TRANSFORMATION:
        this.projectTransformation(event, idsByRole, set);
        break;
      case EventType.ASSOCIATION:
        break;
    }

    return [...mutations.values()];
  }

  private projectObject(
    event: ProjectableEvent,
    idsByRole: IdsByRole,
    set: SetMutation,
  ): void {
    const observed = idsByRole(EventEpcRole.OBSERVED);

    switch (event.bizStep) {
      case BizStep.COMMISSIONING: {
        const productId = this.readString(event.payload, 'productId');
        if (!productId) break;

        for (const id of observed) {
          set(id, {
            create: true,
            productId,
            batchId: event.batchId,
            parentId: null,
            producerActorId: event.actorId,
            ownerActorId: event.actorId,
            custodianActorId: event.actorId,
            status: EpcStatus.ACTIVE,
            commissionedAt: event.eventTime,
          });
        }
        break;
      }
      case BizStep.RECEIVING:
        for (const id of observed) {
          set(id, {
            custodianActorId: event.actorId,
            status: EpcStatus.ACTIVE,
          });
        }
        break;
      case BizStep.SHIPPING:
        for (const id of observed) {
          set(id, { status: EpcStatus.IN_TRANSIT });
        }
        break;
      default:
        break;
    }

    this.applyTransferOverrides(event, observed, set);
  }

  private projectTransaction(
    event: ProjectableEvent,
    idsByRole: IdsByRole,
    set: SetMutation,
  ): void {
    const observed = idsByRole(EventEpcRole.OBSERVED);

    if (event.bizTransactionType === BizTransactionType.INV) {
      for (const id of observed) {
        set(id, { ownerActorId: event.actorId });
      }
    }

    this.applyTransferOverrides(event, observed, set);
  }

  private projectAggregation(
    event: ProjectableEvent,
    idsByRole: IdsByRole,
    set: SetMutation,
  ): void {
    const parentIds = idsByRole(EventEpcRole.PARENT);
    const parentId = parentIds.length > 0 ? parentIds[0] : null;
    const action = this.readString(event.payload, 'action');
    const children = idsByRole(EventEpcRole.CHILD);

    if (action === EventAction.ADD) {
      for (const child of children) {
        set(child, { parentId });
      }
    } else if (action === EventAction.DELETE) {
      for (const child of children) {
        set(child, { parentId: null });
      }
    }
  }

  private projectTransformation(
    event: ProjectableEvent,
    idsByRole: IdsByRole,
    set: SetMutation,
  ): void {
    for (const input of idsByRole(EventEpcRole.INPUT)) {
      set(input, { status: EpcStatus.CONSUMED });
    }

    const outputProductId = this.readString(event.payload, 'outputProductId');
    if (!outputProductId) return;

    for (const output of idsByRole(EventEpcRole.OUTPUT)) {
      set(output, {
        create: true,
        productId: outputProductId,
        batchId: event.batchId,
        parentId: null,
        producerActorId: event.actorId,
        ownerActorId: event.actorId,
        custodianActorId: event.actorId,
        status: EpcStatus.ACTIVE,
        commissionedAt: event.eventTime,
      });
    }
  }

  private applyTransferOverrides(
    event: ProjectableEvent,
    epcIds: string[],
    set: SetMutation,
  ): void {
    const custodyTo = this.readObject(event.payload, 'custodyTransfer')?.to;
    if (typeof custodyTo === 'string') {
      for (const id of epcIds) {
        set(id, { custodianActorId: custodyTo });
      }
    }

    const ownershipTo = this.readObject(event.payload, 'ownershipTransfer')?.to;
    if (typeof ownershipTo === 'string') {
      for (const id of epcIds) {
        set(id, { ownerActorId: ownershipTo });
      }
    }
  }

  private readString(
    payload: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = payload[key];
    return typeof value === 'string' ? value : undefined;
  }

  private readObject(
    payload: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> | undefined {
    const value = payload[key];
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }
}

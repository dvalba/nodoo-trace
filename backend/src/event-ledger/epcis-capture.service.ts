import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Actor } from '../actor/entities/actor.entity.js';
import { Product } from '../products/entities/product.entity.js';
import { EpcStatus } from './epics-core/enums/epc-status.enum.js';
import { Epc } from './entities/epc.entity.js';
import { EventEpc } from './entities/event-epc.entity.js';
import { LedgerEvent } from './entities/ledger-event.entity.js';
import {
  EpcisParseError,
  dropCreateMutationsForExisting,
  parseEpcisDocument,
  splitRequestBody,
} from './epcis-capture.parser.js';
import { EventLedgerService } from './event-ledger.service.js';
import { TwinProjector } from './twin-projector.js';

export interface EpcisCaptureResult {
  /** Events persisted by this import. */
  imported: number;
  /** Events already in the ledger by `eventUid` (FR-2002, idempotent). */
  skipped: number;
  /** EPCs created for the document (FR-2005). */
  epcsCreated: number;
}

/**
 * EPCIS 2.0 capture ingestion for third parties (US15, FR-2001..FR-2005):
 * the caller's organization pushes a capture document; events are persisted
 * with `source: 'external'` and their document `eventID` as `eventUid`
 * (deterministic digest when the event carries none), projected on the twin
 * with the local rules, and uncommissioned EPCs are created with the owner
 * and product passed in the request (FR-2005). The whole document is
 * imported in a single transaction: any rejection (400) leaves no partial
 * effect.
 */
@Injectable()
export class EpcisCaptureService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventLedgerService: EventLedgerService,
    private readonly projector: TwinProjector,
    @InjectRepository(Epc)
    private readonly epcRepo: Repository<Epc>,
    @InjectRepository(LedgerEvent)
    private readonly eventRepo: Repository<LedgerEvent>,
    @InjectRepository(Actor)
    private readonly actorRepo: Repository<Actor>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async capture(
    actorId: string,
    body: unknown,
  ): Promise<EpcisCaptureResult> {
    const { document, epcMapping } = this.parse(body);

    const epcIds = [...new Set(document.events.flatMap((event) =>
      event.links.map((link) => link.id),
    ))];

    const existing = await this.epcRepo.find({ where: { id: In(epcIds) } });
    const existingIds = new Set(existing.map((epc) => epc.id));
    const missing = epcIds.filter((id) => !existingIds.has(id));
    const mapping = epcMapping ?? {};

    await this.requireOwnersForMissing(missing, mapping);

    return this.dataSource.transaction(async (manager) => {
      const created = await this.createMissingEpcs(manager, missing, mapping);

      const knownUids = new Set(
        (
          await manager.find(LedgerEvent, {
            where: { eventUid: In(document.events.map((event) => event.eventUid)) },
            select: { eventUid: true },
          })
        ).map((event) => event.eventUid),
      );

      const presentIds = new Set<string>([...existingIds, ...missing]);
      let imported = 0;
      let skipped = 0;

      for (const event of document.events) {
        // FR-2002: an event whose eventUid is already in the ledger is
        // ignored (idempotent re-push).
        if (knownUids.has(event.eventUid)) {
          skipped += 1;
          continue;
        }

        const saved = await manager.save(
          manager.create(LedgerEvent, {
            type: event.type,
            eventTime: event.eventTime,
            actorId,
            batchId: null,
            readPointId: event.readPointId,
            bizStep: event.bizStep,
            bizTransactionType: event.bizTransactionType,
            bizTransactionId: event.bizTransactionId,
            disposition: event.disposition,
            source: 'external',
            eventUid: event.eventUid,
            payload: event.raw,
          }),
        );

        const mutations = this.projector.project(
          {
            type: event.type,
            bizStep: event.bizStep,
            bizTransactionType: event.bizTransactionType,
            disposition: event.disposition,
            actorId,
            batchId: null,
            eventTime: event.eventTime,
            payload: event.raw,
          },
          event.links.map((link) => ({ epcId: link.id, role: link.role })),
        );

        await this.eventLedgerService.applyMutations(
          manager,
          dropCreateMutationsForExisting(mutations, presentIds),
        );

        await manager.save(
          event.links.map((link) =>
            manager.create(EventEpc, {
              eventId: saved.id,
              epcId: link.id,
              role: link.role,
            }),
          ),
        );

        knownUids.add(event.eventUid);
        imported += 1;
      }

      return { imported, skipped, epcsCreated: created };
    });
  }

  private parse(
    body: unknown,
  ): ReturnType<typeof splitRequestBody> & {
    document: ReturnType<typeof parseEpcisDocument>;
  } {
    try {
      const request = splitRequestBody(body);
      return {
        ...request,
        document: parseEpcisDocument(request.document),
      };
    } catch (error) {
      if (error instanceof EpcisParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * FR-2005: every EPC referenced by the document that is not commissioned
   * must come with its owner (and product) in the request; otherwise the
   * whole document is rejected with 400 before anything is written.
   */
  private async requireOwnersForMissing(
    missing: string[],
    mapping: Record<string, { ownerActorId: string; productId: string }>,
  ): Promise<void> {
    if (missing.length === 0) return;

    const unmapped = missing.filter((id) => !mapping[id]);
    if (unmapped.length > 0) {
      throw new BadRequestException(
        `The document references uncommissioned EPCs without an owner in epcMapping: ${unmapped.join(', ')}`,
      );
    }

    const ownerIds = [
      ...new Set(missing.map((id) => mapping[id].ownerActorId)),
    ];
    const productIds = [
      ...new Set(missing.map((id) => mapping[id].productId)),
    ];
    const owners = await this.actorRepo.find({ where: { id: In(ownerIds) } });
    const products = await this.productRepo.find({
      where: { id: In(productIds) },
    });
    const ownerIdsKnown = new Set(owners.map((actor) => actor.id));
    const productIdsKnown = new Set(products.map((product) => product.id));

    for (const id of missing) {
      const entry = mapping[id];
      if (!ownerIdsKnown.has(entry.ownerActorId)) {
        throw new BadRequestException(
          `epcMapping["${id}"].ownerActorId does not reference an existing organization.`,
        );
      }
      if (!productIdsKnown.has(entry.productId)) {
        throw new BadRequestException(
          `epcMapping["${id}"].productId does not reference an existing product.`,
        );
      }
    }
  }

  private async createMissingEpcs(
    manager: EntityManager,
    missing: string[],
    mapping: Record<string, { ownerActorId: string; productId: string }>,
  ): Promise<number> {
    if (missing.length === 0) return 0;

    await manager.save(
      missing.map((id) =>
        manager.create(Epc, {
          id,
          productId: mapping[id].productId,
          batchId: null,
          parentId: null,
          producerActorId: mapping[id].ownerActorId,
          ownerActorId: mapping[id].ownerActorId,
          custodianActorId: mapping[id].ownerActorId,
          destinationActorId: null,
          status: EpcStatus.ACTIVE,
        }),
      ),
    );

    return missing.length;
  }
}

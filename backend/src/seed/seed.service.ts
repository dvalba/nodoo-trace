import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ActivityTypesService } from '../activity-types/activity-types.service.js';
import { Actor } from '../actor/entities/actor.entity.js';
import { ActorStatus } from '../actor/enums/actor-status.enum.js';
import { UsersService } from '../users/users.service.js';
import { PlatformRole, UserRole } from '../users/enums/roles.enum.js';
import { UserStatus } from '../users/enums/user-status.enum.js';
import { Product } from '../products/entities/product.entity.js';
import { Batch } from '../products/entities/batch.entity.js';
import { EventLedgerService } from '../event-ledger/event-ledger.service.js';
import { BizStep } from '../event-ledger/epics-core/enums/biz-step.enum.js';
import { EventAction } from '../event-ledger/epics-core/enums/event-action.enum.js';
import { ProductNotice } from '../notices/entities/product-notice.entity.js';
import { ProductNoticeEpc } from '../notices/entities/product-notice-epc.entity.js';
import { ProductNoticeAck } from '../notices/entities/product-notice-ack.entity.js';
import { NoticeType } from '../notices/enums/notice-type.enum.js';

export const SEED_PASSWORD = 'Seed1234';

// Deterministic ids so UI deep links and documentation stay valid on any seed.
export const SEED_IDS = {
  vaccineProduct: '3f2b8c1d-9a4e-4b7c-8d21-6e5f4a3b2c10',
  vaccineBatch: '4a3c9d2e-8b5f-4c6d-9e32-7f6a5b4c3d21',
  insulinProduct: '5b4d0e3f-9c6a-4d7e-8f43-8a7b6c5d4e32',
  insulinBatch: '6c5e1f4a-8d7b-4e6f-9a54-9b8c7d6e5f43',
  notice: '7d6f2a5b-9e8c-4f7a-8b65-ac9d8e7f6a54',
} as const;

// Cases are the traceable unit: each one is commissioned as an EPC. The
// units of content each case holds are separate digital twins (their own
// EPC and history, FR-D7), packed into the case. Pallets are logistics units
// and are intentionally NOT serialized, so they have no EPC here (and
// therefore no ledger history).
export const SEED_EPC_IDS = {
  vaccine: [
    'urn:nodoo:epc:1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    'urn:nodoo:epc:2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
    'urn:nodoo:epc:3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f',
  ],
  insulin: [
    'urn:nodoo:epc:4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a',
    'urn:nodoo:epc:5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b',
  ],
  // Two content units per case (FR-D7: case and content are separable
  // twins linked by aggregation). The UI abbreviates each EPC as the first
  // 8 chars of the last ':'-separated segment (the whole UUID here), so
  // every content unit gets a unique 8-char prefix — distinct from each
  // other and from the five case prefixes (1a2b3c4d…5e6f7a8b).
  vaccineContent: [
    'urn:nodoo:epc:a1000001-0000-4000-8000-000000000001',
    'urn:nodoo:epc:a2000002-0000-4000-8000-000000000002',
    'urn:nodoo:epc:a3000003-0000-4000-8000-000000000003',
    'urn:nodoo:epc:a4000004-0000-4000-8000-000000000004',
    'urn:nodoo:epc:a5000005-0000-4000-8000-000000000005',
    'urn:nodoo:epc:a6000006-0000-4000-8000-000000000006',
  ],
  insulinContent: [
    'urn:nodoo:epc:a7000007-0000-4000-8000-000000000007',
    'urn:nodoo:epc:a8000008-0000-4000-8000-000000000008',
    'urn:nodoo:epc:a9000009-0000-4000-8000-000000000009',
    'urn:nodoo:epc:aa00000a-0000-4000-8000-00000000000a',
  ],
} as const;

const CONTENT_UNITS_PER_CASE = 2;

export const SEED_NOTICE_ID = SEED_IDS.notice;

interface SeedActor {
  name: string;
  organizationNumber: string;
  activityCode: string;
  email: string;
  fullName: string;
}

const SEED_ACTORS: SeedActor[] = [
  {
    name: 'Laboratorios FarmaSur',
    organizationNumber: 'NIT-901020301',
    activityCode: 'manufacturer',
    email: 'laboratorio@seed.nodoo.local',
    fullName: 'Dra. Elena Ríos',
  },
  {
    name: 'Distribuidora MediAndes',
    organizationNumber: 'NIT-901020302',
    activityCode: 'wholesaler',
    email: 'distribuidora@seed.nodoo.local',
    fullName: 'Carlos Mejía',
  },
  {
    name: 'Hospital San Rafael',
    organizationNumber: 'NIT-901020303',
    activityCode: 'retailer',
    email: 'hospital@seed.nodoo.local',
    fullName: 'Dra. Paula Gómez',
  },
];

const SEED_EMAILS = SEED_ACTORS.map((actor) => actor.email);

const daysAgo = (days: number, hour = 10, minute = 0): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
};

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly activityTypesService: ActivityTypesService,
    private readonly usersService: UsersService,
    private readonly eventLedgerService: EventLedgerService,
  ) {}

  async run(): Promise<void> {
    const actorRepo = this.dataSource.getRepository(Actor);

    const alreadySeeded = (await actorRepo.find()).some((actor) =>
      SEED_ACTORS.some((seed) => seed.name === actor.name),
    );

    if (alreadySeeded) {
      this.logger.log('Seed data already present, skipping.');
      return;
    }

    // ── Organizations and owners ────────────────────────────────────────────
    const manufacturer = await this.seedActor(actorRepo, SEED_ACTORS[0]);
    const distributor = await this.seedActor(actorRepo, SEED_ACTORS[1]);
    const hospital = await this.seedActor(actorRepo, SEED_ACTORS[2]);

    // ── Catalog (fixed ids so UI deep links stay valid across seeds) ────────
    const productRepo = this.dataSource.getRepository(Product);
    const batchRepo = this.dataSource.getRepository(Batch);

    const vaccineProduct = await productRepo.save(
      productRepo.create({
        id: SEED_IDS.vaccineProduct,
        createdByActorId: manufacturer.id,
        sku: 'VAC-FLU-05',
        name: 'Vacuna antigripal 0.5 mL',
      }),
    );
    const vaccineBatch = await batchRepo.save(
      batchRepo.create({
        id: SEED_IDS.vaccineBatch,
        productId: vaccineProduct.id,
        batchCode: 'LOTE-VAC-2026-1117-A',
      }),
    );

    const insulinProduct = await productRepo.save(
      productRepo.create({
        id: SEED_IDS.insulinProduct,
        createdByActorId: manufacturer.id,
        sku: 'INS-GLA-100',
        name: 'Insulina glargina 100 UI/mL',
      }),
    );
    const insulinBatch = await batchRepo.save(
      batchRepo.create({
        id: SEED_IDS.insulinBatch,
        productId: insulinProduct.id,
        batchCode: 'LOTE-INS-2026-1117-B',
      }),
    );

    // ── Traceable cases and their content ───────────────────────────────────
    // Each case is commissioned as an EPC, and every unit of content it
    // holds is its own EPC (separate twin, FR-D7). The pallets that group
    // the cases are not serialized, so they deliberately do not appear in
    // the ledger.
    const vaccineCases = [];
    for (let i = 0; i < SEED_EPC_IDS.vaccine.length; i += 1) {
      vaccineCases.push(
        await this.eventLedgerService.commission(manufacturer.id, {
          productId: vaccineProduct.id,
          batchId: vaccineBatch.id,
        }),
      );
    }

    const vaccineContent: { id: string }[][] = [];
    for (let i = 0; i < vaccineCases.length; i += 1) {
      vaccineContent.push(
        await this.seedContentUnits(
          manufacturer.id,
          vaccineProduct.id,
          vaccineBatch.id,
        ),
      );
    }

    const insulinCases = [];
    for (let i = 0; i < SEED_EPC_IDS.insulin.length; i += 1) {
      insulinCases.push(
        await this.eventLedgerService.commission(manufacturer.id, {
          productId: insulinProduct.id,
          batchId: insulinBatch.id,
        }),
      );
    }

    const insulinContent: { id: string }[][] = [];
    for (let i = 0; i < insulinCases.length; i += 1) {
      insulinContent.push(
        await this.seedContentUnits(
          manufacturer.id,
          insulinProduct.id,
          insulinBatch.id,
        ),
      );
    }

    await this.reassignEpcIds(vaccineCases, SEED_EPC_IDS.vaccine);
    await this.reassignEpcIds(insulinCases, SEED_EPC_IDS.insulin);
    await this.reassignEpcIds(vaccineContent.flat(), SEED_EPC_IDS.vaccineContent);
    await this.reassignEpcIds(insulinContent.flat(), SEED_EPC_IDS.insulinContent);

    // The content is packed into its case (aggregation with the packing
    // business step), so case and content travel together.
    const caseContent = [
      ...vaccineCases.map((box, i) => ({ box, units: vaccineContent[i] })),
      ...insulinCases.map((box, i) => ({ box, units: insulinContent[i] })),
    ];
    for (const { box, units } of caseContent) {
      await this.eventLedgerService.aggregate(
        manufacturer.id,
        box.id,
        { childEpcs: units.map((unit) => unit.id) },
        EventAction.ADD,
        BizStep.PACKING,
      );
    }

    // The manufacturer ships and invoices every case and its content to the
    // distributor, which receives each one into custody.
    for (const { box, units } of caseContent) {
      for (const item of [box, ...units]) {
        await this.eventLedgerService.ship(manufacturer.id, item.id, {
          destinationActorId: distributor.id,
        });
        await this.eventLedgerService.invoice(manufacturer.id, item.id, {
          bizTransactionId: 'INV-2026-0001',
          ownershipTransferTo: distributor.id,
        });
        await this.eventLedgerService.receive(distributor.id, item.id);
      }
    }

    // The distributor forwards one vaccine case (with its content) to the
    // hospital and it is received there.
    const vaccineToHospital = caseContent[0];
    for (const item of [vaccineToHospital.box, ...vaccineToHospital.units]) {
      await this.eventLedgerService.ship(distributor.id, item.id, {
        destinationActorId: hospital.id,
      });
      await this.eventLedgerService.invoice(distributor.id, item.id, {
        bizTransactionId: 'INV-2026-0002',
        ownershipTransferTo: hospital.id,
      });
      await this.eventLedgerService.receive(hospital.id, item.id);
    }

    // One insulin case (with its content) is invoiced to the hospital but
    // left in transit, so the seed also shows a case that has not been
    // received yet.
    const insulinToHospital =
      caseContent[vaccineCases.length];
    for (const item of [insulinToHospital.box, ...insulinToHospital.units]) {
      await this.eventLedgerService.ship(distributor.id, item.id, {
        destinationActorId: hospital.id,
      });
      await this.eventLedgerService.invoice(distributor.id, item.id, {
        bizTransactionId: 'INV-2026-0003',
        ownershipTransferTo: hospital.id,
      });
    }

    // ── Backdate so the story reads like real history ──────────────────────
    await this.backdateActors([
      { id: manufacturer.id, days: 40 },
      { id: distributor.id, days: 39 },
      { id: hospital.id, days: 38 },
    ]);
    await this.backdateUsers(SEED_EMAILS, 39);
    await this.backdateEpcEvents([
      {
        ids: [...vaccineCases, ...vaccineContent.flat()].map((item) => item.id),
        days: 36,
      },
      {
        ids: [...insulinCases, ...insulinContent.flat()].map((item) => item.id),
        days: 30,
      },
    ]);
    await this.backdateTwin([
      ...vaccineCases.map((item) => ({ id: item.id, days: 36 })),
      ...vaccineContent.flat().map((item) => ({ id: item.id, days: 36 })),
      ...insulinCases.map((item) => ({ id: item.id, days: 30 })),
      ...insulinContent.flat().map((item) => ({ id: item.id, days: 30 })),
    ]);

    // ── Recall with acknowledgements (fixed id, created directly) ──────────
    await this.createNoticeDirect(
      manufacturer.id,
      vaccineProduct.id,
      vaccineBatch.id,
      [distributor.id, hospital.id],
    );
    await this.backdateNotice(SEED_NOTICE_ID, 2);

    this.logger.log(
      `Seeded cases: vaccine ${vaccineCases.map((item) => item.id).join(', ')}; ` +
        `insulin ${insulinCases.map((item) => item.id).join(', ')}; ` +
        `content: ${[...vaccineContent.flat(), ...insulinContent.flat()]
          .map((item) => item.id)
          .join(', ')}`,
    );
  }

  /** G9: each case holds a few units of content, each its own EPC. */
  private async seedContentUnits(
    actorId: string,
    productId: string,
    batchId: string,
  ): Promise<{ id: string }[]> {
    const units: { id: string }[] = [];
    for (let i = 0; i < CONTENT_UNITS_PER_CASE; i += 1) {
      units.push(
        await this.eventLedgerService.commission(actorId, {
          productId,
          batchId,
        }),
      );
    }
    return units;
  }

  private async seedActor(actorRepo: Repository<Actor>, seed: SeedActor) {
    const activities = await this.activityTypesService.findWithOperationsByCodes(
      [seed.activityCode],
    );

    const actor = await actorRepo.save(
      actorRepo.create({
        name: seed.name,
        organizationNumber: seed.organizationNumber,
        status: ActorStatus.APPROVED,
        activities,
      }),
    );

    await this.usersService.createUser({
      email: seed.email,
      password: SEED_PASSWORD,
      fullName: seed.fullName,
      actorId: actor.id,
      platformRoles: [PlatformRole.USER],
      roles: [UserRole.OWNER],
      status: UserStatus.ACTIVE,
    });

    return actor;
  }

  private async reassignEpcIds(
    epcs: { id: string }[],
    targetIds: readonly string[],
  ): Promise<void> {
    if (epcs.length !== targetIds.length) {
      return;
    }
    for (let i = 0; i < epcs.length; i += 1) {
      const fromId = epcs[i].id;
      const toId = targetIds[i];
      if (fromId === toId) {
        continue;
      }
      // The epcs.id rename and event_epcs.epc_id update cannot be done in two
      // statements (the FK is violated in the intermediate state), so both
      // happen inside one transaction with the constraint relaxed.
      await this.dataSource.transaction(async (manager) => {
        const rows = (await manager.query(
          `select conname
             from pg_constraint
            where conrelid = 'public.event_epcs'::regclass
              and confrelid = 'public.epcs'::regclass
              and contype = 'f'`,
        )) as { conname: string }[];
        const constraint = rows[0].conname;
        await manager.query(
          `alter table event_epcs drop constraint "${constraint}"`,
        );
        await manager.query(
          `update epcs set id = $2 where id = $1`,
          [fromId, toId],
        );
        await manager.query(
          `update event_epcs set epc_id = $2 where epc_id = $1`,
          [fromId, toId],
        );
        await manager.query(
          `alter table event_epcs
             add constraint "${constraint}" foreign key (epc_id) references epcs (id)`,
        );
      });
      await this.dataSource.query(
        `update ledger_events
           set payload = jsonb_set(payload, '{epcList}', to_jsonb(array[$2::text]))
         where payload -> 'epcList' @> to_jsonb(array[$1::text])`,
        [fromId, toId],
      );
      await this.dataSource.query(
        `update ledger_events
           set payload = jsonb_set(
                 payload, '{inputEPCList}',
                 (select to_jsonb(array_agg(
                           case when e = to_jsonb($1::text) then to_jsonb($2::text) else e end
                         ))
                    from jsonb_array_elements(payload -> 'inputEPCList') e)
               )
         where payload -> 'inputEPCList' @> to_jsonb(array[$1::text])`,
        [fromId, toId],
      );
      await this.dataSource.query(
        `update ledger_events
           set payload = jsonb_set(
                 payload, '{outputEPCList}',
                 (select to_jsonb(array_agg(
                           case when e = to_jsonb($1::text) then to_jsonb($2::text) else e end
                         ))
                    from jsonb_array_elements(payload -> 'outputEPCList') e)
               )
         where payload -> 'outputEPCList' @> to_jsonb(array[$1::text])`,
        [fromId, toId],
      );
      epcs[i].id = toId;
    }
  }

  // Creates the advisory directly with a fixed id so UI deep links stay valid,
  // instead of calling the service and then renaming the generated id (which
  // would race with the child rows' foreign keys).
  private async createNoticeDirect(
    actorId: string,
    productId: string,
    batchId: string,
    ackActorIds: string[],
  ): Promise<void> {
    const affectedEpcIds = [
      SEED_EPC_IDS.vaccine[0],
      SEED_EPC_IDS.vaccine[1],
    ];
    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        manager.create(ProductNotice, {
          id: SEED_NOTICE_ID,
          productId,
          batchId,
          type: NoticeType.RECALL,
          title: 'Retiro preventivo — desviación de temperatura LOTE-VAC-2026-1117-A',
          description:
            'Durante el transporte se registró una excursión de temperatura en ' +
              'el lote LOTE-VAC-2026-1117-A. Las cajas afectadas identificadas ' +
              'por EPC deben retirarse y devolverse al laboratorio. Los pallets ' +
              'no están serializados: la trazabilidad se hace caja por caja.',
          createdByActorId: actorId,
        }),
      );
      await manager.save(
        affectedEpcIds.map((epcId) =>
          manager.create(ProductNoticeEpc, { noticeId: SEED_NOTICE_ID, epcId }),
        ),
      );
      await manager.save(
        ackActorIds.map((ackActorId) =>
          manager.create(ProductNoticeAck, {
            noticeId: SEED_NOTICE_ID,
            actorId: ackActorId,
          }),
        ),
      );
    });
  }

  private async backdateActors(entries: { id: string; days: number }[]) {
    for (const entry of entries) {
      await this.dataSource.query(
        'update actors set "createdAt" = $1, "updatedAt" = $1 where id = $2',
        [daysAgo(entry.days), entry.id],
      );
    }
  }

  private async backdateUsers(emails: string[], days: number) {
    await this.dataSource.query(
      'update users set "createdAt" = $1, "updatedAt" = $1 where email = any($2)',
      [daysAgo(days), emails],
    );
  }

  private async backdateEpcEvents(entries: { ids: string[]; days: number }[]) {
    for (const entry of entries) {
      await this.dataSource.query(
        `update ledger_events l
           set event_time = l.event_time - make_interval(days => $2)
           from event_epcs e
          where e.event_id = l.id and e.epc_id = any($1)`,
        [entry.ids, entry.days],
      );
    }
  }

  private async backdateTwin(entries: { id: string; days: number }[]) {
    for (const entry of entries) {
      await this.dataSource.query(
        'update epcs set commissioned_at = $1 where id = $2',
        [daysAgo(entry.days), entry.id],
      );
    }
  }

  private async backdateNotice(noticeId: string, days: number) {
      await this.dataSource.query(
        'update product_notices set created_at = $1 where id = $2',
        [daysAgo(days), noticeId],
      );
      await this.dataSource.query(
        'update product_notice_acks set acknowledged_at = $1 where notice_id = $2',
        [daysAgo(days - 1), noticeId],
      );
  }
}

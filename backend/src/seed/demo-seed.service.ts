import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { ProductNotice } from '../notices/entities/product-notice.entity.js';
import { ProductNoticeEpc } from '../notices/entities/product-notice-epc.entity.js';
import { ProductNoticeAck } from '../notices/entities/product-notice-ack.entity.js';
import { NoticeType } from '../notices/enums/notice-type.enum.js';

export const DEMO_PASSWORD = 'Demo1234';

// Deterministic ids so UI deep links and documentation stay valid on any seed.
export const DEMO_IDS = {
  greenProduct: 'af1e073a-0216-4288-8b90-adc3639fe2c7',
  greenBatch: '1f0e9d8c-7b6a-4534-2910-f8e7d6c5b4a3',
  roastedProduct: '6b76c49e-de79-45ea-9e84-78bb737d4453',
  roastedBatch: '2a1b8c7d-6e5f-4423-1809-e7d6c5b4a3f2',
  notice: '9fe65a02-0b8c-4a02-8afc-726d0ed00c8a',
} as const;

export const DEMO_EPC_IDS = {
  green: [
    'urn:nodoo:epc:236af542-6576-4e2f-987f-5239e1f3c3fe',
    'urn:nodoo:epc:6f5b5502-54f5-44a8-b0fb-493aedba7592',
    'urn:nodoo:epc:c629e5de-acc8-4fd7-88e8-4830d3018eda',
  ],
  roasted: [
    'urn:nodoo:epc:d71dd322-2b92-4a06-a4eb-8a1b43efecc0',
    'urn:nodoo:epc:7833feff-792d-4be1-bfa7-e376505c9a9d',
  ],
} as const;

export const DEMO_NOTICE_ID = DEMO_IDS.notice;

interface DemoActor {
  name: string;
  organizationNumber: string;
  activityCode: string;
  email: string;
  fullName: string;
}

const DEMO_ACTORS: DemoActor[] = [
  {
    name: 'Finca El Roble',
    organizationNumber: 'NIT-901020301',
    activityCode: 'supplier',
    email: 'finca@demo.nodoo.local',
    fullName: 'Rosa Camargo',
  },
  {
    name: 'Tostaduría Aroma',
    organizationNumber: 'NIT-901020302',
    activityCode: 'manufacturer',
    email: 'tostaduria@demo.nodoo.local',
    fullName: 'Luis Pardo',
  },
  {
    name: 'Distribuciones Andina',
    organizationNumber: 'NIT-901020303',
    activityCode: 'wholesaler',
    email: 'distribuciones@demo.nodoo.local',
    fullName: 'Marta Salinas',
  },
  {
    name: 'Cafeterías La Vela',
    organizationNumber: 'NIT-901020304',
    activityCode: 'retailer',
    email: 'caferias@demo.nodoo.local',
    fullName: 'Diego Fuentes',
  },
];

const DEMO_EMAILS = DEMO_ACTORS.map((actor) => actor.email);

const daysAgo = (days: number, hour = 10, minute = 0): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
};

@Injectable()
export class DemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly activityTypesService: ActivityTypesService,
    private readonly usersService: UsersService,
    private readonly eventLedgerService: EventLedgerService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('DEMO_SEED')) {
      return;
    }

    try {
      await this.run();
      this.logger.log(
        `Demo seed ready. ${DEMO_ACTORS.length} organizations, ` +
          `password "${DEMO_PASSWORD}" for all demo emails.`,
      );
    } catch (error) {
      this.logger.error(
        `Demo seed failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }

  private async run(): Promise<void> {
    const actorRepo = this.dataSource.getRepository(Actor);

    const hasDemoActors = (await actorRepo.find()).some((actor) =>
      DEMO_ACTORS.some((demo) => demo.name === actor.name),
    );
    if (hasDemoActors || (await this.usersService.findByEmail(DEMO_EMAILS[0]))) {
      this.logger.log('Demo seed already present, skipping.');
      return;
    }

    // ── Organizations and owners ────────────────────────────────────────────
    const supplier = await this.seedActor(actorRepo, DEMO_ACTORS[0]);
    const manufacturer = await this.seedActor(actorRepo, DEMO_ACTORS[1]);
    const wholesaler = await this.seedActor(actorRepo, DEMO_ACTORS[2]);
    const retailer = await this.seedActor(actorRepo, DEMO_ACTORS[3]);

    // ── Catalog (fixed ids so UI deep links stay valid across seeds) ────────
    const productRepo = this.dataSource.getRepository(Product);
    const batchRepo = this.dataSource.getRepository(Batch);

    const greenProduct = await productRepo.save(
      productRepo.create({
        id: DEMO_IDS.greenProduct,
        createdByActorId: supplier.id,
        sku: 'CAFE-VERDE-1KG',
        name: 'Café verde 1kg',
      }),
    );
    const greenBatch = await batchRepo.save(
      batchRepo.create({
        id: DEMO_IDS.greenBatch,
        productId: greenProduct.id,
        batchCode: 'GRN-2026-1117',
      }),
    );

    const roastedProduct = await productRepo.save(
      productRepo.create({
        id: DEMO_IDS.roastedProduct,
        createdByActorId: manufacturer.id,
        sku: 'CAFE-TOSTADO-500G',
        name: 'Café tostado 500g',
      }),
    );
    const roastedBatch = await batchRepo.save(
      batchRepo.create({
        id: DEMO_IDS.roastedBatch,
        productId: roastedProduct.id,
        batchCode: 'RST-2026-1117-A',
      }),
    );

    // ── Ledger story ─────────────────────────────────────────────────────────
    // Supplier commissions three 1kg bags of green beans, ships each one to
    // the roaster and invoices them over.
    const bagA = await this.eventLedgerService.commission(supplier.id, {
      productId: greenProduct.id,
      batchId: greenBatch.id,
    });
    const bagB = await this.eventLedgerService.commission(supplier.id, {
      productId: greenProduct.id,
      batchId: greenBatch.id,
    });
    const bagC = await this.eventLedgerService.commission(supplier.id, {
      productId: greenProduct.id,
      batchId: greenBatch.id,
    });

    for (const bag of [bagA, bagB, bagC]) {
      await this.eventLedgerService.ship(supplier.id, bag.id);
      await this.eventLedgerService.invoice(supplier.id, bag.id, {
        bizTransactionId: 'INV-2026-0001',
        ownershipTransferTo: manufacturer.id,
      });
      await this.eventLedgerService.receive(manufacturer.id, bag.id);
    }

    // ── Deterministic ids so UI deep links stay valid across seeds ─────────
    await this.reassignEpcIds([bagA, bagB, bagC], DEMO_EPC_IDS.green);

    // Roaster transforms the three bags into two 500g roasted packs.
    const [roasted1, roasted2] = await this.eventLedgerService.transform(
      manufacturer.id,
      {
        inputEpcs: [
          DEMO_EPC_IDS.green[0],
          DEMO_EPC_IDS.green[1],
          DEMO_EPC_IDS.green[2],
        ],
        outputProductId: roastedProduct.id,
        outputBatchId: roastedBatch.id,
        outputCount: 2,
      },
    );

    await this.reassignEpcIds([roasted1, roasted2], DEMO_EPC_IDS.roasted);

    // Roaster ships both packs to the wholesaler and invoices them over.
    for (const pack of [roasted1, roasted2]) {
      await this.eventLedgerService.ship(manufacturer.id, pack.id);
      await this.eventLedgerService.invoice(manufacturer.id, pack.id, {
        bizTransactionId: 'INV-2026-0002',
        ownershipTransferTo: wholesaler.id,
      });
      await this.eventLedgerService.receive(wholesaler.id, pack.id);
    }

    // Wholesaler forwards one pack to the café and invoices it over.
    await this.eventLedgerService.ship(wholesaler.id, roasted1.id);
    await this.eventLedgerService.invoice(wholesaler.id, roasted1.id, {
      bizTransactionId: 'INV-2026-0003',
      ownershipTransferTo: retailer.id,
    });
    await this.eventLedgerService.receive(retailer.id, roasted1.id);

    // ── Backdate so the story reads like real history ──────────────────────
    await this.backdateActors([
      { id: supplier.id, days: 40 },
      { id: manufacturer.id, days: 39 },
      { id: wholesaler.id, days: 38 },
      { id: retailer.id, days: 37 },
    ]);
    await this.backdateUsers(DEMO_EMAILS, 39);
    await this.backdateEpcEvents([
      { ids: [bagA.id, bagB.id, bagC.id], days: 36 },
      { ids: [roasted1.id, roasted2.id], days: 30 },
    ]);
    await this.backdateTwin([
      { id: bagA.id, days: 36 },
      { id: bagB.id, days: 36 },
      { id: bagC.id, days: 36 },
      { id: roasted1.id, days: 30 },
      { id: roasted2.id, days: 30 },
    ]);

    // ── Advisory with acknowledgements (fixed id, created directly) ────────
    await this.createNoticeDirect(
      manufacturer.id,
      roastedProduct.id,
      roastedBatch.id,
      [wholesaler.id, retailer.id],
    );
    await this.backdateNotice(DEMO_NOTICE_ID, 2);

    this.logger.log(
      `Demo EPCs: green ${bagA.id}, roasted ${roasted1.id}, ${roasted2.id}`,
    );
  }

  private async seedActor(actorRepo: Repository<Actor>, demo: DemoActor) {
    const activities = await this.activityTypesService.findWithOperationsByCodes(
      [demo.activityCode],
    );

    const actor = await actorRepo.save(
      actorRepo.create({
        name: demo.name,
        organizationNumber: demo.organizationNumber,
        status: ActorStatus.APPROVED,
        activities,
      }),
    );

    await this.usersService.createUser({
      email: demo.email,
      password: DEMO_PASSWORD,
      fullName: demo.fullName,
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
    const roastedEpcIds = [DEMO_EPC_IDS.roasted[0], DEMO_EPC_IDS.roasted[1]];
    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        manager.create(ProductNotice, {
          id: DEMO_NOTICE_ID,
          productId,
          batchId,
          type: NoticeType.ADVISORY,
          title: 'Aviso de control de humedad — lote RST-2026-1117-A',
          description:
            'Una auditoría rutinaria de humedad detectó un lote fuera del rango ' +
              'objetivo. Los lotes afectados deben resecarse antes de continuar ' +
              'su distribución. No se espera riesgo para la salud del consumidor.',
          createdByActorId: actorId,
        }),
      );
      await manager.save(
        roastedEpcIds.map((epcId) =>
          manager.create(ProductNoticeEpc, { noticeId: DEMO_NOTICE_ID, epcId }),
        ),
      );
      await manager.save(
        ackActorIds.map((ackActorId) =>
          manager.create(ProductNoticeAck, {
            noticeId: DEMO_NOTICE_ID,
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

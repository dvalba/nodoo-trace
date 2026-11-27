import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { ActivityTypesService } from '../src/activity-types/activity-types.service.js';
import { Actor } from '../src/actor/entities/actor.entity.js';
import { ActorStatus } from '../src/actor/enums/actor-status.enum.js';
import { PlatformRole, UserRole } from '../src/users/enums/roles.enum.js';
import { UserStatus } from '../src/users/enums/user-status.enum.js';
import { UsersService } from '../src/users/users.service.js';

const PASSWORD = 'Password123';
const prefix = '/api/v1';

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`./fixtures/epcis/${name}`, import.meta.url)),
      'utf8',
    ),
  );

// EPC identifiers of the real fixtures (unchanged documents).
const SGTIN_2017 = 'urn:epc:id:sgtin:0614141.107346.2017';
const SGTIN_2018 = 'urn:epc:id:sgtin:0614141.107346.2018';
const SSCC = 'urn:epc:id:sscc:0614141.1234567890';
const T_INPUT_1 = 'urn:epc:id:sgtin:4012345.011122.25';
const T_OUTPUT_1 = 'urn:epc:id:sgtin:4012345.077889.25';
const GRAI = 'urn:epc:id:grai:4012345.55555.987';
const GSRN = 'urn:epc:id:gsrn:95252084.000000001';
const GIAI_W2 = 'urn:epc:id:giai:952005385.w2';
const HTTPS_EPC = 'https://id.example.com/8003/030013450007718765';
const COMB_PARENT = 'urn:epc:id:sgtin:952001.1012345.22222223333';
const COMB_CHILD = 'urn:epc:id:sgtin:9520001.012346.10000001001';

const OBJECT_EVENT_UID =
  'ni:///sha-256;df7bb3c352fef055578554f09f5e2aa41782150ced7bd0b8af24dd3ccb30ba69?ver=CBV2.0';

/**
 * US15 e2e: third-party ingestion of REAL EPCIS 2.0 documents (fixtures in
 * test/fixtures/epcis, downloaded unmodified from the EPCIS community and
 * pushed as-is through the capture endpoint).
 */
describe('EPCIS 2.0 capture ingestion (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let ds: DataSource;

  const suffix = Date.now().toString();
  const actorIds: string[] = [];
  const emails: string[] = [];
  const productIds: string[] = [];
  const syntheticEpcs: string[] = [];

  let actorA: string;
  let tokenA: string;
  let tokenB: string;
  let productA: string;
  let productB: string;

  const authorized = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  async function seedActor(label: string, email: string) {
    const activities =
      await app.get(ActivityTypesService).findAllWithOperations();
    const actor = await ds.getRepository(Actor).save({
      name: `E2E ingest ${label} ${suffix}`,
      status: ActorStatus.APPROVED,
      activities,
    });
    actorIds.push(actor.id);

    await app.get(UsersService).createUser({
      email,
      password: PASSWORD,
      fullName: `E2E ingest ${label}`,
      actorId: actor.id,
      platformRoles: [PlatformRole.USER],
      roles: [UserRole.OWNER],
      status: UserStatus.ACTIVE,
    });
    emails.push(email);

    return actor.id;
  }

  async function login(email: string) {
    const response = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(201);

    return response.body.accessToken as string;
  }

  async function externalEventCount(): Promise<number> {
    const rows = await ds.query(
      `select count(*)::int as n from ledger_events where source = 'external'`,
    );
    return rows[0].n as number;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer();
    ds = app.get(DataSource);

    const ownerEmail = `ingest-owner-${suffix}@nodoo.test`;
    const unrelatedEmail = `ingest-unrelated-${suffix}@nodoo.test`;

    actorA = await seedActor('Owner', ownerEmail);
    await seedActor('Unrelated', unrelatedEmail);

    tokenA = await login(ownerEmail);
    tokenB = await login(unrelatedEmail);

    const product = await request(server)
      .post(`${prefix}/products`)
      .set(authorized(tokenA))
      .send({ sku: `INGEST-A-${suffix}`, name: 'Ingest product A' })
      .expect(201);
    productA = product.body.id;
    productIds.push(productA);

    const product2 = await request(server)
      .post(`${prefix}/products`)
      .set(authorized(tokenA))
      .send({ sku: `INGEST-B-${suffix}`, name: 'Ingest product B' })
      .expect(201);
    productB = product2.body.id;
    productIds.push(productB);
  }, 60000);

  afterAll(async () => {
    try {
      // Every EPC id referenced by any of the real fixtures.
      const fixtureEpcs = new Set<string>();
      for (const name of [
        'ObjectEvent.json',
        'AggregationEvent.json',
        'TransformationEvent.json',
        'AssociationEvent.json',
        'TransactionEvent.json',
        'Combination_of_different_event.json',
      ]) {
        const eventList = fixture(name).epcisBody.eventList;
        for (const event of eventList) {
          for (const field of [
            'epcList',
            'childEPCs',
            'inputEPCList',
            'outputEPCList',
          ]) {
            for (const id of event[field] ?? []) fixtureEpcs.add(id);
          }
          if (event.parentID) fixtureEpcs.add(event.parentID);
        }
      }
      const allEpcs = [...fixtureEpcs, ...syntheticEpcs];

      if (allEpcs.length > 0) {
        const events = await ds.query(
          'select distinct event_id::text as id from event_epcs where epc_id = any($1)',
          [allEpcs],
        );
        await ds.query('delete from event_epcs where epc_id = any($1)', [
          allEpcs,
        ]);
        if (events.length > 0) {
          await ds.query('delete from ledger_events where id::text = any($1)', [
            events.map((row: { id: string }) => row.id),
          ]);
        }
        await ds.query('delete from epcs where id = any($1)', [allEpcs]);
      }
      if (productIds.length > 0) {
        await ds.query('delete from products where id = any($1)', [productIds]);
      }
      if (actorIds.length > 0) {
        await ds.query('delete from users where "actorId" = any($1)', [actorIds]);
        await ds.query('delete from actor_activities where "actorId" = any($1)', [
          actorIds,
        ]);
        await ds.query('delete from actors where id = any($1)', [actorIds]);
      }
    } finally {
      await app.close();
    }
  }, 60000);

  it('rejects unauthenticated capture requests', async () => {
    await request(server)
      .post(`${prefix}/epcis/capture`)
      .send(fixture('ObjectEvent.json'))
      .expect(401);
  });

  it('rejects a raw document referencing uncommissioned EPCs without owners (FR-2005, no partial effects)', async () => {
    const before = await externalEventCount();

    // The real document, pushed verbatim, without any epcMapping.
    const response = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send(fixture('ObjectEvent.json'))
      .expect(400);
    expect(response.body.message).toContain('without an owner in epcMapping');
    expect(response.body.message).toContain(SGTIN_2017);

    expect(await externalEventCount()).toBe(before);
    await request(server)
      .get(`${prefix}/epcs/${SGTIN_2017}`)
      .set(authorized(tokenA))
      .expect(404);
  });

  it('rejects a wrapper whose epcMapping is missing an uncommissioned EPC (FR-2005, no partial effects)', async () => {
    const first = `urn:nodoo:e2e:${suffix}:0001`;
    const second = `urn:nodoo:e2e:${suffix}:0002`;
    syntheticEpcs.push(first, second);

    const document = {
      type: 'EPCISDocument',
      schemaVersion: '2.0',
      epcisBody: {
        eventList: [
          {
            type: 'ObjectEvent',
            eventTime: new Date().toISOString(),
            action: 'OBSERVE',
            epcList: [first, second],
          },
        ],
      },
    };

    // Only one of the two uncommissioned EPCs comes with its owner.
    const response = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send({
        document,
        epcMapping: { [first]: { ownerActorId: actorA, productId: productA } },
      })
      .expect(400);
    expect(response.body.message).toContain(second);

    // No partial effect: neither EPC was created.
    await request(server)
      .get(`${prefix}/epcs/${first}`)
      .set(authorized(tokenA))
      .expect(404);
  });

  it('imports an ObjectEvent document: creates the EPCs with the passed owner, external source, local projection (FR-2001/2003/2004/2005)', async () => {
    const response = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send({
        document: fixture('ObjectEvent.json'),
        epcMapping: {
          [SGTIN_2017]: { ownerActorId: actorA, productId: productA },
          [SGTIN_2018]: { ownerActorId: actorA, productId: productA },
        },
      })
      .expect(201);
    expect(response.body).toEqual({ imported: 2, skipped: 0, epcsCreated: 2 });

    // FR-2005: the EPCs exist with the owner passed in the request.
    const twin2018 = await request(server)
      .get(`${prefix}/epcs/${SGTIN_2018}`)
      .set(authorized(tokenA))
      .expect(200);
    expect(twin2018.body.ownerActorId).toBe(actorA);
    // FR-2004: the receiving event (second in the document) made the caller
    // the custodian and the case active.
    expect(twin2018.body.custodianActorId).toBe(actorA);
    expect(twin2018.body.status).toBe('active');

    // The first event (shipping) left 2017 in transit.
    const twin2017 = await request(server)
      .get(`${prefix}/epcs/${SGTIN_2017}`)
      .set(authorized(tokenA))
      .expect(200);
    expect(twin2017.body.status).toBe('in_transit');

    // FR-2003: the history entries are external, with the document eventIDs
    // as eventUid, and the raw event as payload.
    const history2017 = await request(server)
      .get(`${prefix}/epcs/${SGTIN_2017}/history`)
      .set(authorized(tokenA))
      .expect(200);
    expect(history2017.body).toHaveLength(1);
    expect(history2017.body[0].source).toBe('external');
    expect(history2017.body[0].eventUid).toBe(OBJECT_EVENT_UID);
    expect(history2017.body[0].bizStep).toBe('shipping');
    expect(history2017.body[0].actorId).toBe(actorA);
    expect(history2017.body[0].payload['bizTransactionList']).toHaveLength(1);

    const history2018 = await request(server)
      .get(`${prefix}/epcs/${SGTIN_2018}/history`)
      .set(authorized(tokenA))
      .expect(200);
    expect(history2018.body).toHaveLength(2);
    expect(history2018.body.map((entry: { bizStep: string }) => entry.bizStep)).toEqual([
      'shipping',
      'receiving',
    ]);
    // Vendor extensions survive verbatim in the stored payload.
    expect(history2018.body[1].payload['example:myField']).toBe(
      'Example of a vendor/user extension',
    );
  });

  it('ignores a re-pushed document by eventUid (FR-2002, idempotent)', async () => {
    const response = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send({
        document: fixture('ObjectEvent.json'),
        epcMapping: {
          [SGTIN_2017]: { ownerActorId: actorA, productId: productA },
          [SGTIN_2018]: { ownerActorId: actorA, productId: productA },
        },
      })
      .expect(201);
    expect(response.body).toEqual({ imported: 0, skipped: 2, epcsCreated: 0 });

    const history2017 = await request(server)
      .get(`${prefix}/epcs/${SGTIN_2017}/history`)
      .set(authorized(tokenA))
      .expect(200);
    expect(history2017.body).toHaveLength(1);
  });

  it('imports an AggregationEvent document: OBSERVE projects exactly as a local OBSERVE (FR-2004)', async () => {
    const response = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send({
        document: fixture('AggregationEvent.json'),
        // The children are already commissioned; only the parent needs an owner.
        epcMapping: {
          [SSCC]: { ownerActorId: actorA, productId: productA },
        },
      })
      .expect(201);
    expect(response.body).toEqual({ imported: 1, skipped: 0, epcsCreated: 1 });

    // FR-2005: the parent EPC was created with the mapped owner.
    const parent = await request(server)
      .get(`${prefix}/epcs/${SSCC}`)
      .set(authorized(tokenA))
      .expect(200);
    expect(parent.body.ownerActorId).toBe(actorA);

    // FR-2004: the fixture action is OBSERVE, and the local rules only link
    // or unlink the parent on ADD/DELETE — so the children keep their state.
    const twin = await request(server)
      .get(`${prefix}/epcs/${SGTIN_2017}`)
      .set(authorized(tokenA))
      .expect(200);
    expect(twin.body.parentId).toBeNull();
  });

  it('imports a TransformationEvent document: consumes inputs, creates outputs of the mapped product (FR-2004/2005)', async () => {
    const response = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send({
        document: fixture('TransformationEvent.json'),
        epcMapping: {
          [T_INPUT_1]: { ownerActorId: actorA, productId: productA },
          'urn:epc:id:sgtin:4000001.065432.99886655': {
            ownerActorId: actorA,
            productId: productA,
          },
          [T_OUTPUT_1]: { ownerActorId: actorA, productId: productB },
          'urn:epc:id:sgtin:4012345.077889.26': {
            ownerActorId: actorA,
            productId: productB,
          },
          'urn:epc:id:sgtin:4012345.077889.27': {
            ownerActorId: actorA,
            productId: productB,
          },
          'urn:epc:id:sgtin:4012345.077889.28': {
            ownerActorId: actorA,
            productId: productB,
          },
        },
      })
      .expect(201);
    expect(response.body).toEqual({ imported: 1, skipped: 0, epcsCreated: 6 });

    const input = await request(server)
      .get(`${prefix}/epcs/${T_INPUT_1}`)
      .set(authorized(tokenA))
      .expect(200);
    expect(input.body.status).toBe('consumed');

    const output = await request(server)
      .get(`${prefix}/epcs/${T_OUTPUT_1}`)
      .set(authorized(tokenA))
      .expect(200);
    expect(output.body.status).toBe('active');
    expect(output.body.ownerActorId).toBe(actorA);
    expect(output.body.productId).toBe(productB);
  });

  it('imports an AssociationEvent document without eventIDs and dedupes the re-push by derived uid (FR-2002)', async () => {
    const mapping = {
      [GRAI]: { ownerActorId: actorA, productId: productA },
      'urn:epc:id:grai:4012345.55555.98765': {
        ownerActorId: actorA,
        productId: productA,
      },
      'urn:epc:id:giai:4000001.12345': {
        ownerActorId: actorA,
        productId: productA,
      },
      'urn:epc:id:giai:4000001.12346': {
        ownerActorId: actorA,
        productId: productA,
      },
    };

    const response = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send({ document: fixture('AssociationEvent.json'), epcMapping: mapping })
      .expect(201);
    expect(response.body).toEqual({ imported: 2, skipped: 0, epcsCreated: 4 });

    const again = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send({ document: fixture('AssociationEvent.json'), epcMapping: mapping })
      .expect(201);
    expect(again.body).toEqual({ imported: 0, skipped: 2, epcsCreated: 0 });
  });

  it('imports a TransactionEvent document with non-local vocabulary (FR-2001)', async () => {
    const response = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send({
        document: fixture('TransactionEvent.json'),
        epcMapping: {
          [GSRN]: { ownerActorId: actorA, productId: productA },
          [GIAI_W2]: { ownerActorId: actorA, productId: productA },
        },
      })
      .expect(201);
    expect(response.body).toEqual({ imported: 2, skipped: 0, epcsCreated: 2 });

    // The non-local business transaction type (a 33-char URI) is stored
    // verbatim; the type-less entry of the first event keeps a null type.
    const rows = await ds.query(
      `select "biz_transaction_type" as t, "biz_transaction_id" as id, source from ledger_events where source = 'external' and "biz_transaction_id" in ($1, $2) order by "event_time" asc`,
      [
        'urn:epc:id:gdti:95252084.0001.0003555480001000',
        'http://transaction.examplerail.com/passage/xyz12345',
      ],
    );
    expect(rows).toHaveLength(2);
    // The rail event (2014) precedes the GDTI one (2019) in event time.
    expect(rows[0].t).toBe('urn:gs1:epcisapp:rail:btt:passage');
    expect(rows[0].id).toBe('http://transaction.examplerail.com/passage/xyz12345');
    expect(rows[1].t).toBeNull();
    expect(rows[1].id).toBe('urn:epc:id:gdti:95252084.0001.0003555480001000');
    expect(rows[0].source).toBe('external');
  });

  it('imports the combination document mixing all event types (FR-2001)', async () => {
    const response = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send({
        document: fixture('Combination_of_different_event.json'),
        // Only the EPCs not yet commissioned need an owner.
        epcMapping: {
          [HTTPS_EPC]: { ownerActorId: actorA, productId: productA },
          [COMB_PARENT]: { ownerActorId: actorA, productId: productA },
          [COMB_CHILD]: { ownerActorId: actorA, productId: productA },
        },
      })
      .expect(201);
    expect(response.body).toEqual({ imported: 6, skipped: 0, epcsCreated: 3 });
  });

  it('rejects invalid EPCIS documents with 400 and no partial effects', async () => {
    const before = await externalEventCount();

    await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send(fixture('invalid/EPCISDocument_with_invalid_schemaVersion.json'))
      .expect(400);
    const badAction = await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send(fixture('invalid/ObjectEvent_with_invalid_action.json'))
      .expect(400);
    expect(badAction.body.message).toContain('invalid action: CREATE');
    await request(server)
      .post(`${prefix}/epcis/capture`)
      .set(authorized(tokenA))
      .send(fixture('invalid/ObjectEvent_without_identifier_list.json'))
      .expect(400);

    expect(await externalEventCount()).toBe(before);
  });

  it('hides imported EPCs from unrelated organizations (FR-D2)', async () => {
    await request(server)
      .get(`${prefix}/epcs/${SGTIN_2017}`)
      .set(authorized(tokenB))
      .expect(404);
    await request(server)
      .get(`${prefix}/epcs/${SGTIN_2017}/history`)
      .set(authorized(tokenB))
      .expect(404);
  });
});

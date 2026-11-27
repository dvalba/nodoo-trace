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

describe('Traceability API (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let ds: DataSource;

  const suffix = Date.now().toString();
  const actorIds: string[] = [];
  const emails: string[] = [];
  const productIds: string[] = [];
  const batchIds: string[] = [];
  const epcIds: string[] = [];
  const noticeIds: string[] = [];

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let actorB: string;

  let productId: string;
  let batchId: string;
  let shippedEpc: string;
  let inTransitEpc: string;
  let destEpc: string;
  let noticeId: string;

  const authorized = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  async function seedActor(label: string, email: string) {
    const activities =
      await app.get(ActivityTypesService).findAllWithOperations();
    const actor = await ds.getRepository(Actor).save({
      name: `E2E ${label} ${suffix}`,
      status: ActorStatus.APPROVED,
      activities,
    });
    actorIds.push(actor.id);

    await app.get(UsersService).createUser({
      email,
      password: PASSWORD,
      fullName: `E2E ${label}`,
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

    const ownerEmail = `e2e-owner-${suffix}@nodoo.test`;
    const partnerEmail = `e2e-partner-${suffix}@nodoo.test`;
    const unrelatedEmail = `e2e-unrelated-${suffix}@nodoo.test`;

    await seedActor('Owner', ownerEmail);
    actorB = await seedActor('Partner', partnerEmail);
    await seedActor('Unrelated', unrelatedEmail);

    tokenA = await login(ownerEmail);
    tokenB = await login(partnerEmail);
    tokenC = await login(unrelatedEmail);
  }, 60000);

  afterAll(async () => {
    try {
      if (noticeIds.length > 0) {
        await ds.query('delete from product_notice_acks where notice_id = any($1)', [
          noticeIds,
        ]);
        await ds.query('delete from product_notice_epcs where notice_id = any($1)', [
          noticeIds,
        ]);
        await ds.query('delete from product_notices where id = any($1)', [noticeIds]);
      }
      if (epcIds.length > 0) {
        const events = await ds.query(
          'select distinct event_id::text as id from event_epcs where epc_id = any($1)',
          [epcIds],
        );
        await ds.query('delete from event_epcs where epc_id = any($1)', [epcIds]);
        if (events.length > 0) {
          await ds.query('delete from ledger_events where id::text = any($1)', [
            events.map((row: { id: string }) => row.id),
          ]);
        }
        await ds.query('delete from epcs where id = any($1)', [epcIds]);
      }
      if (batchIds.length > 0) {
        await ds.query('delete from batches where id = any($1)', [batchIds]);
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

  it('rejects unauthenticated requests', async () => {
    await request(server).get(`${prefix}/epcs/unknown`).expect(401);
  });

  it('creates the product and its batch', async () => {
    const product = await request(server)
      .post(`${prefix}/products`)
      .set(authorized(tokenA))
      .send({ sku: `E2E-SKU-${suffix}`, name: 'E2E product' })
      .expect(201);

    productId = product.body.id;
    productIds.push(productId);

    const batch = await request(server)
      .post(`${prefix}/products/${productId}/batches`)
      .set(authorized(tokenA))
      .send({ batchCode: `E2E-LOT-${suffix}` })
      .expect(201);

    batchId = batch.body.id;
    batchIds.push(batchId);

    expect(product.body.sku).toBe(`E2E-SKU-${suffix}`);
    expect(batch.body.batchCode).toBe(`E2E-LOT-${suffix}`);
  });

  it('commissions, ships, invoices and receives an EPC over HTTP', async () => {
    const commissioned = await request(server)
      .post(`${prefix}/epcs`)
      .set(authorized(tokenA))
      .send({ productId, batchId })
      .expect(201);

    shippedEpc = commissioned.body.id;
    epcIds.push(shippedEpc);
    expect(commissioned.body).toMatchObject({
      productId,
      batchId,
      status: 'active',
      ownerActorId: actorIds[0],
      custodianActorId: actorIds[0],
    });

    const shipped = await request(server)
      .post(`${prefix}/epcs/${shippedEpc}/ship`)
      .set(authorized(tokenA))
      .send({ destinationActorId: actorB })
      .expect(201);
    expect(shipped.body.status).toBe('in_transit');

    const invoiced = await request(server)
      .post(`${prefix}/epcs/${shippedEpc}/invoice`)
      .set(authorized(tokenA))
      .send({
        bizTransactionId: `E2E-INV-${suffix}`,
        ownershipTransferTo: actorB,
      })
      .expect(201);
    expect(invoiced.body.ownerActorId).toBe(actorB);

    const received = await request(server)
      .post(`${prefix}/epcs/${shippedEpc}/receive`)
      .set(authorized(tokenB))
      .expect(201);
    expect(received.body).toMatchObject({
      status: 'active',
      ownerActorId: actorB,
      custodianActorId: actorB,
    });
  });

  it('exposes the EPC and its history only to related actors', async () => {
    // The owner reads the twin and the whole history.
    const twin = await request(server)
      .get(`${prefix}/epcs/${shippedEpc}`)
      .set(authorized(tokenB))
      .expect(200);
    expect(twin.body.id).toBe(shippedEpc);
    expect(twin.body.producerActorId).toBe(actorIds[0]);

    const history = await request(server)
      .get(`${prefix}/epcs/${shippedEpc}/history`)
      .set(authorized(tokenB))
      .expect(200);
    expect(history.body).toHaveLength(4);
    expect(history.body.map((entry: { bizStep: string | null }) => entry.bizStep)).toEqual([
      'commissioning',
      'shipping',
      null,
      'receiving',
    ]);

    // G11 (FR-D1, NFR-6): every local event persists a unique eventUid, so
    // external ingestion can dedupe by it (FR-2002).
    const uids = history.body.map(
      (entry: { eventUid: string | null }) => entry.eventUid,
    );
    expect(uids.every((uid: string | null) => typeof uid === 'string' && uid.length > 0)).toBe(
      true,
    );
    expect(new Set(uids).size).toBe(4);

    // FR-D6: a producer that is no longer the owner sees nothing (404,
    // never 403), even though it custodied the case at commissioning.
    await request(server)
      .get(`${prefix}/epcs/${shippedEpc}`)
      .set(authorized(tokenA))
      .expect(404);
    await request(server)
      .get(`${prefix}/epcs/${shippedEpc}/history`)
      .set(authorized(tokenA))
      .expect(404);

    // An unrelated organization gets 404 as well.
    await request(server)
      .get(`${prefix}/epcs/${shippedEpc}`)
      .set(authorized(tokenC))
      .expect(404);
    await request(server)
      .get(`${prefix}/epcs/${shippedEpc}/history`)
      .set(authorized(tokenC))
      .expect(404);
  });

  it('publishes a batch notice and tracks acknowledgements', async () => {
    const notice = await request(server)
      .post(`${prefix}/products/${productId}/notices`)
      .set(authorized(tokenA))
      .send({
        type: 'recall',
        title: 'E2E recall',
        description: 'E2E recall description',
        batchId,
      })
      .expect(201);

    noticeId = notice.body.id;
    noticeIds.push(noticeId);
    expect(notice.body).toMatchObject({ type: 'recall', batchId });

    const visible = await request(server)
      .get(`${prefix}/notices/${noticeId}`)
      .set(authorized(tokenB))
      .expect(200);
    expect(visible.body.id).toBe(noticeId);

    await request(server)
      .get(`${prefix}/notices/${noticeId}`)
      .set(authorized(tokenC))
      .expect(404);

    const firstAck = await request(server)
      .post(`${prefix}/notices/${noticeId}/ack`)
      .set(authorized(tokenB))
      .expect(201);
    const secondAck = await request(server)
      .post(`${prefix}/notices/${noticeId}/ack`)
      .set(authorized(tokenB))
      .expect(201);
    expect(secondAck.body.id).toBe(firstAck.body.id);

    const acks = await request(server)
      .get(`${prefix}/notices/${noticeId}/acks`)
      .set(authorized(tokenA))
      .expect(200);
    expect(acks.body).toHaveLength(1);
    expect(acks.body[0].actorId).toBe(actorB);

    // The partner custodies the affected batch, so it can also list acks.
    await request(server)
      .get(`${prefix}/notices/${noticeId}/acks`)
      .set(authorized(tokenB))
      .expect(200);

    // An unrelated actor cannot list the acknowledgements.
    await request(server)
      .get(`${prefix}/notices/${noticeId}/acks`)
      .set(authorized(tokenC))
      .expect(404);
  });

  it('rejects shipping a case that is already in transit (G4)', async () => {
    const commissioned = await request(server)
      .post(`${prefix}/epcs`)
      .set(authorized(tokenA))
      .send({ productId, batchId })
      .expect(201);
    inTransitEpc = commissioned.body.id;
    epcIds.push(inTransitEpc);

    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/ship`)
      .set(authorized(tokenA))
      .send({ destinationActorId: actorB })
      .expect(201);

    // The custodian of an in-transit case cannot ship it again.
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/ship`)
      .set(authorized(tokenA))
      .send({ destinationActorId: actorB })
      .expect(400);
  });

  it('only the destination of an in-transit case can receive it (G3)', async () => {
    // The owner/custodian is not the destination: 400.
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/receive`)
      .set(authorized(tokenA))
      .expect(400);

    // An unrelated organization has no relation: 404.
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/receive`)
      .set(authorized(tokenC))
      .expect(404);

    // The destination receives...
    const received = await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/receive`)
      .set(authorized(tokenB))
      .expect(201);
    expect(received.body).toMatchObject({
      status: 'active',
      ownerActorId: actorIds[0],
      custodianActorId: actorB,
      destinationActorId: null,
    });

    // ...and re-receiving an already-received case is rejected.
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/receive`)
      .set(authorized(tokenB))
      .expect(400);

    // A related non-destination actor (the owner) on a case without
    // destination is rejected too.
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/receive`)
      .set(authorized(tokenA))
      .expect(400);
  });

  it('serves the destination a scoped twin and no history until it receives (G1)', async () => {
    const commissioned = await request(server)
      .post(`${prefix}/epcs`)
      .set(authorized(tokenA))
      .send({ productId, batchId })
      .expect(201);
    destEpc = commissioned.body.id;
    epcIds.push(destEpc);

    await request(server)
      .post(`${prefix}/epcs/${destEpc}/ship`)
      .set(authorized(tokenA))
      .send({ destinationActorId: actorIds[2] })
      .expect(201);

    // The destination of an in-transit case reads only the EPC and its
    // product (FR-D5/FR-605).
    const scoped = await request(server)
      .get(`${prefix}/epcs/${destEpc}`)
      .set(authorized(tokenC))
      .expect(200);
    expect(scoped.body).toMatchObject({
      id: destEpc,
      productId,
      status: 'in_transit',
      destinationActorId: actorIds[2],
      ownerActorId: null,
      custodianActorId: null,
      producerActorId: null,
      batchId: null,
      parentId: null,
      commissionedAt: null,
    });
    expect(scoped.body.product).toMatchObject({ id: productId });
    expect(scoped.body.batch).toBeNull();

    // No history until the destination receives.
    await request(server)
      .get(`${prefix}/epcs/${destEpc}/history`)
      .set(authorized(tokenC))
      .expect(404);

    const received = await request(server)
      .post(`${prefix}/epcs/${destEpc}/receive`)
      .set(authorized(tokenC))
      .expect(201);
    expect(received.body).toMatchObject({
      status: 'active',
      custodianActorId: actorIds[2],
    });

    // The new custodian reads its custody window only (the receiving),
    // never the upstream chain.
    const window = await request(server)
      .get(`${prefix}/epcs/${destEpc}/history`)
      .set(authorized(tokenC))
      .expect(200);
    expect(window.body).toHaveLength(1);
    expect(window.body[0]).toMatchObject({
      bizStep: 'receiving',
      actorId: actorIds[2],
    });

    // The owner reads the whole chain.
    const full = await request(server)
      .get(`${prefix}/epcs/${destEpc}/history`)
      .set(authorized(tokenA))
      .expect(200);
    expect(
      full.body.map((entry: { bizStep: string | null }) => entry.bizStep),
    ).toEqual(['commissioning', 'shipping', 'receiving']);
  });

  it('lists only the EPCs of the caller scope (G1)', async () => {
    const listAs = async (token: string) => {
      const response = await request(server)
        .get(`${prefix}/epcs`)
        .set(authorized(token))
        .expect(200);
      return response.body as {
        id: string;
        producerActorId: string | null;
      }[];
    };

    // B owns shippedEpc and custodies inTransitEpc.
    const bList = await listAs(tokenB);
    const bIds = bList.map((epc) => epc.id);
    expect(bIds).toHaveLength(2);
    expect(bIds).toContain(shippedEpc);
    expect(bIds).toContain(inTransitEpc);
    expect(bIds).not.toContain(destEpc);
    // As custodian, the row never exposes the producer (FR-605).
    const custodyRow = bList.find((epc) => epc.id === inTransitEpc);
    expect(custodyRow?.producerActorId).toBeNull();
    // As owner, the row keeps the producer.
    const ownerRow = bList.find((epc) => epc.id === shippedEpc);
    expect(ownerRow?.producerActorId).toBe(actorIds[0]);

    // A owns inTransitEpc and destEpc but sees none of shippedEpc
    // (FR-D6: a producer that is no longer the owner sees nothing).
    const aIds = (await listAs(tokenA)).map((epc) => epc.id);
    expect(aIds).toHaveLength(2);
    expect(aIds).toContain(inTransitEpc);
    expect(aIds).toContain(destEpc);
    expect(aIds).not.toContain(shippedEpc);

    // C custodies destEpc only.
    const cIds = (await listAs(tokenC)).map((epc) => epc.id);
    expect(cIds).toHaveLength(1);
    expect(cIds).toContain(destEpc);
  });

  it('rejects aggregation that would create a descent (G5)', async () => {
    const commission = async () => {
      const response = await request(server)
        .post(`${prefix}/epcs`)
        .set(authorized(tokenA))
        .send({ productId, batchId })
        .expect(201);
      const id = response.body.id as string;
      epcIds.push(id);
      return id;
    };

    const parent = await commission();
    const mid = await commission();
    const leaf = await commission();

    // parent ⊃ mid ⊃ leaf.
    await request(server)
      .post(`${prefix}/epcs/${parent}/aggregate`)
      .set(authorized(tokenA))
      .send({ childEpcs: [mid] })
      .expect(201);
    await request(server)
      .post(`${prefix}/epcs/${mid}/aggregate`)
      .set(authorized(tokenA))
      .send({ childEpcs: [leaf] })
      .expect(201);

    // leaf is already a descendant of parent: 400.
    await request(server)
      .post(`${prefix}/epcs/${parent}/aggregate`)
      .set(authorized(tokenA))
      .send({ childEpcs: [leaf] })
      .expect(400);

    // The other direction would cycle too (parent is an ancestor of leaf): 400.
    await request(server)
      .post(`${prefix}/epcs/${leaf}/aggregate`)
      .set(authorized(tokenA))
      .send({ childEpcs: [parent] })
      .expect(400);
  });

  it('applies the issuer role of business documents (G10)', async () => {
    // inTransitEpc is owned by A and custodied by B.
    // PO: only a non-owner (the buyer) can issue it.
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/purchase-order`)
      .set(authorized(tokenA))
      .send({ bizTransactionId: `E2E-PO-${suffix}` })
      .expect(400);
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/purchase-order`)
      .set(authorized(tokenB))
      .send({ bizTransactionId: `E2E-PO-${suffix}` })
      .expect(201);

    // Despatch advice and bill of lading: only the current custodian.
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/despatch-advice`)
      .set(authorized(tokenA))
      .send({ bizTransactionId: `E2E-DA-${suffix}` })
      .expect(400);
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/despatch-advice`)
      .set(authorized(tokenB))
      .send({ bizTransactionId: `E2E-DA-${suffix}` })
      .expect(201);
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/bill-of-lading`)
      .set(authorized(tokenA))
      .send({ bizTransactionId: `E2E-BOL-${suffix}` })
      .expect(400);
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/bill-of-lading`)
      .set(authorized(tokenB))
      .send({ bizTransactionId: `E2E-BOL-${suffix}` })
      .expect(201);

    // An unrelated organization never: 404, not 403.
    await request(server)
      .post(`${prefix}/epcs/${inTransitEpc}/purchase-order`)
      .set(authorized(tokenC))
      .send({ bizTransactionId: `E2E-PO-X-${suffix}` })
      .expect(404);
  });

  it('rejects invalid payloads', async () => {
    await request(server)
      .post(`${prefix}/epcs`)
      .set(authorized(tokenA))
      .send({ productId, unexpected: true })
      .expect(400);

    await request(server)
      .post(`${prefix}/products/${productId}/notices`)
      .set(authorized(tokenA))
      .send({ type: 'recall', title: 'Missing target' })
      .expect(400);
  });
});

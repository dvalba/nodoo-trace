import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Actor } from '../src/actor/entities/actor.entity.js';
import { ActorStatus } from '../src/actor/enums/actor-status.enum.js';
import { PlatformRole, UserRole } from '../src/users/enums/roles.enum.js';
import { UserStatus } from '../src/users/enums/user-status.enum.js';
import { UsersService } from '../src/users/users.service.js';

const PASSWORD = 'Password123';
const prefix = '/api/v1';

/**
 * G6 (FR-204/205, spec note 3): onboarding is one-shot. Once the
 * organization has activities, `accept` and `custom` must reject with 409
 * even though the Swagger contract documented it and the service did not.
 */
describe('Onboarding is one-shot (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let ds: DataSource;

  const suffix = Date.now().toString();
  const actorIds: string[] = [];
  const emails: string[] = [];
  const customCodes: string[] = [];

  let token: string;

  const authorized = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function seedBareActor(label: string, email: string) {
    const actor = await ds.getRepository(Actor).save({
      name: `E2E onboarding bare ${label} ${suffix}`,
      status: ActorStatus.APPROVED,
      activities: [],
    });
    actorIds.push(actor.id);

    await app.get(UsersService).createUser({
      email,
      password: PASSWORD,
      fullName: `E2E onboarding ${label}`,
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

    const email = `onboarding-${suffix}@nodoo.test`;
    await seedBareActor('First', email);
    token = await login(email);
  }, 60000);

  afterAll(async () => {
    try {
      if (customCodes.length > 0) {
        await ds.query('delete from activity_operations where "activityTypeCode" = any($1)', [
          customCodes,
        ]);
        await ds.query('delete from activity_types where code = any($1)', [
          customCodes,
        ]);
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

  it('accepts activities for an organization without them', async () => {
    const response = await request(server)
      .post(`${prefix}/actor/operations/accept`)
      .set(authorized(token))
      .send({ activityCodes: ['warehouse'], operations: ['object:inspecting'] })
      .expect(201);
    expect(response.body.activities).toHaveLength(1);
    expect(response.body.activities[0].code).toBe('warehouse');
  });

  it('rejects a second accept with 409 (G6)', async () => {
    await request(server)
      .post(`${prefix}/actor/operations/accept`)
      .set(authorized(token))
      .send({ activityCodes: ['retailer'], operations: ['object:receiving'] })
      .expect(409);
  });

  it('rejects a custom activity once the organization has activities (G6)', async () => {
    await request(server)
      .post(`${prefix}/actor/operations/custom`)
      .set(authorized(token))
      .send({ name: `E2E Late Custom ${suffix}`, operations: ['object:receiving'] })
      .expect(409);
  });

  it('creates a custom activity for a bare organization, then rejects accept with 409 (G6)', async () => {
    const customEmail = `onboarding-custom-${suffix}@nodoo.test`;
    const actorId = await seedBareActor('Custom', customEmail);
    const token2 = await login(customEmail);

    const response = await request(server)
      .post(`${prefix}/actor/operations/custom`)
      .set(authorized(token2))
      .send({ name: `E2E Custom ${suffix}`, operations: ['object:receiving'] })
      .expect(201);
    expect(response.body.actorId).toBe(actorId);
    customCodes.push(response.body.activity.code);

    await request(server)
      .post(`${prefix}/actor/operations/accept`)
      .set(authorized(token2))
      .send({ activityCodes: ['warehouse'], operations: ['object:inspecting'] })
      .expect(409);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { DataSource, Repository } from 'typeorm';
import { NoticesService } from './notices.service.js';
import { ProductsService } from '../products/products.service.js';
import { Product } from '../products/entities/product.entity.js';
import { Batch } from '../products/entities/batch.entity.js';
import { Epc } from '../event-ledger/entities/epc.entity.js';
import { ProductNotice } from './entities/product-notice.entity.js';
import { ProductNoticeEpc } from './entities/product-notice-epc.entity.js';
import { ProductNoticeAck } from './entities/product-notice-ack.entity.js';
import { NoticeType } from './enums/notice-type.enum.js';

function makeNotice(overrides: Partial<ProductNotice> = {}): ProductNotice {
  return {
    id: 'n1',
    productId: 'p1',
    batchId: null,
    type: NoticeType.RECALL,
    title: 'Recall',
    description: null,
    createdByActorId: 'owner',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    epcs: [],
    acks: [],
    product: { id: 'p1', createdByActorId: 'owner' } as Product,
    batch: null,
    ...overrides,
  } as ProductNotice;
}

function makeService() {
  const getProduct = vi.fn();
  const noticeRepo = {
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    find: vi.fn(),
  };
  const ackRepo = {
    findOneBy: vi.fn(),
    create: vi.fn((value: Partial<ProductNoticeAck>) => value),
    save: vi.fn(),
    find: vi.fn(),
  };
  const batchRepo = { findOneBy: vi.fn() };
  const epcRepo = { find: vi.fn(), count: vi.fn() };
  const manager = {
    create: vi.fn((_entity: unknown, value: object) => value),
    save: vi.fn(),
  };
  const transaction = vi.fn(
    async (callback: (manager: typeof manager) => unknown) =>
      callback(manager),
  );

  const service = new NoticesService(
    { transaction } as unknown as DataSource,
    { getProduct } as unknown as ProductsService,
    noticeRepo as unknown as Repository<ProductNotice>,
    ackRepo as unknown as Repository<ProductNoticeAck>,
    batchRepo as unknown as Repository<Batch>,
    epcRepo as unknown as Repository<Epc>,
  );

  return {
    service,
    getProduct,
    noticeRepo,
    ackRepo,
    batchRepo,
    epcRepo,
    manager,
    transaction,
  };
}

describe('NoticesService', () => {
  it('requires at least one target when creating a notice', async () => {
    const { service, getProduct, transaction } = makeService();
    getProduct.mockResolvedValue(makeNotice().product);

    await expect(
      service.createNotice('owner', 'p1', {
        type: NoticeType.RECALL,
        title: 'Recall',
      }),
    ).rejects.toThrow('must target a batch or at least one EPC');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects EPCs that do not belong to the product', async () => {
    const { service, getProduct, epcRepo, transaction } = makeService();
    getProduct.mockResolvedValue(makeNotice().product);
    epcRepo.find.mockResolvedValue([{ id: 'e1', productId: 'other' }]);

    await expect(
      service.createNotice('owner', 'p1', {
        type: NoticeType.ADVISORY,
        title: 'Advisory',
        epcIds: ['e1'],
      }),
    ).rejects.toThrow('does not belong to the product');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('validates that the targeted batch belongs to the product', async () => {
    const { service, getProduct, batchRepo, transaction } = makeService();
    getProduct.mockResolvedValue(makeNotice().product);
    batchRepo.findOneBy.mockResolvedValue(null);

    await expect(
      service.createNotice('owner', 'p1', {
        type: NoticeType.RECALL,
        title: 'Recall',
        batchId: 'b1',
      }),
    ).rejects.toThrow('Batch not found');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('gives the product owner access without checking EPC relations', async () => {
    const { service, noticeRepo, epcRepo } = makeService();
    const notice = makeNotice();
    noticeRepo.findOne.mockResolvedValue(notice);

    expect(await service.getNotice('owner', 'n1')).toBe(notice);
    expect(epcRepo.count).not.toHaveBeenCalled();
  });

  it('gives actors related to a targeted EPC access', async () => {
    const { service, noticeRepo, epcRepo } = makeService();
    const notice = makeNotice({
      epcs: [
        {
          noticeId: 'n1',
          epcId: 'e1',
        } as ProductNoticeEpc,
      ],
    });
    noticeRepo.findOne.mockResolvedValue(notice);
    epcRepo.count.mockResolvedValue(1);

    expect(await service.getNotice('custodian', 'n1')).toBe(notice);
    expect(epcRepo.count).toHaveBeenCalledWith({
      where: [
        { id: 'e1', ownerActorId: 'custodian' },
        { id: 'e1', custodianActorId: 'custodian' },
        { id: 'e1', producerActorId: 'custodian' },
      ],
    });
  });

  it('hides the notice from unrelated actors', async () => {
    const { service, noticeRepo, epcRepo } = makeService();
    noticeRepo.findOne.mockResolvedValue(
      makeNotice({
        epcs: [
          {
            noticeId: 'n1',
            epcId: 'e1',
          } as ProductNoticeEpc,
        ],
      }),
    );
    epcRepo.count.mockResolvedValue(0);

    await expect(service.getNotice('stranger', 'n1')).rejects.toThrow(
      'ProductNotice not found',
    );
  });

  it('returns the existing acknowledgement when acking twice', async () => {
    const { service, noticeRepo, ackRepo } = makeService();
    const existing = {
      id: 'a1',
      noticeId: 'n1',
      actorId: 'owner',
    } as ProductNoticeAck;
    noticeRepo.findOne.mockResolvedValue(makeNotice());
    ackRepo.findOneBy.mockResolvedValue(existing);

    expect(await service.ackNotice('owner', 'n1')).toBe(existing);
    expect(ackRepo.save).not.toHaveBeenCalled();
  });

  it('creates an acknowledgement the first time', async () => {
    const { service, noticeRepo, ackRepo } = makeService();
    const created = {
      id: 'a2',
      noticeId: 'n1',
      actorId: 'owner',
    } as ProductNoticeAck;
    noticeRepo.findOne.mockResolvedValue(makeNotice());
    ackRepo.findOneBy.mockResolvedValue(null);
    ackRepo.save.mockResolvedValue(created);

    expect(await service.ackNotice('owner', 'n1')).toBe(created);
    expect(ackRepo.create).toHaveBeenCalledWith({
      noticeId: 'n1',
      actorId: 'owner',
    });
  });

  it('lets the owner list the acknowledgements without checking EPC relations', async () => {
    const { service, noticeRepo, ackRepo, epcRepo } = makeService();
    noticeRepo.findOne.mockResolvedValue(makeNotice());
    ackRepo.find.mockResolvedValue([]);

    await service.listAcks('owner', 'n1');

    expect(epcRepo.count).not.toHaveBeenCalled();
    expect(ackRepo.find).toHaveBeenCalledWith({
      where: { noticeId: 'n1' },
      order: { acknowledgedAt: 'ASC' },
    });
  });

  it('hides acknowledgements from actors unrelated to the notice', async () => {
    const { service, noticeRepo, ackRepo, epcRepo } = makeService();
    noticeRepo.findOne.mockResolvedValue(
      makeNotice({
        epcs: [
          {
            noticeId: 'n1',
            epcId: 'e1',
          } as ProductNoticeEpc,
        ],
      }),
    );
    epcRepo.count.mockResolvedValue(0);

    await expect(service.listAcks('stranger', 'n1')).rejects.toThrow(
      'ProductNotice not found',
    );
    expect(ackRepo.find).not.toHaveBeenCalled();
  });
});

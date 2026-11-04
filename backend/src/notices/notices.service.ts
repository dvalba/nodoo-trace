import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { throwNotFound } from '../common/helpers/crud-exceptions.helper.js';
import {
  DB_ERROR_CODE,
  handleDbExceptions,
  isQueryFailedWithCode,
} from '../common/helpers/db-exception.helper.js';
import { ProductsService } from '../products/products.service.js';
import { Batch } from '../products/entities/batch.entity.js';
import { Epc } from '../event-ledger/entities/epc.entity.js';
import { ProductNotice } from './entities/product-notice.entity.js';
import { ProductNoticeEpc } from './entities/product-notice-epc.entity.js';
import { ProductNoticeAck } from './entities/product-notice-ack.entity.js';
import { CreateNoticeDto } from './dto/create-notice.dto.js';

@Injectable()
export class NoticesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    @InjectRepository(ProductNotice)
    private readonly noticeRepo: Repository<ProductNotice>,
    @InjectRepository(ProductNoticeAck)
    private readonly ackRepo: Repository<ProductNoticeAck>,
    @InjectRepository(Batch)
    private readonly batchRepo: Repository<Batch>,
    @InjectRepository(Epc)
    private readonly epcRepo: Repository<Epc>,
  ) {}

  async createNotice(
    actorId: string,
    productId: string,
    dto: CreateNoticeDto,
  ): Promise<ProductNotice> {
    await this.productsService.getProduct(actorId, productId);

    const epcIds = [...new Set(dto.epcIds ?? [])];

    if (!dto.batchId && epcIds.length === 0) {
      throw new BadRequestException(
        'A notice must target a batch or at least one EPC.',
      );
    }

    if (dto.batchId) {
      const batch = await this.batchRepo.findOneBy({
        id: dto.batchId,
        productId,
      });
      if (!batch) throwNotFound('Batch', dto.batchId);
    }

    if (epcIds.length > 0) {
      const epcs = await this.epcRepo.find({ where: { id: In(epcIds) } });
      const byId = new Map(epcs.map((epc) => [epc.id, epc]));
      const invalid = epcIds.find(
        (epcId) => byId.get(epcId)?.productId !== productId,
      );

      if (invalid) {
        throw new BadRequestException(
          `EPC "${invalid}" does not belong to the product.`,
        );
      }
    }

    const notice = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(ProductNotice, {
          productId,
          batchId: dto.batchId ?? null,
          type: dto.type,
          title: dto.title,
          description: dto.description ?? null,
          createdByActorId: actorId,
        }),
      );

      if (epcIds.length > 0) {
        await manager.save(
          epcIds.map((epcId) =>
            manager.create(ProductNoticeEpc, {
              noticeId: saved.id,
              epcId,
            }),
          ),
        );
      }

      return saved;
    });

    return this.getNotice(actorId, notice.id);
  }

  async listNotices(
    actorId: string,
    productId: string,
  ): Promise<ProductNotice[]> {
    const notices = await this.noticeRepo.find({
      where: { productId },
      relations: { epcs: true, product: true },
      order: { createdAt: 'DESC' },
    });

    return (
      await Promise.all(
        notices.map(async (notice) =>
          (await this.canAccess(actorId, notice)) ? notice : null,
        ),
      )
    ).filter((notice): notice is ProductNotice => notice !== null);
  }

  async getNotice(actorId: string, noticeId: string): Promise<ProductNotice> {
    const notice = await this.noticeRepo.findOne({
      where: { id: noticeId },
      relations: { epcs: true, product: true },
    });

    if (!notice || !(await this.canAccess(actorId, notice))) {
      throwNotFound('ProductNotice', noticeId);
    }

    return notice;
  }

  async ackNotice(
    actorId: string,
    noticeId: string,
  ): Promise<ProductNoticeAck> {
    const notice = await this.getNotice(actorId, noticeId);

    const existing = await this.ackRepo.findOneBy({
      noticeId: notice.id,
      actorId,
    });
    if (existing) return existing;

    try {
      return await this.ackRepo.save(
        this.ackRepo.create({ noticeId: notice.id, actorId }),
      );
    } catch (error) {
      if (
        isQueryFailedWithCode(error) &&
        error.driverError.code === DB_ERROR_CODE.UNIQUE_VIOLATION
      ) {
        const raced = await this.ackRepo.findOneBy({
          noticeId: notice.id,
          actorId,
        });
        if (raced) return raced;
      }

      handleDbExceptions(error);
    }
  }

  async listAcks(
    actorId: string,
    noticeId: string,
  ): Promise<ProductNoticeAck[]> {
    const notice = await this.noticeRepo.findOne({
      where: { id: noticeId },
      relations: { epcs: true, product: true },
    });
    if (!notice) throwNotFound('ProductNotice', noticeId);

    if (!(await this.canAccess(actorId, notice))) {
      throwNotFound('ProductNotice', noticeId);
    }

    return this.ackRepo.find({
      where: { noticeId },
      order: { acknowledgedAt: 'ASC' },
    });
  }

  private async canAccess(
    actorId: string,
    notice: ProductNotice,
  ): Promise<boolean> {
    if (notice.product.createdByActorId === actorId) return true;

    return this.hasRelatedEpc(actorId, notice);
  }

  private async hasRelatedEpc(
    actorId: string,
    notice: ProductNotice,
  ): Promise<boolean> {
    const where: FindOptionsWhere<Epc>[] = [];

    for (const link of notice.epcs ?? []) {
      where.push({ id: link.epcId, ownerActorId: actorId });
      where.push({ id: link.epcId, custodianActorId: actorId });
      where.push({ id: link.epcId, producerActorId: actorId });
    }

    if (notice.batchId) {
      where.push({ batchId: notice.batchId, ownerActorId: actorId });
      where.push({ batchId: notice.batchId, custodianActorId: actorId });
      where.push({ batchId: notice.batchId, producerActorId: actorId });
    }

    if (where.length === 0) return false;

    return (await this.epcRepo.count({ where })) > 0;
  }
}

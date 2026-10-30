import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { throwNotFound } from '../common/helpers/crud-exceptions.helper.js';
import {
  DB_ERROR_CODE,
  handleDbExceptions,
} from '../common/helpers/db-exception.helper.js';
import { Product } from './entities/product.entity.js';
import { Batch } from './entities/batch.entity.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { CreateBatchDto } from './dto/create-batch.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Batch)
    private readonly batchRepo: Repository<Batch>,
  ) {}

  async createProduct(
    actorId: string,
    dto: CreateProductDto,
  ): Promise<Product> {
    const product = this.productRepo.create({
      createdByActorId: actorId,
      sku: dto.sku,
      name: dto.name,
    });

    try {
      return await this.productRepo.save(product);
    } catch (error) {
      handleDbExceptions(error, {
        mappers: {
          [DB_ERROR_CODE.UNIQUE_VIOLATION]: () =>
            new ConflictException(
              `Product with SKU "${dto.sku}" already exists.`,
            ),
        },
      });
    }
  }

  listProducts(actorId: string): Promise<Product[]> {
    return this.productRepo.find({
      where: { createdByActorId: actorId },
      order: { createdAt: 'ASC' },
    });
  }

  getProduct(actorId: string, productId: string): Promise<Product> {
    return this.findOwnedProduct(actorId, productId);
  }

  async createBatch(
    actorId: string,
    productId: string,
    dto: CreateBatchDto,
  ): Promise<Batch> {
    await this.findOwnedProduct(actorId, productId);

    const batch = this.batchRepo.create({
      productId,
      batchCode: dto.batchCode,
    });

    try {
      return await this.batchRepo.save(batch);
    } catch (error) {
      handleDbExceptions(error, {
        mappers: {
          [DB_ERROR_CODE.UNIQUE_VIOLATION]: () =>
            new ConflictException(
              `Batch with code "${dto.batchCode}" already exists for this product.`,
            ),
        },
      });
    }
  }

  async listBatches(actorId: string, productId: string): Promise<Batch[]> {
    await this.findOwnedProduct(actorId, productId);

    return this.batchRepo.find({
      where: { productId },
      order: { createdAt: 'ASC' },
    });
  }

  private async findOwnedProduct(
    actorId: string,
    productId: string,
  ): Promise<Product> {
    const product = await this.productRepo.findOneBy({
      id: productId,
      createdByActorId: actorId,
    });

    if (!product) throwNotFound('Product', productId);

    return product;
  }
}

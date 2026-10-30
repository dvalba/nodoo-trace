import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { Product } from './entities/product.entity.js';
import { Batch } from './entities/batch.entity.js';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  imports: [TypeOrmModule.forFeature([Product, Batch])],
  exports: [ProductsService, TypeOrmModule],
})
export class ProductsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '../products/products.module.js';
import { Batch } from '../products/entities/batch.entity.js';
import { Epc } from '../event-ledger/entities/epc.entity.js';
import { NoticesService } from './notices.service.js';
import { ProductNotice } from './entities/product-notice.entity.js';
import { ProductNoticeEpc } from './entities/product-notice-epc.entity.js';
import { ProductNoticeAck } from './entities/product-notice-ack.entity.js';
import { NoticesController } from './controllers/notices.controller.js';
import { ProductNoticesController } from './controllers/product-notices.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductNotice,
      ProductNoticeEpc,
      ProductNoticeAck,
      Batch,
      Epc,
    ]),
    ProductsModule,
  ],
  controllers: [NoticesController, ProductNoticesController],
  providers: [NoticesService],
  exports: [TypeOrmModule],
})
export class NoticesModule {}

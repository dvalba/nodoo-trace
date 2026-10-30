import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator.js';
import { Caller } from '../auth/decorators/caller.decorator.js';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { UserRole } from '../users/enums/roles.enum.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { CreateBatchDto } from './dto/create-batch.dto.js';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Auth(UserRole.OWNER)
  @Post()
  @ApiOperation({ summary: 'Create a product in the organization catalog' })
  create(@Caller() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.createProduct(user.actorId, dto);
  }

  @Auth(UserRole.OWNER)
  @Get()
  @ApiOperation({ summary: 'List the organization products' })
  list(@Caller() user: AuthUser) {
    return this.productsService.listProducts(user.actorId);
  }

  @Auth(UserRole.OWNER)
  @Get(':productId')
  @ApiOperation({ summary: 'Get a product by id' })
  get(
    @Caller() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.productsService.getProduct(user.actorId, productId);
  }

  @Auth(UserRole.OWNER)
  @Post(':productId/batches')
  @ApiOperation({ summary: 'Create a batch for a product' })
  createBatch(
    @Caller() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateBatchDto,
  ) {
    return this.productsService.createBatch(user.actorId, productId, dto);
  }

  @Auth(UserRole.OWNER)
  @Get(':productId/batches')
  @ApiOperation({ summary: 'List the batches of a product' })
  listBatches(
    @Caller() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.productsService.listBatches(user.actorId, productId);
  }
}

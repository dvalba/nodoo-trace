import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    description: 'SKU, unique within the organization',
    example: 'COFFEE-500G',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku: string;

  @ApiProperty({
    description: 'Human readable product name',
    example: 'Coffee 500g',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;
}

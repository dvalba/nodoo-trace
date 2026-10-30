import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBatchDto {
  @ApiProperty({
    description: 'Batch/lot code, unique within the product',
    example: 'LOT-2026-001',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  batchCode: string;
}

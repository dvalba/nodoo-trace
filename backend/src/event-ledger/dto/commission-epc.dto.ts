import { IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommissionEpcDto {
  @ApiProperty({
    description: 'Product the commissioned EPC belongs to',
    format: 'uuid',
  })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    description: 'Batch/lot the commissioned EPC belongs to',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  batchId?: string;
}

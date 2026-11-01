import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceEpcDto {
  @ApiProperty({
    description: 'Business transaction id (invoice number)',
    example: 'INV-2026-0001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  bizTransactionId: string;

  @ApiPropertyOptional({
    description: 'Actor that becomes the new owner of the EPC',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  ownershipTransferTo?: string;
}

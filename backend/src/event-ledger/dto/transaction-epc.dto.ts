import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransactionEpcDto {
  @ApiProperty({
    description: 'Business transaction id (PO number, despatch advice id, …)',
    example: 'PO-2026-0001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  bizTransactionId: string;
}

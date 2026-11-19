import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ShipEpcDto {
  @ApiProperty({
    description:
      'Actor id of the organization the EPC is being shipped to. That organization is the only one (besides the current custodian) able to receive it.',
    format: 'uuid',
    example: '8f14e45f-ceea-467f-9d5c-8b1f0a1b2c3d',
  })
  @IsUUID()
  destinationActorId: string;
}

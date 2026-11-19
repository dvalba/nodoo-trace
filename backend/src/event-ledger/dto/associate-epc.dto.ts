import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssociateEpcDto {
  @ApiProperty({
    description: 'EPC ids associated with the main EPC (certificates, warranties, …)',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  relatedEpcs: string[];
}

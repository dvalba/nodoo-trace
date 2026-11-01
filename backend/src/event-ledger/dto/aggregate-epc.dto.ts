import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AggregateEpcDto {
  @ApiProperty({
    description: 'EPCs that are added to or removed from the parent EPC',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  childEpcs: string[];
}

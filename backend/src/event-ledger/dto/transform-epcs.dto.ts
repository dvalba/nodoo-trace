import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransformEpcsDto {
  @ApiProperty({
    description: 'EPCs consumed by the transformation',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  inputEpcs: string[];

  @ApiProperty({
    description: 'Product of the EPCs produced by the transformation',
    format: 'uuid',
  })
  @IsUUID()
  outputProductId: string;

  @ApiPropertyOptional({
    description: 'Batch of the EPCs produced by the transformation',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  outputBatchId?: string;

  @ApiPropertyOptional({
    description: 'Number of output EPCs to mint (defaults to 1)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  outputCount?: number;
}

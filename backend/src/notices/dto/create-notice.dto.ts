import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoticeType } from '../enums/notice-type.enum.js';

export class CreateNoticeDto {
  @ApiProperty({ enum: NoticeType })
  @IsEnum(NoticeType)
  type: NoticeType;

  @ApiProperty({
    description: 'Short notice title',
    example: 'Potential contamination in lot LOT-2026-001',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed explanation of the recall or advisory',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Batch/lot affected by the notice',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({
    description: 'Specific EPCs affected by the notice',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  epcIds?: string[];
}

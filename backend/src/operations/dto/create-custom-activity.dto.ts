import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OPERATION_CODES } from '../../activity-types/constants/operations.constant.js';

export class CreateCustomActivityDto {
  @ApiProperty({
    description:
      'Name for the new custom activity type (created globally and linked to exactly the selected operations)',
    example: 'My operations',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({
    description: 'Operation codes the new activity type will cover',
    example: ['object:shipping', 'object:receiving'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(OPERATION_CODES, {
    each: true,
    message: 'each operation must be a valid operation code',
  })
  operations: string[];
}

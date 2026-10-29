import { ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OPERATION_CODES } from '../../activity-types/constants/operations.constant.js';

export class SuggestOperationsDto {
  @ApiProperty({
    description:
      'Operation codes selected by the owner (grouped checkboxes)',
    example: ['object:commissioning', 'object:shipping', 'object:receiving'],
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

import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OPERATION_CODES } from '../../activity-types/constants/operations.constant.js';

export class AcceptActivitiesDto {
  @ApiProperty({
    description:
      'Activity type codes (suggested combination or manual pick) assigned to the organization',
    example: ['manufacturer'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  activityCodes: string[];

  @ApiProperty({
    description:
      'Operation codes selected by the owner; the chosen activities must cover all of them',
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

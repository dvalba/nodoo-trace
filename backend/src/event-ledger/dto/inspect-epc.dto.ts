import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type InspectionResult = 'passed' | 'failed';

export class InspectEpcDto {
  @ApiProperty({
    description: 'Result of the quality inspection',
    enum: ['passed', 'failed'],
  })
  @IsIn(['passed', 'failed'])
  result: InspectionResult;
}

import { IsArray, IsString, MinLength, MaxLength, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateActorDto {
  @ApiProperty({ description: 'Legal name of the organization', example: 'Acme Corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  legalName: string;

  @ApiProperty({
    description: 'Activity type codes the organization operates under',
    example: ['MFG', 'RSL'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  activityCodes: string[];
}
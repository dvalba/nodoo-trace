import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActorDto {
  @ApiProperty({ description: 'Legal name of the organization', example: 'Acme Corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  legalName: string;

  @ApiPropertyOptional({
    description: 'Organization number (tax id, registry number, ...)',
    example: '123456789',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  organizationNumber?: string;
}

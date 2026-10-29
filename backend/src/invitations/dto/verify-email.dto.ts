import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Verification token received by email' })
  @IsString()
  @MaxLength(255)
  token: string;
}

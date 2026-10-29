import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invitation token received by email' })
  @IsString()
  inviteToken: string;

  @ApiProperty({ description: 'Full name of the new user', example: 'John Smith' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({
    description:
      'Password for the new account. Min 8 chars, must contain lowercase, uppercase and a digit.',
    example: 'Password1',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
  password: string;
}
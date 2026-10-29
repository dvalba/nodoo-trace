import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Account email', example: 'owner@company.com' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ description: 'Account password', example: 'Password1' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
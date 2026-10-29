import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateActorDto } from '../../actor/dto/create-actor.dto.js';

export class RegisterActorDto extends CreateActorDto {
  // Hereda: legalName, organizationNumber

  @ApiProperty({ description: 'Owner account email', example: 'owner@acme.com' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  adminEmail: string;

  @ApiProperty({
    description:
      'Owner password. Min 8 chars, must contain lowercase, uppercase and a digit.',
    example: 'Password1',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one lowercase, one uppercase and one digit',
  })
  adminPassword: string;

  @ApiProperty({ description: 'Owner full name', example: 'Jane Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminFullName: string;
}

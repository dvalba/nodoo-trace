import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { CreateActorDto } from '../../actor/dto/create-actor.dto.js';

export class RegisterActorDto extends CreateActorDto {
  // Hereda: legalName, activityCodes

  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  adminEmail: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one lowercase, one uppercase and one digit',
  })
  adminPassword: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminFullName: string;
}

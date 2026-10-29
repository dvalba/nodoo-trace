import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../users/enums/roles.enum.js';

export class InviteUserDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
}

import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
  ArrayUnique,
} from 'class-validator';
import {
  PlatformRole,
  UserRole,
  UserStatus,
} from '../enums/index.js';

export class CreateUserDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one lowercase, one uppercase and one digit',
  })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsUUID('4', { message: 'actorId must be a valid UUID v4' })
  actorId?: string;
 
  @IsOptional()
  @IsEnum(PlatformRole, { each: true, message: 'invalid platform role' })
  @ArrayUnique({ message: 'platformRoles must not contain duplicates' })
  platformRoles?: PlatformRole[];

  @IsOptional()
  @IsEnum(UserRole, { each: true, message: 'invalid user role' })
  @ArrayUnique({ message: 'roles must not contain duplicates' })
  roles?: UserRole[];

  @IsOptional()
  @IsEnum(UserStatus, { message: 'invalid user status' })
  status?: UserStatus;
}

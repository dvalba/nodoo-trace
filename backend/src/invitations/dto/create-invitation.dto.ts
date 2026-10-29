import { ArrayNotEmpty, ArrayUnique, IsArray, IsDate, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { UserRole } from '../../users/enums/roles.enum.js';

export class CreateInvitationDto {
  
  @IsUUID()
  actorId: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];

  @IsUUID()
  @IsOptional()
  invitedById?: string

  @IsString()
  @MaxLength(255)
  tokenHash: string;

  @IsDate()
  expiresAt: Date;
}


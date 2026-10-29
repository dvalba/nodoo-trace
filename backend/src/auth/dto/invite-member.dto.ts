import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../users/enums/roles.enum.js';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}

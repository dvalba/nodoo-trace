import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/enums/roles.enum.js';

export class InviteUserDto {
  @ApiProperty({ description: 'Email of the user to invite', example: 'team@acme.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Roles to assign within the organization',
    enum: UserRole,
    isArray: true,
    example: [UserRole.MEMBER],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
}

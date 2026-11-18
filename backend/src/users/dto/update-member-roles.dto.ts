import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/roles.enum.js';

export class UpdateMemberRolesDto {
  @ApiProperty({
    description: 'Roles to add to the member (additive only)',
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

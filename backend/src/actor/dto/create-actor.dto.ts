import { IsArray, IsString, MinLength, MaxLength, ArrayMinSize } from 'class-validator';

export class CreateActorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  legalName: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  activityCodes: string[];
}
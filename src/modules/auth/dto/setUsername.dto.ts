import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetUsernameDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;
}
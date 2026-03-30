import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { AUTH_MESSAGES } from '../response/auth.response';

export class CreateUsernameDto {
  @ApiProperty({ example: 'user123' })
  @IsString()
  @MinLength(3, { message: AUTH_MESSAGES.USERNAME_INVALID_FORMAT })
  @MaxLength(30, { message: AUTH_MESSAGES.USERNAME_INVALID_FORMAT })
  @Matches(/^[a-zA-Z0-9._]+$/, { message: AUTH_MESSAGES.USERNAME_INVALID_FORMAT })
  @Matches(/^(?!.*\.\.)/, { message: AUTH_MESSAGES.USERNAME_INVALID_FORMAT })
  @Matches(/^(?!\.).*(?<!\.)$/, { message: AUTH_MESSAGES.USERNAME_DOT_POSITION })
  username: string;
}
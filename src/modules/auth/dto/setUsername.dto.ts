import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetUsernameDto {
  @ApiProperty({ example: 'user123' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username!: string;
}
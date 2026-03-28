import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({ description: 'Apple identity token' })
  @IsString()
  @IsNotEmpty()
  identityToken: string;
}
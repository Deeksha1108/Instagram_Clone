import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AppleLoginDto {
  @ApiProperty({ description: 'Apple identity token' })
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiProperty({ description: 'Full name from Apple (only available on first login; ignored afterwards).' })
  @IsOptional()
  @IsString()
  fullName?: string;
}
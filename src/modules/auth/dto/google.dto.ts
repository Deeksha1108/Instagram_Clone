import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID token from client' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FacebookLoginDto {
  @ApiProperty({
    description: 'Facebook access token from client',
  })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
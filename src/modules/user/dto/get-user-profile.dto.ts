import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GetUserProfileDto {
  @ApiProperty({
    description: 'Username of the user whose profile needs to be fetched',
    example: 'ashu12',
  })
  @IsString()
  username: string;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min } from 'class-validator';

export class CreateProfileDto {
  @ApiProperty({ example: 'Deeksha Singh' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'deeksha01' })
  @IsString()
  username: string;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @Min(18, { message: 'You must be at least 18 years old' })
  age: number;

  @ApiProperty({ example: 'female' })
  @IsString()
  gender: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
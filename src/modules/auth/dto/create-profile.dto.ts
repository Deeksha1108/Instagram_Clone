import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

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
  @Max(100, { message: 'Age must not be greater than 100' })
  age: number;

  @ApiProperty({ example: 'female' })
  @IsEnum(Gender, { message: 'Gender must be male, female or other' })
  gender: Gender;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(10, { message: 'Password must not exceed 10 characters' })
  password: string;
}

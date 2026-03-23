import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  Validate,
} from 'class-validator';
import { Gender } from 'src/common/enum/enum.common';
import { IsAdultValidator } from 'src/common/validators/dob.validator';

export class CreateProfileDto {
  @ApiProperty({ example: 'Deeksha Singh' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'deeksha01' })
  @IsString()
  username: string;

  @ApiProperty({ example: '2000-01-01' })
  @IsDateString({}, { message: 'Invalid date format' })
  @Validate(IsAdultValidator)
  dateOfBirth: string;

  @ApiProperty({ example: 'female' })
  @IsEnum(Gender, { message: 'Gender must be 1, 2 or 3' })
  gender: Gender;

  @ApiProperty({ example: 'Pass@123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(10, { message: 'Password must not exceed 10 characters' })
  password: string;
}

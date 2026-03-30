import {
  IsArray,
  ArrayMinSize,
  IsOptional,
  IsEnum,
  ArrayUnique,
  IsString,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { INTERESTS, ACCOUNT_TYPE, Gender } from 'src/common/enum/enum.common';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProfileDto {
  @ApiProperty({ example: 'Deeksha Singh' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'Bio text...' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  bio?: string;

  @ApiProperty({ example: 'https://yourwebsite.com' })
  @IsOptional()
  @IsUrl({}, { message: 'Please enter a valid URL.' })
  website?: string;

  @ApiProperty({ example: 'she/her' })
  @IsOptional()
  @IsString()
  pronouns?: string;

  @ApiProperty({ example: 'https://yourprofileurl' })
  @IsOptional()
  @IsString()
  profilePicture?: string;

  @ApiProperty({ example: ['Travel', 'Technology', 'Music'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3, { message: 'Please select at least 3 interests.' })
  @ArrayUnique({ message: 'Duplicate interests are not allowed.' })
  @IsEnum(INTERESTS, { each: true })
  interests?: INTERESTS[];

  @ApiProperty({ example: 'personal' })
  @IsEnum(ACCOUNT_TYPE, { message: 'Invalid account type selected.' })
  accountType: ACCOUNT_TYPE;
}

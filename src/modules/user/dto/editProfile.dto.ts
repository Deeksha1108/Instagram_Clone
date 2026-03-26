import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { USER_LIMITS } from 'src/common/constants/constants';
import { Gender } from 'src/common/enum/enum.common';

export class EditProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(USER_LIMITS.BIO_MAX_LENGTH)
  bio?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showSuggestions?: boolean;
}

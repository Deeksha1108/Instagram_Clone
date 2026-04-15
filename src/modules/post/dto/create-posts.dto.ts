import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostMediaDto } from './post-media.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiPropertyOptional({ example: 'Enjoying the sunset', maxLength: 2200 })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiProperty({ type: [PostMediaDto], minItems: 1, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PostMediaDto)
  media!: PostMediaDto[];
}
